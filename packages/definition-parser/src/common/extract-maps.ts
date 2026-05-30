import type { MapDefinition, AxisDefinition } from './map-definition'
import type { ExtractedMap, ExtractionAxis, ExtractionResult } from './ecu-map'
import type { ValidationWarning } from './validation'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function byteWidth(dataType: string): number {
  switch (dataType) {
    case 'uint8':
    case 'int8':
      return 1
    case 'uint16':
    case 'int16':
      return 2
    case 'uint32':
    case 'int32':
    case 'float32':
      return 4
    default:
      return 2
  }
}

function readValue(
  view: DataView,
  byteOffset: number,
  dataType: string,
  littleEndian: boolean,
): number | null {
  const w = byteWidth(dataType)
  if (byteOffset + w > view.byteLength) return null
  switch (dataType) {
    case 'uint8':   return view.getUint8(byteOffset)
    case 'int8':    return view.getInt8(byteOffset)
    case 'uint16':  return view.getUint16(byteOffset, littleEndian)
    case 'int16':   return view.getInt16(byteOffset, littleEndian)
    case 'uint32':  return view.getUint32(byteOffset, littleEndian)
    case 'int32':   return view.getInt32(byteOffset, littleEndian)
    case 'float32': {
      const f = view.getFloat32(byteOffset, littleEndian)
      return isFinite(f) ? f : null
    }
    default: return null
  }
}

function resolveAxis(
  view: DataView,
  axis: AxisDefinition | undefined,
  count: number,
): ExtractionAxis {
  const result: ExtractionAxis = {
    values: Array.from({ length: count }, (_, i) => i),
  }
  if (axis?.label !== undefined) result.label = axis.label
  if (axis?.unit !== undefined) result.unit = axis.unit

  if (!axis) return result

  if (axis.source === 'inline' && axis.values !== undefined && axis.values.length === count) {
    result.values = axis.values
    return result
  }

  if (axis.source === 'address' && axis.offset !== undefined && axis.length !== undefined) {
    const dt = axis.dataType ?? 'uint16'
    const le = (axis.endianness ?? 'big') === 'little'
    const scale = axis.scale
    const w = byteWidth(dt)
    const values: number[] = []
    for (let i = 0; i < axis.length; i++) {
      const raw = readValue(view, axis.offset + i * w, dt, le)
      if (raw === null) {
        values.push(i)
      } else {
        values.push(scale !== undefined ? raw * scale.factor + scale.offset : raw)
      }
    }
    result.values = values
    return result
  }

  return result
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function extractMaps(
  buffer: Uint8Array,
  definitions: MapDefinition[],
): ExtractionResult {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const maps: ExtractedMap[] = []
  const warnings: ValidationWarning[] = []

  for (const def of definitions) {
    const le = def.endianness === 'little'
    const w = byteWidth(def.dataType)
    const required = def.offset + def.rows * def.cols * w

    if (required > buffer.byteLength) {
      warnings.push({
        code: 'OFFSET_OUT_OF_BOUNDS',
        severity: 'warning',
        message: `Map '${def.name}' at 0x${def.offset.toString(16).toUpperCase()} needs ${required} B, buffer is ${buffer.byteLength} B — skipped`,
        mapId: def.id,
        offset: def.offset,
      })
      continue
    }

    const { factor, offset: scaleOff } = def.value
    const rawValues: number[][] = []
    const values: number[][] = []

    for (let row = 0; row < def.rows; row++) {
      const rawRow: number[] = []
      const scaledRow: number[] = []
      for (let col = 0; col < def.cols; col++) {
        const byteOff = def.offset + (row * def.cols + col) * w
        const raw = readValue(view, byteOff, def.dataType, le) ?? 0
        rawRow.push(raw)
        scaledRow.push(raw * factor + scaleOff)
      }
      rawValues.push(rawRow)
      values.push(scaledRow)
    }

    const extracted: ExtractedMap = {
      id: def.id,
      definitionId: def.id,
      name: def.name,
      category: def.category,
      offset: def.offset,
      rows: def.rows,
      cols: def.cols,
      xAxis: resolveAxis(view, def.xAxis, def.cols),
      yAxis: resolveAxis(view, def.yAxis, def.rows),
      values,
      rawValues,
      scaleFactor: def.value.factor,
      scaleOffset: def.value.offset,
      dataType: def.dataType,
      endianness: def.endianness,
      source: { type: def.source.type },
      confidence: def.confidence,
      warnings: [],
    }
    if (def.value.unit !== undefined) extracted.valueUnit = def.value.unit
    if (def.source.name !== undefined) extracted.source.name = def.source.name
    if (def.source.version !== undefined) extracted.source.version = def.source.version

    maps.push(extracted)
  }

  return { maps, warnings }
}
