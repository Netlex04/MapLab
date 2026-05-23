'use client'

import type { ECUMap } from '@maplab/types'

interface MapTreeItemProps {
  map: ECUMap
  isActive: boolean
  isModified: boolean
  onClick: () => void
}

export function MapTreeItem({ map, isActive, isModified, onClick }: MapTreeItemProps) {
  const label = map.aiLabel ?? map.name ?? `Map @ 0x${map.offset.toString(16).toUpperCase()}`
  const dims = `${map.rows}×${map.cols}`

  return (
    <button
      onClick={onClick}
      title={label}
      className={[
        'group w-full text-left px-3 py-1.5 rounded flex items-center gap-2',
        'transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        isActive
          ? 'bg-amber-400/10 text-amber-400'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      ].join(' ')}
    >
      <span className="truncate flex-1 text-xs">{label}</span>

      <span
        className={[
          'shrink-0 font-mono text-[10px] tabular-nums transition-colors',
          isActive ? 'text-amber-400/60' : 'text-muted-foreground/40 group-hover:text-muted-foreground/60',
        ].join(' ')}
      >
        {dims}
      </span>

      {isModified && (
        <span
          className="size-1.5 rounded-full bg-orange-400 shrink-0"
          title="Geändert"
        />
      )}
    </button>
  )
}
