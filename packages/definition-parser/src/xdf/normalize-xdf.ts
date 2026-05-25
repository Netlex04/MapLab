// Converts a parsed XdfFile into MapDefinition[].
// All XDF quirks (base offset, flag bitmasks, MATH equations) are resolved here.

import type { XdfFile, XdfTable, XdfConstant, XdfAxis, XdfDefaults } from './parse-xdf'
import type {
  MapDefinition,
  MapCategory,
  DataType,
  AxisDefinition,
} from '../common/map-definition'
import { generateMapId } from '../common/id'

// ─── Math equation parser ─────────────────────────────────────────────────────
// Tries to parse a linear equation `aX + b` into factor/offset.
// Falls back to factor=1/offset=0 + stores raw expression for complex formulas.

interface LinearScale {
  factor: number
  offset: number
  expression?: string
}

function parseMathEquation(equation: string): LinearScale {
  const eq = equation.replace(/\s+/g, '')

  // X*a[+-]b  or  a*X[+-]b
  const mulAdd = /^(?:X\*([+-]?[\d.]+(?:[eE][+-]?\d+)?)|([+-]?[\d.]+(?:[eE][+-]?\d+)?)\*X)([+-][\d.]+(?:[eE][+-]?\d+)?)$/
  let m = eq.match(mulAdd)
  if (m) {
    const factor = parseFloat((m[1] ?? m[2])!)
    const offset = parseFloat(m[3]!)
    if (isFinite(factor) && isFinite(offset)) return { factor, offset }
  }

  // X*a  or  a*X  (no additive offset)
  const mulOnly = /^(?:X\*([+-]?[\d.]+(?:[eE][+-]?\d+)?)|([+-]?[\d.]+(?:[eE][+-]?\d+)?)\*X)$/
  m = eq.match(mulOnly)
  if (m) {
    const factor = parseFloat((m[1] ?? m[2])!)
    if (isFinite(factor)) return { factor, offset: 0 }
  }

  // X/a[+-]b
  const divAdd = /^X\/([+-]?[\d.]+(?:[eE][+-]?\d+)?)([+-][\d.]+(?:[eE][+-]?\d+)?)$/
  m = eq.match(divAdd)
  if (m) {
    const divisor = parseFloat(m[1]!)
    const offset = parseFloat(m[2]!)
    if (isFinite(divisor) && divisor !== 0 && isFinite(offset))
      return { factor: 1 / divisor, offset }
  }

  // X/a
  const divOnly = /^X\/([+-]?[\d.]+(?:[eE][+-]?\d+)?)$/
  m = eq.match(divOnly)
  if (m) {
    const divisor = parseFloat(m[1]!)
    if (isFinite(divisor) && divisor !== 0) return { factor: 1 / divisor, offset: 0 }
  }

  // X[+-]b
  const addOnly = /^X([+-][\d.]+(?:[eE][+-]?\d+)?)$/
  m = eq.match(addOnly)
  if (m) {
    const offset = parseFloat(m[1]!)
    if (isFinite(offset)) return { factor: 1, offset }
  }

  // Just X
  if (eq === 'X') return { factor: 1, offset: 0 }

  // Complex formula – keep as expression, use identity as fallback
  return { factor: 1, offset: 0, expression: equation }
}

// ─── Data type resolver ───────────────────────────────────────────────────────
// XDF stores type info in global DEFAULTS + per-table flag bits.
// Table flags: 0x08 = lsbFirst, 0x10 = signed, 0x20 = float

function resolveDataType(
  elementSizeBits: number,
  tableFlags: number,
  defaults: XdfDefaults,
): DataType {
  const signed = (tableFlags & 0x10) !== 0 ? true : defaults.signed
  const isFloat = (tableFlags & 0x20) !== 0 ? true : defaults.float

  if (isFloat && elementSizeBits === 32) return 'float32'
  switch (elementSizeBits) {
    case 8: return signed ? 'int8' : 'uint8'
    case 16: return signed ? 'int16' : 'uint16'
    case 32: return signed ? 'int32' : 'uint32'
    default: return 'uint16'
  }
}

