import type { MapDefinition, MapCategory } from './map-definition'
import type { ExtractionResult } from './ecu-map'
import type { ValidationWarning, DefinitionMatchResult } from './validation'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SafetyCheckOutput {
  /** File- and definition-level warnings. */
  fileWarnings: ValidationWarning[]
  /** Per-map warnings, keyed by map ID. */
  mapWarnings: Record<string, ValidationWarning[]>
}

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Known standard ECU ROM sizes in bytes. */
const STANDARD_ROM_SIZES = new Set([
  0x10000,  // 64 KB
  0x20000,  // 128 KB
  0x40000,  // 256 KB
  0x80000,  // 512 KB
  0x100000, // 1 MB
])

/**
 * Plausible engineering-value ranges per category.
 * Checked on scaled (engineering) values after factor+offset is applied.
 */
const CATEGORY_BOUNDS: Partial<Record<MapCategory, { min: number; max: number }>> = {
  ignition:    { min: -15, max: 65 },
  fuel:        { min: 0,   max: 25 },
  lambda:      { min: 0.5, max: 1.6 },
  boost:       { min: 0.5, max: 3.5 },
  torque:      { min: -200, max: 700 },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isBlankBuffer(slice: Uint8Array): boolean {
  const first = slice[0]
  if (first !== 0x00 && first !== 0xff) return false
  return slice.every((b) => b === first)
}

function allEqual(values: number[][]): boolean {
  const first = values[0]?.[0]
  if (first === undefined) return false
  return values.every((row) => row.every((v) => v === first))
}

// ─── Main ──────────────────────────────────────────────────────────────────────

/**
 * Runs basic safety checks after map extraction.
 *
 * Does NOT claim a ROM is safe to flash. Produces informational hints only.
 * All messages are phrased as warnings, not as clearances.
 */
export function runSafetyChecks(
  buffer: Uint8Array,
  definitions: MapDefinition[],
  extraction: ExtractionResult,
  matchResult: DefinitionMatchResult | null,
): SafetyCheckOutput {
  const fileWarnings: ValidationWarning[] = []
  const mapWarnings: Record<string, ValidationWarning[]> = {}

  // ── 1. File size ────────────────────────────────────────────────────────────

  if (!STANDARD_ROM_SIZES.has(buffer.byteLength)) {
    fileWarnings.push({
      code: 'FILE_SIZE_UNUSUAL',
      severity: 'warning',
      message: `Dateigröße ${(buffer.byteLength / 1024).toFixed(0)} KB entspricht keiner bekannten ECU-ROM-Größe. Datei könnte truncated oder ungültig sein.`,
    })
  }

  // ── 2. Checksum unverified ──────────────────────────────────────────────────

  fileWarnings.push({
    code: 'CHECKSUM_UNVERIFIED',
    severity: 'info',
    message: 'ROM-Checksum wurde nicht verifiziert. Vor dem Flashen muss die Checksum korrekt gesetzt sein.',
  })

  // ── 3. Definition match status ─────────────────────────────────────────────

  if (matchResult !== null) {
    if (matchResult.status === 'mismatch') {
      fileWarnings.push({
        code: 'DEFINITION_MISMATCH',
        severity: 'critical',
        message: 'Die Definition passt wahrscheinlich nicht zur geladenen ROM. Maps können falsche Werte enthalten.',
      })
    } else if (matchResult.status === 'weak') {
      fileWarnings.push({
        code: 'DEFINITION_WEAK_MATCH',
        severity: 'warning',
        message: 'Die Definition passt nur schwach zur ROM. Einige Maps könnten falsche Werte enthalten.',
      })
    } else if (matchResult.status === 'unknown') {
      fileWarnings.push({
        code: 'DEFINITION_UNKNOWN_MATCH',
        severity: 'info',
        message: 'Übereinstimmung zwischen Definition und ROM konnte nicht geprüft werden.',
      })
    }

    // Bubble up match-level warnings (e.g. FILE_SIZE_MISMATCH, MANY_BLANK_MAPS)
    for (const w of matchResult.warnings) {
      if (!fileWarnings.some((existing) => existing.code === w.code)) {
        fileWarnings.push(w)
      }
    }
  }

  // ── 4. XDF-specific incompatibility hint ───────────────────────────────────

  const hasXdfSource = definitions.some((d) => d.source.type === 'xdf')
  if (
    hasXdfSource &&
    matchResult !== null &&
    (matchResult.status === 'mismatch' || matchResult.status === 'weak')
  ) {
    fileWarnings.push({
      code: 'XDF_INCOMPATIBLE',
      severity: 'warning',
      message: 'Die hochgeladene XDF wurde möglicherweise für eine andere Firmware-Version erstellt.',
    })
  }

  // ── 5. Extraction-level warnings (offset OOB etc.) ─────────────────────────

  for (const w of extraction.warnings) {
    fileWarnings.push(w)
  }

  // ── 6. Per-map checks ──────────────────────────────────────────────────────

  for (const map of extraction.maps) {
    const warnings: ValidationWarning[] = []
    const byteWidth = definitions.find((d) => d.id === map.definitionId)
      ? (() => {
          const dt = definitions.find((d) => d.id === map.definitionId)!.dataType
          return dt === 'uint8' || dt === 'int8' ? 1
            : dt === 'uint32' || dt === 'int32' || dt === 'float32' ? 4
            : 2
        })()
      : 2

    // Blank map detection (uses rawValues)
    if (map.rows > 0 && map.cols > 0) {
      const totalBytes = map.rows * map.cols * byteWidth
      if (totalBytes <= 4096) {
        // Reconstruct raw byte slice from rawValues to detect 0x00 / 0xFF fill
        const flatRaw = map.rawValues.flat()
        const isAllZero = flatRaw.every((v) => v === 0)
        const isAllFF = flatRaw.every((v) => v === 0xff || v === 65535 || v === 4294967295)
        if (isAllZero || isAllFF) {
          warnings.push({
            code: 'MAP_ALL_BLANK',
            severity: 'warning',
            message: `Map '${map.name}': alle Werte sind ${isAllZero ? '0x00' : '0xFF'} – möglicherweise nicht initialisiert oder Definition passt nicht.`,
            mapId: map.id,
            offset: map.offset,
          })
        }
      }
    }

    // Uniform values (not blank, but all equal – suspicious for 2D+ maps)
    if (map.rows > 1 && map.cols > 1 && !warnings.some((w) => w.code === 'MAP_ALL_BLANK')) {
      if (allEqual(map.values)) {
        warnings.push({
          code: 'MAP_VALUE_UNIFORM',
          severity: 'info',
          message: `Map '${map.name}': alle Werte sind identisch (${map.values[0]?.[0]?.toFixed(2)}). Könnte auf falsche Definition hindeuten.`,
          mapId: map.id,
          offset: map.offset,
        })
      }
    }

    // Value range check (scaled values vs. category bounds)
    const bounds = CATEGORY_BOUNDS[map.category]
    if (bounds !== undefined) {
      const flat = map.values.flat()
      const outOfRange = flat.filter((v) => v < bounds.min || v > bounds.max)
      if (flat.length > 0 && outOfRange.length / flat.length > 0.10) {
        warnings.push({
          code: 'MAP_VALUE_OUT_OF_RANGE',
          severity: 'warning',
          message: `Map '${map.name}': ${outOfRange.length} von ${flat.length} Werten liegen außerhalb des erwarteten Bereichs [${bounds.min}, ${bounds.max}].`,
          mapId: map.id,
          offset: map.offset,
        })
      }
    }

    // Axis plausibility: flat or non-monotonic axes
    const axes = [
      { axis: map.xAxis, label: 'X-Achse' },
      { axis: map.yAxis, label: 'Y-Achse' },
    ]
    for (const { axis, label } of axes) {
      if (axis.values.length >= 2) {
        const allSame = axis.values.every((v) => v === axis.values[0])
        if (allSame) {
          warnings.push({
            code: 'AXIS_ALL_EQUAL',
            severity: 'info',
            message: `Map '${map.name}' ${label}: alle Achswerte sind gleich (${axis.values[0]}). Achse ist nicht aufgelöst.`,
            mapId: map.id,
          })
        } else {
          // Check strict monotonic increase (engine map axes should always increase)
          let monotonic = true
          for (let i = 1; i < axis.values.length; i++) {
            if (axis.values[i]! <= axis.values[i - 1]!) {
              monotonic = false
              break
            }
          }
          if (!monotonic) {
            warnings.push({
              code: 'AXIS_NOT_MONOTONIC',
              severity: 'info',
              message: `Map '${map.name}' ${label}: Achswerte sind nicht streng monoton steigend. Könnte auf falsche Definition oder Adresse hindeuten.`,
              mapId: map.id,
            })
          }
        }
      }
    }

    if (warnings.length > 0) {
      mapWarnings[map.id] = warnings
    }
  }

  return { fileWarnings, mapWarnings }
}
