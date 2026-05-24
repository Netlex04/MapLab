/**
 * ECU Parser Web Worker
 *
 * Läuft in einem separaten Thread – hält den UI-Thread frei beim Parsen
 * von ECU-Binärdateien (bis zu 1 MB) und beim Zurückschreiben von Map-Werten.
 *
 * Wenn das WASM-Modul noch nicht gebaut wurde, greift der ecu-parser-wasm
 * Stub automatisch als Fallback ein.
 */

import { parseECU, getHexSlice, writeMapValues } from '@maplab/ecu-parser-wasm'
import type { FileFormat, ParsedECU, ECUMap } from '@maplab/types'

// ─── Message Protocol ─────────────────────────────────────────────────────────

export type WorkerInbound =
  | { type: 'parse'; buffer: ArrayBuffer; format: FileFormat }
  | { type: 'write'; buffer: ArrayBuffer; maps: ECUMap[]; changes: Record<string, number[][]> }
  | { type: 'hex-slice'; buffer: ArrayBuffer; offset: number; length: number }

export type WorkerOutbound =
  | { type: 'parse:success'; result: ParsedECU }
  | { type: 'parse:error'; message: string }
  | { type: 'write:success'; buffer: ArrayBuffer }
  | { type: 'write:error'; message: string }
  | { type: 'hex-slice:success'; offset: number; bytes: number[]; ascii: string[] }
  | { type: 'hex-slice:error'; message: string }

// ─── Message Handler ──────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data

  switch (msg.type) {
    case 'parse': {
      try {
        const buffer = new Uint8Array(msg.buffer)
        const result = await parseECU(buffer, msg.format)
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