function resolveEndianness(tableFlags: number, defaults: XdfDefaults): 'big' | 'little' {
  const lsbFirst = (tableFlags & 0x08) !== 0 ? true : defaults.lsbFirst
  return lsbFirst ? 'little' : 'big'
}

// ─── Category guesser ─────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: [MapCategory, RegExp][] = [
  ['ignition', /\b(ignition|ign|kfzw|zündwinkel|timing|advance|spark)\b/i],
  ['fuel', /\b(fuel|injection|injector|kf(?:kp|tve|wl)|kraftstoff|einspritz)\b/i],
  ['lambda', /\b(lambda|afr|air.fuel|o2|oxygen)\b/i],
  ['torque', /\b(torque|moment|drehmom|kf(?:mome))\b/i],
  ['driver_wish', /\b(driver|fahrerwunsch|throttle|pedal|kfped|accelerat)\b/i],
  ['limit', /\b(limit|cutoff|cut.off|begrenzer|rev.limit|absperren)\b/i],
  ['vanos', /\b(vanos|camshaft|nockenwelle|variable.valve|vtec)\b/i],
  ['idle', /\b(idle|leerlauf|standgas|kf(?:leer|idle))\b/i],
  ['maf', /\b(maf|mass.air|luftmenge|luftmass|kfmaf|lmm)\b/i],
  ['boost', /\b(boost|ladedr|turbo|supercharg|lade)\b/i],
  ['diagnostic', /\b(diag|fehler|error|obd|dtc|monitor)\b/i],
]

function guessCategory(name: string, description: string, categoryName?: string): MapCategory {
  const combined = `${categoryName ?? ''} ${name} ${description}`
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(combined)) return cat
  }
  return 'unknown'
}

// ─── Axis normalizer ──────────────────────────────────────────────────────────

function normalizeAxis(
  axis: XdfAxis | undefined,
  tableFlags: number,
  defaults: XdfDefaults,
  romBaseOffset: number,
): AxisDefinition | undefined {
  if (!axis) return undefined

  const count = axis.indexCount
  const math = axis.math ? parseMathEquation(axis.math.equation) : { factor: 1, offset: 0 }

  // embedType 1 = data lives in the ROM at mmedaddress
  if (axis.embedType === 1 && axis.embeddedData) {
    const emb = axis.embeddedData
    const dataType = resolveDataType(emb.elementSizeBits, tableFlags, defaults)
    const endianness = resolveEndianness(tableFlags, defaults)

    const result: AxisDefinition = {
      source: 'address',
      offset: emb.address + romBaseOffset,
      length: count,
      dataType,
      endianness,
    }
    if (axis.units) result.label = axis.units
    if (axis.units) result.unit = axis.units
    if (!math.expression) result.scale = { factor: math.factor, offset: math.offset }
    return result
  }

  // Fall back to index axis
  const result: AxisDefinition = {
    source: 'index',
    scale: { factor: 1, offset: 0 },
  }
  if (axis.units) result.label = axis.units
  if (axis.units) result.unit = axis.units
  return result
}

// ─── Table → MapDefinition ────────────────────────────────────────────────────

