/**
 * ECU Parser Web Worker
 *
 * Läuft in einem separaten Thread – hält den UI-Thread frei beim Parsen
 * von ECU-Binärdateien (bis zu 1 MB) und beim Zurückschreiben von Map-Werten.
 */

import { parseECU, getHexSlice, writeMapValues, extractMapsFromDefinitionsWasm } from '@maplab/ecu-parser-wasm'
import type { WasmExtractionResult } from '@maplab/ecu-parser-wasm'
import {
  fingerprintROM,
  loadInternalDefinition,
  extractMaps,
  matchDefinitions,
  runSafetyChecks,
} from '@maplab/definition-parser'
import type {
  MapDefinition,
  ExtractionResult,
  ExtractedMap,
  ValidationWarning,
} from '@maplab/definition-parser'
import type { FileFormat, ParsedECU, ECUMap, MapType, SafetyFlag, DefinitionMatchStatus } from '@maplab/types'

// ─── Message Protocol ─────────────────────────────────────────────────────────

export type WorkerInbound =
  | { type: 'parse'; buffer: ArrayBuffer; format: FileFormat; definitions: MapDefinition[] }
  | { type: 'write'; buffer: ArrayBuffer; maps: ECUMap[]; changes: Record<string, number[][]> }
  | { type: 'hex-slice'; buffer: ArrayBuffer; offset: number; length: number }

export type WorkerOutbound =
  | { type: 'parse:success'; result: ParsedECU }
  | { type: 'parse:error'; message: string }
  | { type: 'write:success'; buffer: ArrayBuffer }
  | { type: 'write:error'; message: string }
  | { type: 'hex-slice:success'; offset: number; bytes: number[]; ascii: string[] }
  | { type: 'hex-slice:error'; message: string }

// ─── Service Enhancement ──────────────────────────────────────────────────────

interface ServiceMap {
  name: string
  category: string
  offset: number
  rows: number
  cols: number
  value_unit: string | null
  x_axis_label: string | null
  y_axis_label: string | null
  x_axis_values: number[]
  y_axis_values: number[]
  values: number[][]
  scale_factor: number
  scale_offset: number
  source: string
  confidence: string
}

interface ServiceParseResponse {
  detected_ecu: string | null
  confidence: number
  definition_source: string
  map_count: number
  maps: ServiceMap[]
}

/**
 * Attempts to enhance localResult by calling the server-side /api/ecu/parse
 * endpoint. Only runs when the local parse produced no maps — the server uses
 * the same internal definitions, so calling it when maps already exist would
 * duplicate work without adding value until DAMOS/A2L axes are available.
 *
 * All errors are swallowed: the local result is always the authoritative fallback.
 */
async function tryEnhanceWithService(
  buffer: Uint8Array,
  localResult: ParsedECU,
): Promise<ParsedECU> {
  if (localResult.maps.length > 0) return localResult

  try {
    const blob = new Blob([buffer.buffer as ArrayBuffer], { type: 'application/octet-stream' })
    const form = new FormData()
    form.append('file', blob, 'rom.bin')

    const res = await fetch(`${self.location.origin}/api/ecu/parse`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) return localResult

    const data = (await res.json()) as ServiceParseResponse
    if (!data.maps || data.maps.length === 0) return localResult

    return {
      ...localResult,
      maps: data.maps.map((m, i): ECUMap => ({
        id: `svc_${m.offset.toString(16)}_${i}`,
        fileVersionId: '',
        name: m.name || null,
        aiLabel: null,
        type: toMapType(m.category),
        offset: m.offset,
        rows: m.rows,
        cols: m.cols,
        xAxisLabel: m.x_axis_label,
        yAxisLabel: m.y_axis_label,
        valueUnit: m.value_unit,
        values: m.values,
        scaledValues: null,
        safetyFlags: null,
        scaleFactor: m.scale_factor,
        scaleOffset: m.scale_offset,
        dataType: 'uint16',
        endianness: 'big',
      })),
    }
  } catch {
    return localResult
  }
}

