// Definition Validation & Matching
// Checks whether a set of MapDefinitions plausibly corresponds to a loaded ROM buffer.
// Returns a DefinitionMatchResult with a score, status, and diagnostic warnings.

import type { MapDefinition } from './map-definition'
import type { DefinitionMatchResult, DefinitionMatchStatus, ValidationWarning } from './validation'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ELEM_BYTES: Partial<Record<string, number>> = {
  uint8: 1, int8: 1,
  uint16: 2, int16: 2,
  uint32: 4, int32: 4,
  float32: 4,
}

function readScalar(
  view: DataView,
  byteOffset: number,
  dataType: MapDefinition['dataType'],
  little: boolean,
): number {
  switch (dataType) {
    case 'uint8':   return view.getUint8(byteOffset)
    case 'int8':    return view.getInt8(byteOffset)
    case 'uint16':  return view.getUint16(byteOffset, little)
    case 'int16':   return view.getInt16(byteOffset, little)
    case 'uint32':  return view.getUint32(byteOffset, little)
    case 'int32':   return view.getInt32(byteOffset, little)
    case 'float32': return view.getFloat32(byteOffset, little)
    default:        return 0
  }
}

// ─── matchDefinitions ─────────────────────────────────────────────────────────

/**
 * Validates a set of MapDefinitions against a ROM buffer and produces a
 * DefinitionMatchResult indicating how well they correspond.
 *
 * Checks performed:
 *  1. File size (if compatibility.expectedFileSize is set)
 *  2. Offset bounds for every definition
 *  3. Blank map detection (all 0x00 or 0xFF) on a sampled subset
 *  4. Axis monotonicity for address-based axes on a small sample
 */
export function matchDefinitions(
  buffer: Uint8Array,
  definitions: MapDefinition[],
): DefinitionMatchResult {
  const warnings: ValidationWarning[] = []

  if (definitions.length === 0) {
    return { status: 'unknown', score: 0, warnings }
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let score = 0.50

  // ── 1. File size ───────────────────────────────────────────────────────────

  const expectedSizes = Array.from(
    new Set(
      definitions
        .map((d) => d.compatibility?.expectedFileSize)
        .filter((s): s is number => s !== undefined),
    ),
  )

  if (expectedSizes.length > 0) {
    const expected = expectedSizes[0]!
    if (buffer.byteLength === expected) {
      score += 0.30
    } else {
      score -= 0.25
      warnings.push({
        code: 'FILE_SIZE_MISMATCH',
        severity: 'warning',
        message: `File is ${buffer.byteLength.toLocaleString()} bytes; definition expects ${expected.toLocaleString()} bytes`,
      })
    }
  }

  // ── 2. Offset bounds (all definitions) ────────────────────────────────────

  let inBounds = 0
  let outOfBounds = 0

  for (const def of definitions) {
    const span = def.rows * def.cols * (ELEM_BYTES[def.dataType] ?? 2)
    if (def.offset < 0 || def.offset + span > buffer.byteLength) {
      outOfBounds++
      if (outOfBounds <= 5) {
        warnings.push({
          code: 'OFFSET_OUT_OF_BOUNDS',
          severity: 'warning',
          message: `"${def.name}": 0x${def.offset.toString(16)} + ${span} B exceeds file`,
          offset: def.offset,
        })
      }
    } else {
      inBounds++
    }
  }

  if (outOfBounds > 5) {
    warnings.push({
      code: 'MANY_OUT_OF_BOUNDS',
      severity: 'warning',
      message: `${outOfBounds} of ${definitions.length} maps have offsets outside the file`,
    })
  }

  const oobRatio = outOfBounds / definitions.length
  score -= oobRatio * 0.60 // up to –0.60 penalty

  if (outOfBounds === 0) score += 0.15 // bonus: every offset is within file

  // ── 3. Blank map detection (sampled) ──────────────────────────────────────

  const BLANK_SAMPLE = 20
  const blankStep = Math.max(1, Math.floor(definitions.length / BLANK_SAMPLE))
  let blankChecked = 0
  let blankCount = 0

  for (let i = 0; i < definitions.length; i += blankStep) {
    const def = definitions[i]!
    const span = def.rows * def.cols * (ELEM_BYTES[def.dataType] ?? 2)
    if (def.offset < 0 || def.offset + span > buffer.byteLength) continue
    if (span > 4096) continue // skip oversized maps

    blankChecked++
    const slice = buffer.subarray(def.offset, def.offset + span)
    const first = slice[0]
    if ((first === 0x00 || first === 0xff) && slice.every((b) => b === first)) {
      blankCount++
    }
  }

  if (blankChecked > 0 && blankCount / blankChecked > 0.60) {
    score -= 0.15
    warnings.push({
      code: 'MANY_BLANK_MAPS',
      severity: 'warning',
      message: `${blankCount} of ${blankChecked} sampled maps are all 0x00 or 0xFF – definition may not match this ROM`,
    })
  }

  // ── 4. Axis monotonicity (small sample) ───────────────────────────────────

  const AXIS_SAMPLE = 10
  const axisStep = Math.max(1, Math.floor(definitions.length / AXIS_SAMPLE))
  let axisChecked = 0
  let axisIssues = 0

  for (let i = 0; i < definitions.length; i += axisStep) {
    const def = definitions[i]!

    for (const axis of [def.xAxis, def.yAxis]) {
      if (
        !axis ||
        axis.source !== 'address' ||
        axis.offset === undefined ||
        axis.length === undefined ||
        !axis.dataType ||
        axis.length < 2
      ) continue

      const elemBytes = ELEM_BYTES[axis.dataType] ?? 2
      const axisEnd = axis.offset + axis.length * elemBytes
      if (axisEnd > buffer.byteLength) continue

      axisChecked++
      const little = axis.endianness === 'little'
      const scale = axis.scale ?? { factor: 1, offset: 0 }

      let prev =
        readScalar(view, axis.offset, axis.dataType, little) * scale.factor + scale.offset
      let monotonic = true

      for (let j = 1; j < axis.length; j++) {
        const val =
          readScalar(view, axis.offset + j * elemBytes, axis.dataType, little) *
            scale.factor +
          scale.offset
        if (val <= prev) {
          monotonic = false
          break
        }
        prev = val
      }

      if (!monotonic) {
        axisIssues++
        warnings.push({
          code: 'AXIS_NOT_MONOTONIC',
          severity: 'info',
          message: `"${def.name}" ${axis.label ?? 'axis'}: values are not strictly increasing`,
          offset: axis.offset,
        })
      }
    }
  }

  if (axisChecked > 0 && axisIssues / axisChecked > 0.50) {
    score -= 0.10
  }

  // ── Final score → status ───────────────────────────────────────────────────

  score = Math.max(0, Math.min(1, score))

  let status: DefinitionMatchStatus
  if      (score >= 0.85) status = 'exact'
  else if (score >= 0.65) status = 'likely'
  else if (score >= 0.40) status = 'weak'
  else                    status = 'mismatch'

  return { status, score, warnings }
}
