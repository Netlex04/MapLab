'use client'

import { useEffect, useRef } from 'react'
import type { SafetySeverity } from '@maplab/types'

// ─── Colour Helpers ───────────────────────────────────────────────────────────

// Heat level → RGBA background (layered on top of bg-card)
const HEAT_BG: Record<number, string> = {
  1: 'rgba(245,158,11,0.04)',
  2: 'rgba(245,158,11,0.12)',
  3: 'rgba(245,158,11,0.22)',
  4: 'rgba(245,158,11,0.38)',
  5: 'rgba(245,158,11,0.58)',
}

const HEAT_TEXT: Record<number, string> = {
  1: 'text-muted-foreground',
  2: 'text-muted-foreground',
  3: 'text-foreground',
  4: 'text-amber-300',
  5: 'text-[#0B0D11]',
}

const SAFETY_BG: Record<SafetySeverity, string> = {
  info:     'rgba(34,211,238,0.12)',
  warning:  'rgba(249,115,22,0.18)',
  critical: 'rgba(239,68,68,0.24)',
}

const SAFETY_TEXT: Record<SafetySeverity, string> = {
  info:     'text-cyan-400',
  warning:  'text-orange-400',
  critical: 'text-red-400',
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MapCellProps {
  value: number
  isModified: boolean
  isSelected: boolean
  isEditing: boolean
  heatLevel: 1 | 2 | 3 | 4 | 5
  safetySeverity: SafetySeverity | null
  onSelect: () => void
  onActivate: () => void
  onCommit: (value: number) => void
  onCancel: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapCell({
  value,
  isModified,
  isSelected,
  isEditing,
  heatLevel,
  safetySeverity,
  onSelect,
  onActivate,
  onCommit,
  onCancel,
}: MapCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const bg = safetySeverity ? SAFETY_BG[safetySeverity] : HEAT_BG[heatLevel]
  const textClass = safetySeverity ? SAFETY_TEXT[safetySeverity] : HEAT_TEXT[heatLevel]

  const ringClass = isSelected
    ? 'ring-1 ring-inset ring-amber-400 z-10'
    : isModified
      ? 'ring-1 ring-inset ring-orange-400/50'
      : ''

  if (isEditing) {
    return (
      <div className="relative" style={{ backgroundColor: bg }}>
        <input
          ref={inputRef}
          defaultValue={String(value)}
          className="w-full h-full px-1 text-center font-mono text-[11px] bg-secondary text-foreground outline-none ring-1 ring-inset ring-amber-400"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const n = parseFloat(e.currentTarget.value)
              if (!isNaN(n)) onCommit(n)
              else onCancel()
            } else if (e.key === 'Tab') {
              e.preventDefault()
              const n = parseFloat(e.currentTarget.value)
              if (!isNaN(n)) onCommit(n)
              else onCancel()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          onBlur={(e) => {
            const n = parseFloat(e.currentTarget.value)
            if (!isNaN(n)) onCommit(n)
            else onCancel()
          }}
        />
      </div>
    )
  }

  return (
    <div
      role="gridcell"
      aria-selected={isSelected}
      onClick={onSelect}
      onDoubleClick={onActivate}
      className={[
        'relative flex items-center justify-center cursor-default select-none',
        textClass,
        ringClass,
      ].join(' ')}
      style={{ backgroundColor: bg }}
    >
      <span className="font-mono text-[11px] truncate px-1 tabular-nums">{value}</span>
      {isModified && (
        <span className="absolute top-0.5 right-0.5 size-1 rounded-full bg-orange-400 shrink-0" />
      )}
    </div>
  )
}
