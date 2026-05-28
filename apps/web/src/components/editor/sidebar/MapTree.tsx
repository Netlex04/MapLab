'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, Search, X, ShieldAlert } from 'lucide-react'
import { useEditorStore } from '@/lib/editor/store'
import type { MapType, ECUMap } from '@maplab/types'
import { MapTreeItem } from './MapTreeItem'

// ─── Constants ────────────────────────────────────────────────────────────────

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

const TYPE_ORDER: MapType[] = [
  'INJECTION',
  'IGNITION',
  'BOOST',
  'LAMBDA',
  'TORQUE',
  'DRIVER_WISH',
  'FUEL_CUTOFF',
  'UNKNOWN',
]

// ─── Group Header ─────────────────────────────────────────────────────────────

interface GroupHeaderProps {
  type: MapType
  count: number
  isOpen: boolean
  onToggle: () => void
}

function GroupHeader({ type, count, isOpen, onToggle }: GroupHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full px-2 py-1.5 flex items-center gap-1 hover:bg-accent/40 rounded transition-colors duration-100 group"
    >
      <ChevronRight
        className={[
          'size-3 text-muted-foreground/50 transition-transform duration-150',
          isOpen ? 'rotate-90' : '',
        ].join(' ')}
      />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
        {MAP_TYPE_LABELS[type] ?? type}
      </span>
      <span className="ml-auto text-[10px] text-muted-foreground/60 font-mono tabular-nums">
        {count}
      </span>
    </button>
  )
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
}

function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex items-center h-7 rounded bg-secondary px-2 gap-2">
      <Search className="size-3 text-muted-foreground/50 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Maps suchen…"
        className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

// ─── Flat search results ──────────────────────────────────────────────────────

interface SearchResultsProps {
  maps: ECUMap[]
  activeMapId: string | null
  pendingChanges: Record<string, number[][]>
  setActiveMap: (id: string) => void
  query: string
}

function SearchResults({ maps, activeMapId, pendingChanges, setActiveMap, query }: SearchResultsProps) {
  const lq = query.toLowerCase()
  const filtered = maps.filter((m) => {
    const label = m.aiLabel ?? m.name ?? ''
    const offsetStr = `0x${m.offset.toString(16)}`
    return label.toLowerCase().includes(lq) || offsetStr.includes(lq)
  })

  if (filtered.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground/60 text-center">
        Keine Maps für „{query}"
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {filtered.map((map) => (
        <MapTreeItem
          key={map.id}
          map={map}
          isActive={map.id === activeMapId}
          isModified={!!pendingChanges[map.id]}
          onClick={() => setActiveMap(map.id)}
        />
      ))}
    </div>
  )
}

// ─── Mismatch Gate ────────────────────────────────────────────────────────────

interface MismatchGateProps {
  mapCount: number
  onConfirm: () => void
}

function MismatchGate({ mapCount, onConfirm }: MismatchGateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-3 py-4 text-center">
      <ShieldAlert className="size-6 text-destructive/70 shrink-0" />
      <p className="text-label text-muted-foreground leading-relaxed">
        Definition passt nicht zur ROM. Maps könnten falsche Werte enthalten.
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="text-label text-muted-foreground/60 underline underline-offset-2 hover:text-muted-foreground transition-colors"
      >
        {mapCount === 1 ? '1 Map trotzdem anzeigen' : `${mapCount} Maps trotzdem anzeigen`}
      </button>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapTree() {
  const parsedECU = useEditorStore((s) => s.parsedECU)
  const activeMapId = useEditorStore((s) => s.activeMapId)
  const setActiveMap = useEditorStore((s) => s.setActiveMap)
  const pendingChanges = useEditorStore((s) => s.pendingChanges)

  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<MapType>>(new Set())
  const [mismatchConfirmed, setMismatchConfirmed] = useState(false)

  const grouped = useMemo(() => {
    if (!parsedECU) return []
    const map: Partial<Record<MapType, ECUMap[]>> = {}
    for (const m of parsedECU.maps) {
      const key = (m.type ?? 'UNKNOWN') as MapType
      if (!map[key]) map[key] = []
      map[key]!.push(m)
    }
    return TYPE_ORDER.filter((t) => !!map[t]).map((t) => ({
      type: t,
      maps: map[t]!,
    }))
  }, [parsedECU])

  const toggleGroup = (type: MapType) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  if (!parsedECU) return null

  if (
    parsedECU.matchStatus === 'mismatch' &&
    parsedECU.maps.length > 0 &&
    !mismatchConfirmed
  ) {
    return (
      <MismatchGate
        mapCount={parsedECU.maps.length}
        onConfirm={() => {
          setMismatchConfirmed(true)
          setActiveMap(parsedECU.maps[0]!.id)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-2 py-2 border-b border-border shrink-0">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {/* Tree / Search Results */}
      <div className="flex-1 overflow-y-auto">
        {query.trim() ? (
          <SearchResults
            maps={parsedECU.maps}
            activeMapId={activeMapId}
            pendingChanges={pendingChanges}
            setActiveMap={setActiveMap}
            query={query.trim()}
          />
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {grouped.map(({ type, maps }) => {
              const isOpen = !collapsedGroups.has(type)
              return (
                <div key={type}>
                  <GroupHeader
                    type={type}
                    count={maps.length}
                    isOpen={isOpen}
                    onToggle={() => toggleGroup(type)}
                  />
                  {isOpen && (
                    <div className="flex flex-col gap-0.5 pl-1">
                      {maps.map((map) => (
                        <MapTreeItem
                          key={map.id}
                          map={map}
                          isActive={map.id === activeMapId}
                          isModified={!!pendingChanges[map.id]}
                          onClick={() => setActiveMap(map.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
