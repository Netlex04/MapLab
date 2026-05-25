#!/usr/bin/env node
/**
 * Generates internal MapDefinition JSON files from local XDF fixtures.
 * Run from the repo root:
 *   node scripts/gen-internal-defs.mjs
 *
 * Input:  local-fixtures/definitions/<name>.xdf   (gitignored)
 * Output: packages/definition-parser/src/internal/<ecu>/<version>.json
 *
 * The generated JSON files are committed and bundled into the app.
 * They contain no ROM data – only map metadata (offsets, dimensions, scaling).
 */

import { XMLParser } from '/Users/moritzglueck/Desktop/Coding Projects/MapLab/node_modules/.pnpm/fast-xml-parser@5.7.3/node_modules/fast-xml-parser/src/fxp.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const FXP_OPTS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseAttributeValue: false,
  isArray: (name) =>
    ['XDFTABLE', 'XDFCONSTANT', 'XDFAXIS', 'CATEGORYMEM', 'CATEGORY', 'LABEL', 'VAR'].includes(
      name,
    ),
}

// ─── Math equation parser (mirrors normalize-xdf.ts) ─────────────────────────

function parseMathEquation(equation) {
  const eq = equation.replace(/\s+/g, '')

  const mulAdd =
    /^(?:X\*([+-]?[\d.]+(?:[eE][+-]?\d+)?)|([+-]?[\d.]+(?:[eE][+-]?\d+)?)\*X)([+-][\d.]+(?:[eE][+-]?\d+)?)$/
  let m = eq.match(mulAdd)
  if (m) {
    const factor = parseFloat(m[1] ?? m[2])
    const offset = parseFloat(m[3])
    if (isFinite(factor) && isFinite(offset)) return { factor, offset }
  }

  const mulOnly =
    /^(?:X\*([+-]?[\d.]+(?:[eE][+-]?\d+)?)|([+-]?[\d.]+(?:[eE][+-]?\d+)?)\*X)$/
  m = eq.match(mulOnly)
  if (m) {
    const factor = parseFloat(m[1] ?? m[2])
    if (isFinite(factor)) return { factor, offset: 0 }
  }

  const divAdd = /^X\/([+-]?[\d.]+(?:[eE][+-]?\d+)?)([+-][\d.]+(?:[eE][+-]?\d+)?)$/
  m = eq.match(divAdd)
  if (m) {
    const divisor = parseFloat(m[1])
    const offset = parseFloat(m[2])
    if (isFinite(divisor) && divisor !== 0 && isFinite(offset))
      return { factor: 1 / divisor, offset }
  }

  const divOnly = /^X\/([+-]?[\d.]+(?:[eE][+-]?\d+)?)$/
  m = eq.match(divOnly)
  if (m) {
    const divisor = parseFloat(m[1])
    if (isFinite(divisor) && divisor !== 0) return { factor: 1 / divisor, offset: 0 }
  }

  const addOnly = /^X([+-][\d.]+(?:[eE][+-]?\d+)?)$/
  m = eq.match(addOnly)
  if (m) {
    const offset = parseFloat(m[1])
    if (isFinite(offset)) return { factor: 1, offset }
  }

  if (eq === 'X') return { factor: 1, offset: 0 }
  return { factor: 1, offset: 0, expression: equation }
}

// ─── Data type resolver ───────────────────────────────────────────────────────

function resolveDataType(elementSizeBits, tableFlags, defaults) {
  const flagsNum = tableFlags !== undefined ? parseInt(tableFlags, 16) : 0
  const signed = (flagsNum & 0x10) !== 0 ? true : defaults.signed === '1'
  const isFloat = (flagsNum & 0x20) !== 0 ? true : defaults.float === '1'

  if (isFloat && elementSizeBits === 32) return 'float32'
  switch (elementSizeBits) {
    case 8:  return signed ? 'int8'  : 'uint8'
    case 16: return signed ? 'int16' : 'uint16'
    case 32: return signed ? 'int32' : 'uint32'
    default: return 'uint16'
  }
}

function resolveEndianness(tableFlags, defaults) {
  const flagsNum = tableFlags !== undefined ? parseInt(tableFlags, 16) : 0
  const lsbFirst = (flagsNum & 0x08) !== 0 ? true : defaults.lsbfirst === '1'
  return lsbFirst ? 'little' : 'big'
}

// ─── Category guesser ─────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS = [
  ['ignition', /\b(ignition|ign|kfzw|zündwinkel|timing|advance|spark|iga)\b/i],
  ['fuel',     /\b(fuel|injection|injector|kraftstoff|einspritz|tve|mirl|ti_)\b/i],
  ['lambda',   /\b(lambda|afr|air.fuel|o2|oxygen|lsh|hfm_lambda)\b/i],
  ['torque',   /\b(torque|moment|drehmom|tqi|mome|enmom)\b/i],
  ['driver_wish', /\b(driver|fahrerwunsch|throttle|pedal|ped|accelerat|pvs)\b/i],
  ['limit',    /\b(limit|cutoff|cut.off|begrenzer|rev.limit|n_max|nmaxl|nmax)\b/i],
  ['vanos',    /\b(vanos|camshaft|nockenwelle|variable.valve|vtec|ivvt)\b/i],
  ['idle',     /\b(idle|leerlauf|standgas|is_n|leer|idle)\b/i],
  ['maf',      /\b(maf|mass.air|luftmenge|luftmass|lmm|hfm)\b/i],
  ['boost',    /\b(boost|ladedr|turbo|supercharg|lade|ldr)\b/i],
  ['diagnostic', /\b(diag|fehler|error|obd|dtc|monitor|abc_inc|abc_cnt)\b/i],
]

