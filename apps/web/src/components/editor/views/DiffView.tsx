'use client'

import { useMemo } from 'react'
import { GitCompare } from 'lucide-react'
import { useEditorStore } from '@/lib/editor/store'
import type { ECUMap } from '@maplab/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAP_TYPE_LABELS: Record<string, string> = {
  INJECTION:   'Injection',
  IGNITION:    'Ignition',
  BOOST:       'Boost',
  LAMBDA:      'Lambda',
  TORQUE:      'Torque',
  DRIVER_WISH: 'Driver Wish',
  FUEL_CUTOFF: 'Fuel Cutoff',
  UNKNOWN:     'Unknown',
}

function fmt(n: number): string {
  return parseFloat(n.toPrecision(4)).toString()
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function NoChangesState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="size-12 rounded-lg bg-secondary flex items-center justify-center">
        <GitCompare className="size-5 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Keine Änderungen</p>
        <p className="text-xs text-muted-foreground mt-1">
          Bearbeite Map-Werte, um den Diff hier zu sehen.
        </p>
      </div>
    </div>
  )
}

// ─── Diff Grid ─────────────────────────────────────────────────────────────────

interface DiffGridProps {
  baseline: number[][]
  modified: number[][]
  rows: number
  cols: number
}

function DiffGrid({ baseline, modified, rows, cols }: DiffGridProps) {
  const cellW   = cols <= 8 ? 72 : cols <= 16 ? 60 : 52
  const rowHdrW = 40

  return (
    <div className="overflow-auto" style={{ maxHeight: 320 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${rowHdrW}px repeat(${cols}, ${cellW}px)`,
          minWidth: rowHdrW + cols * cellW,
        }}
      >
        {/* ── Column header ── */}
        <div className="h-7 sticky top-0 z-20 bg-card border-b border-border" />
        {Array.from({ length: cols }, (_, c) => (
          <div
            key={c}
            className="h-7 sticky top-0 z-20 flex items-center justify-center bg-card border-b border-border font-mono text-[10px] text-muted-foreground/50"
          >
            {c + 1}
          </div>
        ))}

        {/* ── Data rows ── */}
        {Array.from({ length: rows }, (_, r) => (
          <>
            <div
              key={`rh-${r}`}
              className="h-10 flex items-center justify-center bg-card border-b border-border/40 font-mono text-[10px] text-muted-foreground/50 sticky left-0 z-10"
            >
              {r + 1}
            </div>

            {Array.from({ length: cols }, (_, c) => {
              const oldV    = baseline[r]?.[c] ?? 0
              const newV    = modified[r]?.[c] ?? oldV
              const changed = newV !== oldV

              return (
                <div
                  key={`${r}-${c}`}
                  title={changed ? `${fmt(oldV)} → ${fmt(newV)}` : undefined}
                  className={[
                    'h-10 flex flex-col items-center justify-center border-b border-r border-border/20',
                    changed
                      ? 'bg-amber-500/15 ring-1 ring-inset ring-amber-500/40'
                      : 'bg-secondary/20',
                  ].join(' ')}
                >
                  {changed ? (
                    <>
                      <span className="font-mono text-[10px] text-amber-400/55 line-through leading-none tabular-nums">
                        {fmt(oldV)}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-amber-300 leading-none mt-0.5 tabular-nums">
                        {fmt(newV)}
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-[11px] text-muted-foreground/30 tabular-nums">
                      {fmt(oldV)}
                    </span>
                  )}
                </div>
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}

// ─── Map Card ─────────────────────────────────────────────────────────────────

interface DiffMapCardProps {
  map: ECUMap
  modified: number[][]
  changedCells: number
}

function DiffMapCard({ map, modified, changedCells }: DiffMapCardProps) {
  const label = map.aiLabel ?? map.name ?? `Map @ 0x${map.offset.toString(16).toUpperCase()}`

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card shrink-0">

      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-4 h-10 border-b border-border bg-secondary/40">
        <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">{label}</span>

        {map.type && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-sm">
            {MAP_TYPE_LABELS[map.type] ?? map.type}
          </span>
        )}

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="font-mono text-[11px] text-amber-400/80">
            {changedCells} Zelle{changedCells !== 1 ? 'n' : ''} geändert
          </span>
          <span className="font-mono text-[11px] text-muted-foreground/50">
            {map.rows}×{map.cols}
            {map.valueUnit ? ` [${map.valueUnit}]` : ''}
          </span>
        </div>
      </div>

      {/* ── Grid ── */}
      <DiffGrid
        baseline={map.values}
        modified={modified}
        rows={map.rows}
        cols={map.cols}
      />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DiffView() {
  const parsedECU      = useEditorStore((s) => s.parsedECU)
  const pendingChanges = useEditorStore((s) => s.pendingChanges)

  const changedMaps = useMemo(() => {
    if (!parsedECU) return []

    return Object.entries(pendingChanges).flatMap(([mapId, modified]) => {
      const map = parsedECU.maps.find((m) => m.id === mapId)
      if (!map) return []

      let changedCells = 0
      for (let r = 0; r < map.rows; r++) {
        for (let c = 0; c < map.cols; c++) {
          if ((map.values[r]?.[c] ?? 0) !== (modified[r]?.[c] ?? map.values[r]?.[c] ?? 0)) {
            changedCells++
          }
        }
      }

      return [{ map, modified, changedCells }]
    })
  }, [parsedECU, pendingChanges])

  if (changedMaps.length === 0) return <NoChangesState />

  const totalCells = changedMaps.reduce((s, m) => s + m.changedCells, 0)

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Summary header ── */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-border shrink-0 bg-card">
        <GitCompare className="size-4 text-amber-400/70 shrink-0" />
        <span className="text-sm font-medium text-foreground">
          {changedMaps.length} Map{changedMaps.length !== 1 ? 's' : ''} geändert
        </span>
        <span className="text-muted-foreground/50 text-xs">·</span>
        <span className="text-xs text-muted-foreground">
          {totalCells} Zelle{totalCells !== 1 ? 'n' : ''} insgesamt
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/70 font-mono">
            <span className="size-2 rounded-sm bg-amber-500/20 ring-1 ring-amber-500/40 inline-block" />
            geändert
          </span>
        </div>
      </div>

      {/* ── Map cards ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {changedMaps.map(({ map, modified, changedCells }) => (
          <DiffMapCard
            key={map.id}
            map={map}
            modified={modified}
            changedCells={changedCells}
          />
        ))}
      </div>

    </div>
  )
}
