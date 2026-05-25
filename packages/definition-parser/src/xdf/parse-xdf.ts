// TunerPro XDF raw parser – browser/worker only (uses DOMParser).
// Produces a typed XdfFile structure; normalization to MapDefinition[] is in normalize-xdf.ts.

// ─── Raw XDF types ────────────────────────────────────────────────────────────

export interface XdfDefaults {
  dataSizeBits: number
  signed: boolean
  lsbFirst: boolean
  float: boolean
}

export interface XdfBaseOffset {
  offset: number
  subtract: boolean
}

export interface XdfHeader {
  title: string
  description: string
  author: string
  baseOffset: XdfBaseOffset
  defaults: XdfDefaults
  categories: Map<number, string>
}

export interface XdfEmbeddedData {
  address: number
  elementSizeBits: number
  rowCount: number
  colCount: number
  numElements: number
}

export interface XdfMath {
  equation: string
}

export type XdfAxisId = 'x' | 'y' | 'z'

export interface XdfAxis {
  id: XdfAxisId
  embeddedData?: XdfEmbeddedData
  indexCount: number
  embedType: number  // 0 = index-only, 1 = ROM-embedded
  units?: string
  math?: XdfMath
}

export interface XdfTable {
  uniqueId: string
  title: string
  description: string
  categoryIndices: number[]
  xAxis?: XdfAxis
  yAxis?: XdfAxis
  zAxis?: XdfAxis
  // Table-level flag bits: 0x08=lsbfirst, 0x10=signed, 0x20=float
  flags: number
}

export interface XdfConstant {
  uniqueId: string
  title: string
  description: string
  units?: string
  embeddedData?: XdfEmbeddedData
  math?: XdfMath
  flags: number
}

