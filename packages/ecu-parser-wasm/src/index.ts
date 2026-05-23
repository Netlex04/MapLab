/**
 * ECU Parser WASM Interface
 *
 * In Phase 2 wird dieses Modul aus dem Rust-Workspace (packages/ecu-parser) gebaut.
 * Bis dahin: JavaScript-basierte Stub-Implementierung für Entwicklung und Tests.
 *
 * Build: wasm-pack build packages/ecu-parser --target web --out-dir packages/ecu-parser-wasm/wasm
 */

import type { ParsedECU, HexSlice, BinaryDiff, FileFormat } from '@maplab/types'

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
    // Dynamischer Import – erst verfügbar nachdem `wasm-pack build` gelaufen ist
    const wasm = await import('../wasm/ecu_parser.js' as string)
    await wasm.default()
    return wasm as WasmModule
  } catch {
    // WASM noch nicht gebaut – Stub-Modus aktiv
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