function guessCategory(name, description, categoryName) {
  const combined = `${categoryName ?? ''} ${name} ${description ?? ''}`
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(combined)) return cat
  }
  return 'unknown'
}

// ─── Stable ID generator (mirrors id.ts) ─────────────────────────────────────

function generateMapId({ name, offset }) {
  const hash = createHash('sha256')
    .update(`${name}:${offset}`)
    .digest('hex')
    .slice(0, 8)
  return `map_${hash}`
}

// ─── Axis normalizer ──────────────────────────────────────────────────────────

function normalizeAxis(axisEl, tableFlags, defaults, romBaseOffset) {
  if (!axisEl) return undefined

  const embedType = axisEl.embedinfo?.['@type'] ? parseInt(axisEl.embedinfo['@type'], 10) : 0
  const indexCount = parseInt(axisEl.indexcount ?? '1', 10)
  const unitsText = typeof axisEl.units === 'string' ? axisEl.units.trim() : ''

  const mathEq = axisEl.MATH?.['@equation'] ?? ''
  const math = mathEq ? parseMathEquation(mathEq) : { factor: 1, offset: 0 }

  if (embedType === 1 && axisEl.EMBEDDEDDATA?.['@mmedaddress']) {
    const emb = axisEl.EMBEDDEDDATA
    const addr = parseInt(emb['@mmedaddress'], 16)
    const fileOffset = addr + romBaseOffset
    const sizeBits = parseInt(emb['@mmedelementsizebits'] ?? '16', 10)
    const dataType = resolveDataType(sizeBits, tableFlags, defaults)
    const endianness = resolveEndianness(tableFlags, defaults)

    const result = {
      source: 'address',
      offset: fileOffset,
      length: indexCount,
      dataType,
      endianness,
    }
    if (unitsText) { result.label = unitsText; result.unit = unitsText }
    if (!math.expression) result.scale = { factor: math.factor, offset: math.offset }
    return result
  }

  const result = { source: 'index', scale: { factor: 1, offset: 0 } }
  if (unitsText) { result.label = unitsText; result.unit = unitsText }
  return result
}

// ─── XDF → MapDefinition[] ────────────────────────────────────────────────────