export interface XdfFile {
  header: XdfHeader
  tables: XdfTable[]
  constants: XdfConstant[]
  warnings: string[]
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function childText(el: Element, tag: string): string {
  return el.querySelector(`:scope > ${tag}`)?.textContent?.trim() ?? ''
}

function parseHexOrDec(val: string | null): number {
  if (!val) return 0
  const s = val.trim()
  if (s.startsWith('0x') || s.startsWith('0X')) return parseInt(s, 16)
  return parseInt(s, 10) || 0
}

function parseEmbeddedData(el: Element): XdfEmbeddedData | undefined {
  const emb = el.querySelector(':scope > EMBEDDEDDATA')
  if (!emb) return undefined
  return {
    address: parseHexOrDec(emb.getAttribute('mmedaddress')),
    elementSizeBits: parseInt(emb.getAttribute('mmedelementsizebits') ?? '16', 10),
    rowCount: parseInt(emb.getAttribute('mmedrowcount') ?? '1', 10),
    colCount: parseInt(emb.getAttribute('mmedcolcount') ?? '1', 10),
    numElements: parseInt(emb.getAttribute('mmednumelements') ?? '1', 10),
  }
}

function parseMath(el: Element): XdfMath | undefined {
  const math = el.querySelector(':scope > MATH')
  if (!math) return undefined
  // Equation can be in attribute or child <equation> element
  const eq =
    math.getAttribute('equation') ??
    math.querySelector(':scope > equation')?.textContent?.trim()
  if (!eq) return undefined
  return { equation: eq.trim() }
}

function parseAxis(el: Element): XdfAxis {
  const id = (el.getAttribute('id') ?? 'z') as XdfAxisId
  const embedInfo = el.querySelector(':scope > embedinfo')
  const embedType = parseInt(embedInfo?.getAttribute('type') ?? '0', 10)
  const indexCount = parseInt(childText(el, 'indexcount') || '1', 10)
  const unitsText = childText(el, 'units')

  const axis: XdfAxis = {
    id,
    indexCount,
    embedType,
  }

  const embeddedData = parseEmbeddedData(el)
  if (embeddedData !== undefined) axis.embeddedData = embeddedData

  if (unitsText) axis.units = unitsText

  const math = parseMath(el)
  if (math !== undefined) axis.math = math

  return axis
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseXdf(xmlText: string): XdfFile {
  const warnings: string[] = []

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  } catch {
    throw new Error('XDF: XML parse failed')
  }

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`XDF: XML error – ${parseError.textContent?.slice(0, 120)}`)
  }

  const root = doc.documentElement
  if (root.tagName !== 'XDFFORMAT') {
    throw new Error(`XDF: Expected <XDFFORMAT>, got <${root.tagName}>`)
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  const headerEl = root.querySelector(':scope > XDFHEADER')
  if (!headerEl) throw new Error('XDF: Missing XDFHEADER')

  const baseOffsetEl = headerEl.querySelector(':scope > baseoffset')
  const baseOffset: XdfBaseOffset = {
    offset: parseHexOrDec(baseOffsetEl?.getAttribute('offset') ?? '0'),
    subtract: (baseOffsetEl?.getAttribute('subtract') ?? '0') === '1',
  }

  const defaultsEl = headerEl.querySelector(':scope > DEFAULTS')
  const defaults: XdfDefaults = {
    dataSizeBits: parseInt(defaultsEl?.getAttribute('datasizeinbits') ?? '16', 10),
    signed: (defaultsEl?.getAttribute('signed') ?? '0') === '1',
    lsbFirst: (defaultsEl?.getAttribute('lsbfirst') ?? '0') === '1',
    float: (defaultsEl?.getAttribute('float') ?? '0') === '1',
  }

  const categories = new Map<number, string>()
  Array.from(headerEl.querySelectorAll(':scope > CATEGORY')).forEach((cat) => {
    const idx = parseHexOrDec(cat.getAttribute('index'))
    const name = cat.getAttribute('name') ?? ''
    if (name) categories.set(idx, name)
  })

  const header: XdfHeader = {
    title: childText(headerEl, 'deftitle'),
    description: childText(headerEl, 'description'),
    author: childText(headerEl, 'author'),
    baseOffset,
    defaults,
    categories,
  }

  // ── Tables ─────────────────────────────────────────────────────────────────

  const tables: XdfTable[] = []
  Array.from(root.querySelectorAll(':scope > XDFTABLE')).forEach((tableEl) => {
    const title = childText(tableEl, 'title')
    if (!title) {
      warnings.push(`XDFTABLE without title skipped (uniqueid=${tableEl.getAttribute('uniqueid')})`)
      return
    }

    const categoryIndices: number[] = []
    Array.from(tableEl.querySelectorAll(':scope > CATEGORYMEM')).forEach((cm) => {
      categoryIndices.push(parseHexOrDec(cm.getAttribute('category')))
    })

    const axes = new Map<XdfAxisId, XdfAxis>()
    Array.from(tableEl.querySelectorAll(':scope > XDFAXIS')).forEach((axisEl) => {
      const axis = parseAxis(axisEl)
      axes.set(axis.id, axis)
    })

    if (!axes.has('z')) {
      warnings.push(`Table "${title}" has no Z axis – skipped`)
      return
    }

    const table: XdfTable = {
      uniqueId: tableEl.getAttribute('uniqueid') ?? '',
      title,
      description: childText(tableEl, 'description'),
      categoryIndices,
      zAxis: axes.get('z')!,  // presence checked above
      flags: parseHexOrDec(tableEl.getAttribute('flags')),
    }

    const xAxis = axes.get('x')
    if (xAxis !== undefined) table.xAxis = xAxis

    const yAxis = axes.get('y')
    if (yAxis !== undefined) table.yAxis = yAxis

    tables.push(table)
  })

  // ── Constants ──────────────────────────────────────────────────────────────

  const constants: XdfConstant[] = []
  Array.from(root.querySelectorAll(':scope > XDFCONSTANT')).forEach((constEl) => {
    const title = childText(constEl, 'title')
    if (!title) return

    const constant: XdfConstant = {
      uniqueId: constEl.getAttribute('uniqueid') ?? '',
      title,
      description: childText(constEl, 'description'),
      flags: parseHexOrDec(constEl.getAttribute('flags')),
    }

    const unitsText = childText(constEl, 'units')
    if (unitsText) constant.units = unitsText

    const embeddedData = parseEmbeddedData(constEl)
    if (embeddedData !== undefined) constant.embeddedData = embeddedData

    const math = parseMath(constEl)
    if (math !== undefined) constant.math = math

    constants.push(constant)
  })

  if (tables.length === 0 && constants.length === 0) {
    warnings.push('XDF contains no tables or constants')
  }

  return { header, tables, constants, warnings }
}
