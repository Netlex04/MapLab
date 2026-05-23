'use client'

import { Layers, Search, ChevronRight } from 'lucide-react'
import { useEditorStore } from '@/lib/editor/store'
import type { MapType } from '@maplab/types'

// ─── Map-Typ Labels ───────────────────────────────────────────────────────────

const MAP_TYPE_LABELS: Record<MapType, string> = {
  INJECTION: 'Injection',
  IGNITION: 'Ignition',
  BOOST: 'Boost',
  LAMBDA: 'Lambda',
  TORQUE: 'Torque',
  DRIVER_WISH: 'Driver Wish',
  FUEL_CUTOFF: 'Fuel Cutoff',
  UNKNOWN: 'Unknown',
}

// ─── Skeleton Placeholder (während Parsing) ───────────────────────────────────

function SidebarSkeleton() {
  return (
    <div className="p-3 space-y-1.5 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-7 rounded bg-muted/30"
          style={{ width: `${60 + (i % 3) * 15}%` }}
        />
      ))}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function SidebarEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
      <Layers className="size-8 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        Datei hochladen um Maps zu sehen
      </p>
    </div>
  )
}

// ─── Map List ─────────────────────────────────────────────────────────────────

function MapList() {
  const parsedECU = useEditorStore((s) => s.parsedECU)
  const activeMapId = useEditorStore((s) => s.activeMapId)
  const setActiveMap = useEditorStore((s) => s.setActiveMap)
  const pendingChanges = useEditorStore((s) => s.pendingChanges)

  if (!parsedECU) return null

  // Maps nach Typ gruppieren
  const grouped = parsedECU.maps.reduce<Record<string, typeof parsedECU.maps>>(
    (acc, map) => {
      const key = map.type ?? 'UNKNOWN'
      if (!acc[key]) acc[key] = []
      acc[key]!.push(map)
      return acc
    },
    {},
  )

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {Object.entries(grouped).map(([type, maps]) => (
        <div key={type}>
          <div className="px-2 py-1.5 flex items-center gap-1">
            <ChevronRight className="size-3 text-muted-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {MAP_TYPE_LABELS[type as MapType] ?? type}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground/60 font-mono">
              {maps.length}
            </span>
          </div>
          {maps.map((map) => {
            const isActive = map.id === activeMapId
            const isModified = !!pendingChanges[map.id]
            return (
              <button
                key={map.id}
                onClick={() => setActiveMap(map.id)}
                className={[
                  'w-full text-left px-3 py-1.5 rounded text-xs flex items-center gap-2',
                  'transition-colors duration-100',
                  isActive
                    ? 'bg-amber-400/10 text-amber-400'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                ].join(' ')}
              >
                <span className="truncate flex-1">
                  {map.aiLabel ?? map.name ?? `Map @ 0x${map.offset.toString(16).toUpperCase()}`}
                </span>
                {isModified && (
                  <span className="size-1.5 rounded-full bg-orange-400 shrink-0" title="Geändert" />
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditorSidebar() {
  const status = useEditorStore((s) => s.status)
  const parsedECU = useEditorStore((s) => s.parsedECU)

  return (
    <aside className="flex flex-col w-52 shrink-0 border-r border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border shrink-0">
        <Layers className="size-3.5 text-muted-foreground/60" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Maps
        </span>
        {parsedECU && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
            {parsedECU.maps.length}
          </span>
        )}
      </div>

      {/* Search (Placeholder – Step 4) */}
      {parsedECU && (
        <div className="px-2 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 h-7 rounded bg-secondary px-2">
            <Search className="size-3 text-muted-foreground/50 shrink-0" />
            <span className="text-xs text-muted-foreground/50">Maps suchen…</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {status === 'parsing' && <SidebarSkeleton />}
        {status === 'idle' && <SidebarEmpty />}
        {status === 'ready' && <MapList />}
        {status === 'error' && (
          <div className="p-3 text-xs text-destructive">
            Fehler beim Parsen der Datei.
          </div>
        )}
      </div>
    </aside>
  )
}
