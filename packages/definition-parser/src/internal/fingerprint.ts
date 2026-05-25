// ROM fingerprinting: identifies ECU type and software version from a raw binary buffer.
// All checks are synchronous and operate only on the buffer (no I/O).

export type InternalECU = 'MS42' | 'MS43' | 'MS45'

export interface FingerprintResult {
  ecu: InternalECU | null
  softwareVersion: string | null
  confidence: number // 0–1
}

interface FingerprintEntry {
  ecu: InternalECU
  softwareVersion: string
  fileSize: number
  // Each check: offset into the file + expected byte values. All must match.
  checks: Array<{ offset: number; bytes: ReadonlyArray<number> }>
}

// ─── Known ROM fingerprints ───────────────────────────────────────────────────
// Version strings are ASCII-encoded in the ROM at fixed offsets.
// Verified against local stock ROMs in local-fixtures/.

const FINGERPRINTS: ReadonlyArray<FingerprintEntry> = [
  {
    ecu: 'MS43',
    softwareVersion: 'MS430069',
    fileSize: 524288,
    checks: [
      // "430069" ASCII at file offset 0x70042 (verified against stock ROM)
      { offset: 0x70042, bytes: [0x34, 0x33, 0x30, 0x30, 0x36, 0x39] },
    ],
  },
  {
    ecu: 'MS42',
    softwareVersion: '0110C6',
    fileSize: 524288,
    checks: [
      // "0110C6" ASCII at file offset 0x48008 (verified against stock ROM)
      { offset: 0x48008, bytes: [0x30, 0x31, 0x31, 0x30, 0x43, 0x36] },
    ],
  },
]

// ─── Public API ───────────────────────────────────────────────────────────────

export function fingerprintROM(buffer: Uint8Array): FingerprintResult {
  for (const fp of FINGERPRINTS) {
    if (buffer.byteLength !== fp.fileSize) continue

    let matched = 0
    for (const check of fp.checks) {
      if (check.offset + check.bytes.length > buffer.byteLength) continue
      if (check.bytes.every((b, i) => buffer[check.offset + i] === b)) matched++
    }

    if (matched === fp.checks.length && fp.checks.length > 0) {
      return { ecu: fp.ecu, softwareVersion: fp.softwareVersion, confidence: 1.0 }
    }
  }

  return { ecu: null, softwareVersion: null, confidence: 0 }
}