function tableToDefinition(
  table: XdfTable,
  header: XdfFile['header'],
  xdfName: string,
  warnings: string[],
): MapDefinition | null {
  const zAxis = table.zAxis!
  const emb = zAxis.embeddedData
  if (!emb) {
    warnings.push(`Table "${table.title}": Z axis has no EMBEDDEDDATA – skipped`)
    return null
  }

  const romBaseOffset = header.baseOffset.subtract
    ? -header.baseOffset.offset
    : header.baseOffset.offset

  const offset = emb.address + romBaseOffset
  if (offset < 0) {
    warnings.push(`Table "${table.title}": negative ROM offset – skipped`)
    return null
  }

  const rows = emb.rowCount
  const cols = emb.colCount
  if (rows < 1 || cols < 1) {
    warnings.push(`Table "${table.title}": invalid dimensions ${rows}×${cols} – skipped`)
    return null
  }

  const dataType = resolveDataType(emb.elementSizeBits, table.flags, header.defaults)
  const endianness = resolveEndianness(table.flags, header.defaults)
  const math = zAxis.math ? parseMathEquation(zAxis.math.equation) : { factor: 1, offset: 0 }

  const categoryName = table.categoryIndices.length > 0
    ? header.categories.get(table.categoryIndices[0]!)
    : undefined
  const category = guessCategory(table.title, table.description, categoryName)

  const value: MapDefinition['value'] = {
    factor: math.factor,
    offset: math.offset,
  }
  if (zAxis.units) value.unit = zAxis.units
  if (math.expression) value.expression = math.expression

  const source: MapDefinition['source'] = { type: 'xdf' }
  const sourceName = xdfName || header.title
  if (sourceName) source.name = sourceName
  if (header.author) source.author = header.author

  const def: MapDefinition = {
    id: generateMapId({ name: table.title, offset }),
    name: table.title,
    category,
    offset,
    rows,
    cols,
    dataType,
    endianness,
    value,
    source,
    confidence: 'user_uploaded',
  }

  if (table.description) def.description = table.description

  const xAxis = normalizeAxis(table.xAxis, table.flags, header.defaults, romBaseOffset)
  if (xAxis !== undefined) def.xAxis = xAxis

  const yAxis = normalizeAxis(table.yAxis, table.flags, header.defaults, romBaseOffset)
  if (yAxis !== undefined) def.yAxis = yAxis

  return def
}

// ─── Constant → MapDefinition ─────────────────────────────────────────────────

function constantToDefinition(
  constant: XdfConstant,
  header: XdfFile['header'],
  xdfName: string,
  warnings: string[],
): MapDefinition | null {
  const emb = constant.embeddedData
  if (!emb) {
    warnings.push(`Constant "${constant.title}": no EMBEDDEDDATA – skipped`)
    return null
  }

  const romBaseOffset = header.baseOffset.subtract
    ? -header.baseOffset.offset
    : header.baseOffset.offset

  const offset = emb.address + romBaseOffset
  if (offset < 0) {
    warnings.push(`Constant "${constant.title}": negative ROM offset – skipped`)
    return null
  }

  const dataType = resolveDataType(emb.elementSizeBits, constant.flags, header.defaults)
  const endianness = resolveEndianness(constant.flags, header.defaults)
  const math = constant.math ? parseMathEquation(constant.math.equation) : { factor: 1, offset: 0 }

  const value: MapDefinition['value'] = { factor: math.factor, offset: math.offset }
  if (constant.units) value.unit = constant.units
  if (math.expression) value.expression = math.expression

  const source: MapDefinition['source'] = { type: 'xdf' }
  const sourceName = xdfName || header.title
  if (sourceName) source.name = sourceName
  if (header.author) source.author = header.author

  const def: MapDefinition = {
    id: generateMapId({ name: constant.title, offset }),
    name: constant.title,
    category: guessCategory(constant.title, constant.description),
    offset,
    rows: 1,
    cols: 1,
    dataType,
    endianness,
    value,
    source,
    confidence: 'user_uploaded',
  }

  if (constant.description) def.description = constant.description

  return def
}

// ─── Public entry point ───────────────────────────────────────────────────────

export interface NormalizeXdfResult {
  definitions: MapDefinition[]
  warnings: string[]
  stats: {
    tablesFound: number
    constantsFound: number
    definitionsCreated: number
  }
}

export function normalizeXdf(xdf: XdfFile, xdfFileName: string): NormalizeXdfResult {
  const warnings = [...xdf.warnings]
  const definitions: MapDefinition[] = []

  for (const table of xdf.tables) {
    const def = tableToDefinition(table, xdf.header, xdfFileName, warnings)
    if (def) definitions.push(def)
  }

  for (const constant of xdf.constants) {
    const def = constantToDefinition(constant, xdf.header, xdfFileName, warnings)
    if (def) definitions.push(def)
  }

  return {
    definitions,
    warnings,
    stats: {
      tablesFound: xdf.tables.length,
      constantsFound: xdf.constants.length,
      definitionsCreated: definitions.length,
    },
  }
}

// ─── Convenience: parse + normalize in one call ───────────────────────────────

import { parseXdf } from './parse-xdf'

export function parseAndNormalizeXdf(xmlText: string, fileName: string): NormalizeXdfResult {
  const xdf = parseXdf(xmlText)
  return normalizeXdf(xdf, fileName)
}
