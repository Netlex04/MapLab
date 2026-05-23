'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { useEditorStore } from '@/stores/editor-store'
import type { MapGroup } from '@/lib/editor/types'

const GROUP_META: Record<MapGroup, { label: string; dot: string }> = {
  TORQUE:   { label: 'Torque',   dot: 'bg-amber-500' },
  FUEL:     { label: 'Fuel',     dot: 'bg-green-500' },
  IGNITION: { label: 'Ignition', dot: 'bg-orange-500' },
  VVT:      { label: 'VVT',      dot: 'bg-cyan-500' },
  OTHER:    { label: 'Other',    dot: 'bg-muted-foreground' },
}

const GROUP_ORDER: MapGroup[] = ['TORQUE', 'FUEL', 'IGNITION', 'VVT', 'OTHER']

export function MapTreePanel() {
  const { parsedECU, activeMapId, pendingChanges, setActiveMap } = useEditorStore()
  const [query, setQuery] = useState('')

  if (!parsedECU) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse font-mono text-label uppercase tracking-wider text-muted-foreground">
          Loading…
        </span>
      </div>
    )
  }

  const filtered = parsedECU.maps.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()),
  )

  const grouped = GROUP_ORDER.reduce<Record<string, typeof filtered>>((acc, g) => {
    const maps = filtered.filter((m) => m.group === g)
    if (maps.length) acc[g] = maps
    return acc
  }, {})

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-border p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search maps…"
          className="h-7 font-mono text-xs"
        />
      </div>

      {/* Map list */}
      <div className="flex-1 overflow-y-auto py-1">
        {Object.entries(grouped).map(([group, maps]) => {
          const meta = GROUP_META[group as MapGroup]
          return (
            <div key={group}>
              {/* Group header */}
              <div className="flex items-center gap-1.5 px-3 pb-0.5 pt-2">
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                <span className="font-mono text-label uppercase tracking-widest text-muted-foreground">
                  {meta.label}
                </span>
              </div>
              {/* Maps */}
              {maps.map((map) => {
                const active = map.id === activeMapId
                const changed = (pendingChanges.get(map.id)?.length ?? 0) > 0
                return (
                  <button
                    key={map.id}
                    onClick={() => setActiveMap(map.id)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? 'bg-amber-500/8 text-amber-400'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{map.name}</span>
                    {changed && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="px-3 py-4 font-mono text-label uppercase tracking-wider text-muted-foreground">
            No maps found
          </p>
        )}
      </div>
    </div>
  )
}
