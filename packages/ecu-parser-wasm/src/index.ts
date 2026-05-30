/**
 * ECU Parser WASM Interface
 *
 * In Phase 2 wird dieses Modul aus dem Rust-Workspace (packages/ecu-parser) gebaut.
 * Bis dahin: JavaScript-basierte Stub-Implementierung für Entwicklung und Tests.
 *
 * Build: wasm-pack build packages/ecu-parser --target web --out-dir packages/ecu-parser-wasm/wasm
 */

import type { ParsedECU, HexSlice, BinaryDiff, FileFormat, ECUMap } from '@maplab/types'

export type { ParsedECU, HexSlice, BinaryDiff }

// ─── WASM Loader ──────────────────────────────────────────────────────────────

let wasmModule: WasmModule | null = null

interface WasmModule {
  ECUParser: {
    new(buffer: Uint8Array, format: string): WasmECUParser
  }
}

interface WasmECUParser {
  extract_maps(): unknown
  get_hex_slice(offset: number, length: number): unknown
  checksum(): string
  fast_diff(other: WasmECUParser): unknown
  write_map_values(mapId: string, values: number[][]): Uint8Array
  free(): void
}

async function loadWasm(): Promise<WasmModule | null> {
  try {
    // The WASM files are served as static assets from /wasm/ (apps/web/public/wasm/).
    // Absolute URL works in both the main thread and web workers, and is compatible
    // with Turbopack (dev) and webpack (prod) without special bundler config.
    // If the file is absent (local dev without a build), the catch block falls back to the JS stub.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const wasm = await import(/* webpackIgnore: true *//* turbopackIgnore: true */ '/wasm/ecu_parser.js')
    await wasm.default()
    return wasm as WasmModule
  } catch {
    // WASM nicht verfügbar – Stub-Modus aktiv
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function parseECU(buffer: Uint8Array, format: FileFormat): Promise<ParsedECU> {
  if (!wasmModule) {
    wasmModule = await loadWasm()
  }

  if (wasmModule) {
    const parser = new wasmModule.ECUParser(buffer, format)
    const result = parser.extract_maps() as ParsedECU
    parser.free()
    return result
  }

  // Stub-Fallback: minimale Metadaten ohne echtes Parsing
  return {
    format,
    size: buffer.byteLength,
    checksum: await computeChecksumFallback(buffer),
    maps: [],
    detectedEcu: null,
    confidence: 0,
    warnings: [],
  }
}

export async function getHexSlice(
  buffer: Uint8Array,
  offset: number,
  length: number,
): Promise<HexSlice> {
  const slice = buffer.slice(offset, offset + length)
  const ascii = Array.from(slice).map((b) =>
    b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.',
  )
  return { offset, bytes: slice, ascii }
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Apply pending map edits to a copy of the ECU buffer.
 *
 * WASM path: delegates to the Rust ECUParser which maintains map state and
 * writes uint16 big-endian values (Motorola byte order, standard for MS4X).
 *
 * JS fallback: same encoding applied in TypeScript using DataView – used
 * when the WASM module hasn't been built yet (`wasm-pack build` not run).
 *
 * Build command:
 *   wasm-pack build packages/ecu-parser --target web --out-dir packages/ecu-parser-wasm/wasm
 */
export async function writeMapValues(
  buffer: Uint8Array,
  maps: ECUMap[],
  changes: Record<string, number[][]>,
): Promise<Uint8Array> {
  // The WASM write path is intentionally bypassed: the WASM extract_maps()
  // populates its internal registry using WASM-internal definitions, which
  // produce different map IDs than the TypeScript definition-parser. As a
  // result, write_map_values never finds the map and silently returns the
  // original buffer unchanged (same checksum → same FileVersion on commit).
  // The JS implementation below is authoritative for all write operations.

  // JS fallback – reverse-scale and write with correct dataType/endianness
  const output = buffer.slice()
  const view = new DataView(output.buffer)
  for (const [mapId, values] of Object.entries(changes)) {
    const map = maps.find((m) => m.id === mapId)
    if (!map) continue

    const factor     = map.scaleFactor ?? 1
    const offset     = map.scaleOffset ?? 0
    const dataType   = map.dataType    ?? 'uint16'
    const le         = (map.endianness ?? 'big') === 'little'
    const bw         = _byteWidth(dataType)

    for (let row = 0; row < values.length; row++) {
      for (let col = 0; col < (values[row]?.length ?? 0); col++) {
        const scaledVal  = values[row]![col]!
        // Reverse the scaling: raw = (scaled - scaleOffset) / scaleFactor
        const rawVal     = factor !== 0 ? (scaledVal - offset) / factor : scaledVal
        const byteOffset = map.offset + (row * map.cols + col) * bw
        if (byteOffset + bw > output.byteLength) continue
        _writeValue(view, byteOffset, dataType, le, rawVal)
      }
    }
  }
  return output
}

function _byteWidth(dataType: string): number {
  switch (dataType) {
    case 'uint8':  case 'int8':               return 1
    case 'uint16': case 'int16':              return 2
    case 'uint32': case 'int32':
    case 'float32':                           return 4
    default:                                  return 2
  }
}

function _writeValue(view: DataView, offset: number, dataType: string, le: boolean, value: number): void {
  switch (dataType) {
    case 'uint8':   view.setUint8(offset,  Math.max(0,       Math.min(255,   Math.round(value)))); break
    case 'int8':    view.setInt8(offset,   Math.max(-128,    Math.min(127,   Math.round(value)))); break
    case 'uint16':  view.setUint16(offset, Math.max(0,       Math.min(65535, Math.round(value))), le); break
    case 'int16':   view.setInt16(offset,  Math.max(-32768,  Math.min(32767, Math.round(value))), le); break
    case 'uint32':  view.setUint32(offset, Math.max(0,                       Math.round(value)),  le); break
    case 'int32':   view.setInt32(offset,                                    Math.round(value),   le); break
    case 'float32': view.setFloat32(offset,                                  value,               le); break
  }
}

export async function computeDiff(base: Uint8Array, modified: Uint8Array): Promise<BinaryDiff> {
  const [baseChecksum, modChecksum] = await Promise.all([
    computeChecksumFallback(base),
    computeChecksumFallback(modified),
  ])

  const changedRanges: BinaryDiff['changedRanges'] = []
  let inRange = false
  let rangeStart = 0
  let totalChanged = 0

  const len = Math.max(base.length, modified.length)
  for (let i = 0; i < len; i++) {
    const changed = base[i] !== modified[i]
    if (changed && !inRange) {
      inRange = true
      rangeStart = i
    } else if (!changed && inRange) {
      changedRanges.push({ offset: rangeStart, length: i - rangeStart })
      totalChanged += i - rangeStart
      inRange = false
    }
  }
  if (inRange) {
    changedRanges.push({ offset: rangeStart, length: len - rangeStart })
    totalChanged += len - rangeStart
  }

  return {
    baseChecksum,
    modifiedChecksum: modChecksum,
    changedRanges,
    totalChangedBytes: totalChanged,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function computeChecksumFallback(buffer: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer as unknown as BufferSource)
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // Node.js Fallback
  const { createHash } = await import('crypto')
  return createHash('sha256').update(buffer).digest('hex')
}