// ─── Category → MapType ───────────────────────────────────────────────────────

const CATEGORY_TO_TYPE: Partial<Record<string, MapType>> = {
  ignition:    'IGNITION',
  fuel:        'INJECTION',
  lambda:      'LAMBDA',
  torque:      'TORQUE',
  driver_wish: 'DRIVER_WISH',
  boost:       'BOOST',
  limit:       'FUEL_CUTOFF',
}

function toMapType(category: string): MapType {
  return CATEGORY_TO_TYPE[category] ?? 'UNKNOWN'
}

// ─── WASM → TS ExtractionResult adapter ──────────────────────────────────────

/**
 * Convert WASM extraction output into the ExtractionResult shape expected by
 * runSafetyChecks() and the ECUMap builder.
 *
 * The WASM output omits scaleFactor/scaleOffset/dataType/endianness because
 * Rust doesn't re-serialize those from the definition. We look them up via
 * `defById` (keyed on definition id) and fall back to safe defaults so the
 * write path never sees undefined values.
 */
function wasmResultToExtractionResult(
  wasmResult: WasmExtractionResult,
  defById: Map<string, MapDefinition>,
): ExtractionResult {
  const toWarning = (w: WasmExtractionResult['warnings'][number]): ValidationWarning => {
    const base: ValidationWarning = {
      code: w.code,
      severity: w.severity as ValidationWarning['severity'],
      message: w.message,
    }
    if (w.mapId != null) base.mapId = w.mapId
    if (w.offset != null) base.offset = w.offset
    return base
  }

  const maps: ExtractedMap[] = wasmResult.maps.map((m) => {
    const def = defById.get(m.definitionId)
    const map: ExtractedMap = {
      id: m.id,
      definitionId: m.definitionId,
      name: m.name,
      category: m.category as ExtractedMap['category'],
      offset: m.offset,
      rows: m.rows,
      cols: m.cols,
      xAxis: {
        values: m.xAxis.values,
        ...(m.xAxis.label != null ? { label: m.xAxis.label } : {}),
        ...(m.xAxis.unit  != null ? { unit:  m.xAxis.unit  } : {}),
      },
      yAxis: {
        values: m.yAxis.values,
        ...(m.yAxis.label != null ? { label: m.yAxis.label } : {}),
        ...(m.yAxis.unit  != null ? { unit:  m.yAxis.unit  } : {}),
      },
      values: m.values,
      rawValues: m.rawValues,
      scaleFactor: def?.value.factor ?? 1,
      scaleOffset: def?.value.offset ?? 0,
      dataType: (def?.dataType ?? 'uint16') as ExtractedMap['dataType'],
      endianness: (def?.endianness ?? 'big') as ExtractedMap['endianness'],
      source: m.source as ExtractedMap['source'],
      confidence: m.confidence as ExtractedMap['confidence'],
      warnings: m.warnings.map(toWarning),
    }
    if (m.valueUnit != null) map.valueUnit = m.valueUnit
    return map
  })

  return { maps, warnings: wasmResult.warnings.map(toWarning) }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data

  switch (msg.type) {
    case 'parse': {
      try {
        const buffer = new Uint8Array(msg.buffer)

        // Base parse: checksum, size, format metadata
        const result = await parseECU(buffer, msg.format)
        // WASM result doesn't include the warnings field; initialize it here.
        result.warnings = []

        // Fingerprint the ROM to identify ECU + software version
        const fp = fingerprintROM(buffer)
        if (fp.ecu !== null) {
          result.detectedEcu = fp.ecu
          result.confidence = fp.confidence
        }

        // Determine definitions to use.
        // Passed definitions (XDF) take priority over internal ones.
        let definitions: MapDefinition[] = msg.definitions
        let usingInternalDefinition = false
        if (definitions.length === 0 && fp.ecu !== null && fp.softwareVersion !== null) {
          const internalDefs = await loadInternalDefinition(fp.ecu, fp.softwareVersion)
          if (internalDefs !== null) {
            definitions = internalDefs
            usingInternalDefinition = true
          }
        }

        if (definitions.length > 0) {
          const matchResult = matchDefinitions(buffer, definitions)
          // Fingerprint (byte-level) already verified the ROM; trust it over
          // the statistical matchDefinitions score which can false-negative on
          // valid ROMs (e.g. blank map sampling, axis scoring edge cases).
          result.matchStatus = (usingInternalDefinition && fp.confidence === 1.0)
            ? 'exact'
            : (matchResult.status as DefinitionMatchStatus)

          // Try Rust/WASM extraction first (same logic as TS, but faster).
          // Falls back transparently to TS extractMaps() when WASM is unavailable
          // (module not built) or when it returns an unexpected result.
          const defById = new Map(definitions.map((d) => [d.id, d]))
          const wasmResult = await extractMapsFromDefinitionsWasm(buffer, msg.format, definitions)

          let extraction: ExtractionResult
          if (wasmResult !== null && wasmResult.maps.length > 0) {
            extraction = wasmResultToExtractionResult(wasmResult, defById)
          } else {
            extraction = extractMaps(buffer, definitions)
          }

          const safety = runSafetyChecks(buffer, definitions, extraction, matchResult)

          result.maps = extraction.maps.map((m): ECUMap => {
            const mapFlags: SafetyFlag[] = (safety.mapWarnings[m.id] ?? []).map((w) => ({
              ruleId: w.code,
              severity: w.severity,
              message: w.message,
            }))
            return {
              id: m.id,
              fileVersionId: '',
              name: m.name,
              aiLabel: null,
              type: toMapType(m.category),
              offset: m.offset,
              rows: m.rows,
              cols: m.cols,
              xAxisLabel: m.xAxis.label ?? null,
              yAxisLabel: m.yAxis.label ?? null,
              valueUnit: m.valueUnit ?? null,
              values: m.values,
              scaledValues: null,
              safetyFlags: mapFlags.length > 0 ? mapFlags : null,
              scaleFactor: m.scaleFactor,
              scaleOffset: m.scaleOffset,
              dataType: m.dataType,
              endianness: m.endianness,
            }
          })

          result.warnings = safety.fileWarnings.map((w): SafetyFlag => ({
            ruleId: w.code,
            severity: w.severity,
            message: w.message,
          }))
        }

        const enhanced = await tryEnhanceWithService(buffer, result)
        const response: WorkerOutbound = { type: 'parse:success', result: enhanced }
        self.postMessage(response)
      } catch (err) {
        const response: WorkerOutbound = {
          type: 'parse:error',
          message: err instanceof Error ? err.message : 'Unbekannter Parsing-Fehler',
        }
        self.postMessage(response)
      }
      break
    }

    case 'write': {
      try {
        const buffer = new Uint8Array(msg.buffer)
        const result = await writeMapValues(buffer, msg.maps, msg.changes)
        const ab = result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer
        const response: WorkerOutbound = { type: 'write:success', buffer: ab }
        self.postMessage(response, { transfer: [ab] })
      } catch (err) {
        const response: WorkerOutbound = {
          type: 'write:error',
          message: err instanceof Error ? err.message : 'Schreibfehler',
        }
        self.postMessage(response)
      }
      break
    }

    case 'hex-slice': {
      try {
        const buffer = new Uint8Array(msg.buffer)
        const slice = await getHexSlice(buffer, msg.offset, msg.length)
        const response: WorkerOutbound = {
          type: 'hex-slice:success',
          offset: slice.offset,
          bytes: Array.from(slice.bytes),
          ascii: slice.ascii,
        }
        self.postMessage(response)
      } catch (err) {
        const response: WorkerOutbound = {
          type: 'hex-slice:error',
          message: err instanceof Error ? err.message : 'Hex-Slice-Fehler',
        }
        self.postMessage(response)
      }
      break
    }
  }
}