function processXdf(xdfPath, xdfName, ecuType, softwareVersion) {
  const xml = readFileSync(xdfPath, 'utf8')
  const parser = new XMLParser(FXP_OPTS)
  const root = parser.parse(xml).XDFFORMAT
  const header = root.XDFHEADER

  // Base offset
  const baseOffsetEl = header.BASEOFFSET
  const baseOff = parseInt(baseOffsetEl?.['@offset'] ?? '0', 16)
  const subtract = (baseOffsetEl?.['@subtract'] ?? '0') === '1'
  const romBaseOffset = subtract ? -baseOff : baseOff

  const defaults = header.DEFAULTS ?? {}

  // Categories
  const categories = new Map()
  for (const cat of header.CATEGORY ?? []) {
    const idx = parseInt(cat['@index'] ?? '0', 16)
    const name = cat['@name'] ?? ''
    if (name) categories.set(idx, name)
  }

  const definitions = []
  const warnings = []

  // ── Tables ─────────────────────────────────────────────────────────────────
  for (const tableEl of root.XDFTABLE ?? []) {
    const title = typeof tableEl.title === 'string' ? tableEl.title.trim() : ''
    if (!title || title.startsWith('---')) continue // skip separator entries

    const axes = new Map()
    for (const axisEl of tableEl.XDFAXIS ?? []) {
      const id = axisEl['@id']
      if (id) axes.set(id, axisEl)
    }

    const zEl = axes.get('z')
    if (!zEl?.EMBEDDEDDATA?.['@mmedaddress']) continue

    const zEmb = zEl.EMBEDDEDDATA
    const addr = parseInt(zEmb['@mmedaddress'], 16)
    const fileOffset = addr + romBaseOffset
    if (fileOffset < 0) continue

    const rows = parseInt(zEmb['@mmedrowcount'] ?? '1', 10)
    const cols = parseInt(zEmb['@mmedcolcount'] ?? '1', 10)
    const sizeBits = parseInt(zEmb['@mmedelementsizebits'] ?? '16', 10)
    if (rows < 1 || cols < 1) continue

    const tableFlags = tableEl['@flags']
    const dataType = resolveDataType(sizeBits, tableFlags, defaults)
    const endianness = resolveEndianness(tableFlags, defaults)

    const mathEq = zEl.MATH?.['@equation'] ?? ''
    const math = mathEq ? parseMathEquation(mathEq) : { factor: 1, offset: 0 }

    const categoryIndices = (tableEl.CATEGORYMEM ?? []).map((cm) =>
      parseInt(cm['@category'] ?? '0', 10),
    )
    const categoryName = categoryIndices.length > 0 ? categories.get(categoryIndices[0]) : undefined
    const description = typeof tableEl.description === 'string' ? tableEl.description.trim() : ''
    const category = guessCategory(title, description, categoryName)

    const unitsText = typeof zEl.units === 'string' ? zEl.units.trim() : ''
    const value = { factor: math.factor, offset: math.offset }
    if (unitsText) value.unit = unitsText
    if (math.expression) value.expression = math.expression

    const def = {
      id: generateMapId({ name: title, offset: fileOffset }),
      name: title,
      category,
      offset: fileOffset,
      rows,
      cols,
      dataType,
      endianness,
      value,
      source: { type: 'internal', name: xdfName, version: softwareVersion },
      compatibility: {
        ecu: ecuType,
        softwareVersion,
        expectedFileSize: 524288,
      },
      confidence: 'definition',
    }

    if (description) def.description = description

    const xAxis = normalizeAxis(axes.get('x'), tableFlags, defaults, romBaseOffset)
    if (xAxis) def.xAxis = xAxis
    const yAxis = normalizeAxis(axes.get('y'), tableFlags, defaults, romBaseOffset)
    if (yAxis) def.yAxis = yAxis

    definitions.push(def)
  }

  // ── Constants ───────────────────────────────────────────────────────────────
  for (const constEl of root.XDFCONSTANT ?? []) {
    const title = typeof constEl.title === 'string' ? constEl.title.trim() : ''
    if (!title) continue

    const emb = constEl.EMBEDDEDDATA
    if (!emb?.['@mmedaddress']) continue

    const addr = parseInt(emb['@mmedaddress'], 16)
    const fileOffset = addr + romBaseOffset
    if (fileOffset < 0) continue

    const sizeBits = parseInt(emb['@mmedelementsizebits'] ?? '8', 10)
    const constFlags = constEl['@flags']
    const dataType = resolveDataType(sizeBits, constFlags, defaults)
    const endianness = resolveEndianness(constFlags, defaults)

    const mathEq = constEl.MATH?.['@equation'] ?? ''
    const math = mathEq ? parseMathEquation(mathEq) : { factor: 1, offset: 0 }

    const unitsText = typeof constEl.units === 'string' ? constEl.units.trim() : ''
    const description = typeof constEl.description === 'string' ? constEl.description.trim() : ''
    const category = guessCategory(title, description)

    const value = { factor: math.factor, offset: math.offset }
    if (unitsText) value.unit = unitsText
    if (math.expression) value.expression = math.expression

    const def = {
      id: generateMapId({ name: title, offset: fileOffset }),
      name: title,
      category,
      offset: fileOffset,
      rows: 1,
      cols: 1,
      dataType,
      endianness,
      value,
      source: { type: 'internal', name: xdfName, version: softwareVersion },
      compatibility: {
        ecu: ecuType,
        softwareVersion,
        expectedFileSize: 524288,
      },
      confidence: 'definition',
    }

    if (description) def.description = description
    definitions.push(def)
  }

  return { definitions, warnings }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const JOBS = [
  {
    xdfPath: path.join(REPO_ROOT, 'local-fixtures/definitions/MS430069_512K.xdf'),
    xdfName: 'MS430069_512K.xdf',
    ecuType: 'MS43',
    softwareVersion: 'MS430069',
    outDir: path.join(REPO_ROOT, 'packages/definition-parser/src/internal/ms43'),
    outFile: 'ms430069.json',
    expectedRomSize: 524288,
  },
  {
    xdfPath: path.join(REPO_ROOT, 'local-fixtures/definitions/Siemens_MS42_01100C6_GER_512K.xdf'),
    xdfName: 'Siemens_MS42_01100C6_GER_512K.xdf',
    ecuType: 'MS42',
    softwareVersion: '0110C6',
    outDir: path.join(REPO_ROOT, 'packages/definition-parser/src/internal/ms42'),
    outFile: '0110c6.json',
    expectedRomSize: 524288,
  },
]

for (const job of JOBS) {
  process.stdout.write(`Processing ${job.xdfName}… `)

  try {
    const { definitions, warnings } = processXdf(
      job.xdfPath,
      job.xdfName,
      job.ecuType,
      job.softwareVersion,
    )

    mkdirSync(job.outDir, { recursive: true })
    const outPath = path.join(job.outDir, job.outFile)
    writeFileSync(outPath, JSON.stringify(definitions, null, 2))

    console.log(`done. ${definitions.length} definitions → ${outPath}`)
    if (warnings.length > 0) {
      for (const w of warnings) console.warn('  warning:', w)
    }
  } catch (err) {
    console.error(`FAILED: ${err.message}`)
  }
}
