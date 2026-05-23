export type HeatLevel = 1 | 2 | 3 | 4 | 5

export function getHeatLevel(value: number, min: number, max: number): HeatLevel {
  if (max === min) return 1
  const n = (value - min) / (max - min)
  if (n < 0.2) return 1
  if (n < 0.4) return 2
  if (n < 0.6) return 3
  if (n < 0.8) return 4
  return 5
}

export function getHeatStyle(level: HeatLevel): React.CSSProperties {
  switch (level) {
    case 1: return { backgroundColor: 'rgba(245,158,11,0.08)' }
    case 2: return { backgroundColor: 'rgba(245,158,11,0.16)' }
    case 3: return { backgroundColor: 'rgba(245,158,11,0.26)' }
    case 4: return { backgroundColor: 'rgba(245,158,11,0.38)', color: '#F59E0B' }
    case 5: return { backgroundColor: 'rgba(245,158,11,0.55)', color: '#0B0D11' }
  }
}

// Suppress the React import requirement — React.CSSProperties is resolved at compile time
import type React from 'react'
