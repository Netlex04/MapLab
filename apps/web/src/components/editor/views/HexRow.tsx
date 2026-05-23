'use client'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface HexRowProps {
  offset: number
  bytes: number[]
  mapStart: number // -1 if no active map
  mapEnd: number   // exclusive; -1 if no active map
  isJumpTarget: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAscii(b: number): string {
  return b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'
}

// Pad bytes array to 16 entries; -1 signals an empty (padding) slot
function pad(bytes: number[]): number[] {
  if (bytes.length >= 16) return bytes
  return [...bytes, ...Array<number>(16 - bytes.length).fill(-1)]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HexRow({ offset, bytes, mapStart, mapEnd, isJumpTarget }: HexRowProps) {
  const padded = pad(bytes)

  return (
    <div
      className={[
        'flex items-center h-5 select-none',
        isJumpTarget ? 'bg-amber-400/15' : '',
      ].join(' ')}
    >
      {/* Offset */}
      <span className="shrink-0 w-[76px] pl-3 font-mono text-[11px] text-muted-foreground/40 tabular-nums">
        0x{offset.toString(16).toUpperCase().padStart(5, '0')}
      </span>

      {/* Separator */}
      <span className="shrink-0 pr-3 font-mono text-[11px] text-border">│</span>

      {/* Hex bytes – two groups of 8 with a visual gap */}
      <div className="flex shrink-0 gap-0.5 pr-3">
        {padded.map((b, i) => {
          const byteOffset = offset + i
          const inMap = b >= 0 && mapStart >= 0 && byteOffset >= mapStart && byteOffset < mapEnd
          return (
            <span
              key={i}
              className={[
                'w-[18px] text-center font-mono text-[11px] tabular-nums',
                i === 8 ? 'ml-2' : '',
                b < 0
                  ? 'text-transparent'
                  : inMap
                    ? 'text-amber-300'
                    : 'text-foreground/60',
              ].join(' ')}
            >
              {b < 0 ? '--' : b.toString(16).toUpperCase().padStart(2, '0')}
            </span>
          )
        })}
      </div>

      {/* Separator */}
      <span className="shrink-0 pr-3 font-mono text-[11px] text-border">│</span>

      {/* ASCII */}
      <div className="flex shrink-0">
        {padded.map((b, i) => {
          const byteOffset = offset + i
          const inMap = b >= 0 && mapStart >= 0 && byteOffset >= mapStart && byteOffset < mapEnd
          return (
            <span
              key={i}
              className={[
                'w-[9px] text-center font-mono text-[11px]',
                b < 0
                  ? 'text-transparent'
                  : inMap
                    ? 'text-amber-300'
                    : 'text-muted-foreground/35',
              ].join(' ')}
            >
              {b < 0 ? ' ' : toAscii(b)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
