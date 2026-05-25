/**
 * ECU Parser Web Worker
 *
 * Läuft in einem separaten Thread – hält den UI-Thread frei beim Parsen
 * von ECU-Binärdateien (bis zu 1 MB) und beim Zurückschreiben von Map-Werten.
 */

import { parseECU, getHexSlice, writeMapValues } from '@maplab/ecu-parser-wasm'
import {
  fingerprintROM,
  loadInternalDefinition,
  extractMaps,
} from '@maplab/definition-parser'
import type { MapDefinition } from '@maplab/definition-parser'
import type { FileFormat, ParsedECU, ECUMap, MapType } from '@maplab/types'

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

// ─── Message Handler ──────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data

  switch (msg.type) {
    case 'parse': {
      try {
        const buffer = new Uint8Array(msg.buffer)

        // Base parse: checksum, size, format metadata
        const result = await parseECU(buffer, msg.format)

        // Fingerprint the ROM to identify ECU + software version
        const fp = fingerprintROM(buffer)
        if (fp.ecu !== null) {
          result.detectedEcu = fp.ecu
          result.confidence = fp.confidence
        }

        // Determine definitions to use
        // Passed definitions (XDF) take priority over internal ones.
        let definitions: MapDefinition[] = msg.definitions
        if (definitions.length === 0 && fp.ecu !== null && fp.softwareVersion !== null) {
          const internalDefs = await loadInternalDefinition(fp.ecu, fp.softwareVersion)
          if (internalDefs !== null) definitions = internalDefs
        }

        if (definitions.length > 0) {
          const extraction = extractMaps(buffer, definitions)
          result.maps = extraction.maps.map((m): ECUMap => ({
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
            safetyFlags: null,
          }))
        }

        const response: WorkerOutbound = { type: 'parse:success', result }
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
