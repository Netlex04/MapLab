'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Grid2x2 } from 'lucide-react'
import {
  useEditorStore,
  selectActiveMap,
  selectActiveMapValues,
  selectSafetyHighlights,
} from '@/lib/editor/store'
import type { SafetySeverity } from '@maplab/types'
import { MapCell } from './MapCell'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_TYPE_LABELS: Record<string, string> = {
  INJECTION: 'Injection',
  IGNITION: 'Ignition',
  BOOST: 'Boost',
  LAMBDA: 'Lambda',
  TORQUE: 'Torque',
  DRIVER_WISH: 'Driver Wish',
  FUEL_CUTOFF: 'Fuel Cutoff',
  UNKNOWN: 'Unknown',
}

// ─── Heat Helpers ─────────────────────────────────────────────────────────────

function heatLevel(value: number, min: number, range: number): 1 | 2 | 3 | 4 | 5 {
  if (range === 0) return 3
  const n = (value - min) / range
  return Math.min(5, Math.max(1, Math.ceil(n * 4) + 1)) as 1 | 2 | 3 | 4 | 5
}

// ─── No-Map State ─────────────────────────────────────────────────────────────

function NoMapState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="size-12 rounded-lg bg-secondary flex items-center justify-center">
        <Grid2x2 className="size-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">Keine Map ausgewählt</p>
    </div>
  )
}

// ─── Cell Position ────────────────────────────────────────────────────────────

interface Pos { row: number; col: number }

// ─── Component ────────────────────────────────────────────────────────────────

export function Map2DView() {
  const activeMap    = useEditorStore(selectActiveMap)
  const effectiveValues = useEditorStore(selectActiveMapValues)
  const safetyHighlights = useEditorStore(selectSafetyHighlights)
  const pendingChanges = useEditorStore((s) => s.pendingChanges)
  const setCellValue   = useEditorStore((s) => s.setCellValue)
  const selectCellFn   = useEditorStore((s) => s.selectCell)

  const [focused, setFocused] = useState<Pos | null>(null)
  const [editing, setEditing] = useState<Pos | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // Reset on map change
  useEffect(() => {
    setFocused(null)
    setEditing(null)
  }, [activeMap?.id])

  // ── Safety lookup ───────────────────────────────────────────────────────────

  const safetyLookup = useMemo(() => {
    const m: Record<string, SafetySeverity> = {}
    for (const h of safetyHighlights) {
      m[`${h.row}-${h.col}`] = h.severity
    }
    return m
  }, [safetyHighlights])

  // ── Heat levels ─────────────────────────────────────────────────────────────

  const heatGrid = useMemo(() => {
    if (!effectiveValues) return null
    const flat = effectiveValues.flat()
    if (flat.length === 0) return null
    const min = Math.min(...flat)
    const max = Math.max(...flat)
    const range = max - min
    return effectiveValues.map((row) => row.map((v) => heatLevel(v, min, range)))
  }, [effectiveValues])

  // ── Navigation ──────────────────────────────────────────────────────────────

  const moveFocus = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (!activeMap || !focused) return
      const { row, col } = focused
      const newPos: Pos = {
        up:    { row: Math.max(0, row - 1), col },
        down:  { row: Math.min(activeMap.rows - 1, row + 1), col },
        left:  { row, col: Math.max(0, col - 1) },
        right: { row, col: Math.min(activeMap.cols - 1, col + 1) },
      }[dir]
      setFocused(newPos)
      selectCellFn({ mapId: activeMap.id, ...newPos })
    },
    [activeMap, focused, selectCellFn],
  )

  const focusCell = useCallback(
    (pos: Pos) => {
      setFocused(pos)
      setEditing(null)
      if (activeMap) selectCellFn({ mapId: activeMap.id, ...pos })
      containerRef.current?.focus()
    },
    [activeMap, selectCellFn],
  )

  const commitEdit = useCallback(
    (row: number, col: number, value: number) => {
      if (!activeMap) return
      setCellValue({ mapId: activeMap.id, row, col }, value)
      setEditing(null)
      containerRef.current?.focus()
    },
    [activeMap, setCellValue],
  )

  const cancelEdit = useCallback(() => {
    setEditing(null)
    containerRef.current?.focus()
  }, [])

  // ── Keyboard Handler ────────────────────────────────────────────────────────

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (editing) return // MapCell handles keyboard while editing

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          moveFocus('up')
          break
        case 'ArrowDown':
          e.preventDefault()
          moveFocus('down')
          break
        case 'ArrowLeft':
          e.preventDefault()
          moveFocus('left')
          break
        case 'ArrowRight':
          e.preventDefault()
          moveFocus('right')
          break
        case 'Enter':
        case 'F2':
          if (focused) {
            e.preventDefault()
            setEditing(focused)
          }
          break
        case 'Escape':
          setFocused(null)
          break
        case 'c':
        case 'C':
          if ((e.metaKey || e.ctrlKey) && focused && effectiveValues) {
            e.preventDefault()
            const v = effectiveValues[focused.row]?.[focused.col]
            if (v !== undefined) navigator.clipboard.writeText(String(v)).catch(() => {})
          }
          break
        case 'v':
        case 'V':
          if ((e.metaKey || e.ctrlKey) && focused && activeMap) {
            e.preventDefault()
            navigator.clipboard
              .readText()
              .then((text) => {
                // Support tab/newline-separated paste (Excel-compatible)
                const rows = text.trim().split('\n')
                rows.forEach((rowStr, dr) => {
                  rowStr.split('\t').forEach((cell, dc) => {
                    const n = parseFloat(cell.trim())
                    if (!isNaN(n)) {
                      const r = focused.row + dr
                      const c = focused.col + dc
                      if (r < activeMap.rows && c < activeMap.cols) {
                        setCellValue({ mapId: activeMap.id, row: r, col: c }, n)
                      }
                    }
                  })
                })
              })
              .catch(() => {})
          }
          break
        case 'z':
        case 'Z':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            if (e.shiftKey) useEditorStore.getState().redo()
            else useEditorStore.getState().undo()
          }
          break
      }
    },
    [editing, focused, moveFocus, effectiveValues, activeMap, setCellValue],
  )

  // ── Early returns ───────────────────────────────────────────────────────────

  if (!activeMap || !effectiveValues || !heatGrid) return <NoMapState />

  const isMapModified = !!pendingChanges[activeMap.id]
  const originalValues = activeMap.values

  // Responsive cell sizing
  const cellW  = activeMap.cols <= 8 ? 72 : activeMap.cols <= 16 ? 60 : 52
  const rowHdrW = 40

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Map info header ── */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-border shrink-0 bg-card">
        <span className="text-sm font-medium text-foreground truncate">
          {activeMap.aiLabel ?? activeMap.name ?? `Map @ 0x${activeMap.offset.toString(16).toUpperCase()}`}
        </span>
        {activeMap.type && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-sm">
            {MAP_TYPE_LABELS[activeMap.type] ?? activeMap.type}
          </span>
        )}
        <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground/60">
          {activeMap.rows}×{activeMap.cols}
          {activeMap.valueUnit ? ` [${activeMap.valueUnit}]` : ''}
        </span>
      </div>

      {/* ── Scrollable grid ── */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex-1 overflow-auto outline-none bg-card"
      >
        {/* Axis labels row */}
        {(activeMap.xAxisLabel || activeMap.yAxisLabel) && (
          <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-card sticky top-0 z-40">
            {activeMap.yAxisLabel && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 w-10 shrink-0">
                {activeMap.yAxisLabel}
              </span>
            )}
            {activeMap.xAxisLabel && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {activeMap.xAxisLabel} →
              </span>
            )}
          </div>
        )}

        <div
          className="inline-grid border-l border-t border-border"
          style={{
            gridTemplateColumns: `${rowHdrW}px repeat(${activeMap.cols}, ${cellW}px)`,
            gridTemplateRows: `28px repeat(${activeMap.rows}, 28px)`,
          }}
        >
          {/* Corner */}
          <div className="sticky top-0 left-0 z-30 bg-card border-r border-b border-border" />

          {/* Column headers */}
          {Array.from({ length: activeMap.cols }, (_, c) => (
            <div
              key={`ch-${c}`}
              className="sticky top-0 z-20 bg-card border-r border-b border-border flex items-center justify-center font-mono text-[10px] text-muted-foreground/50 tabular-nums select-none"
            >
              {c}
            </div>
          ))}

          {/* Rows */}
          {effectiveValues.flatMap((row, r) => [
            // Row header
            <div
              key={`rh-${r}`}
              className="sticky left-0 z-10 bg-card border-r border-b border-border flex items-center justify-center font-mono text-[10px] text-muted-foreground/50 tabular-nums select-none"
            >
              {r}
            </div>,

            // Cells
            ...row.map((value, c) => {
              const isFocused  = focused?.row === r && focused?.col === c
              const isEditing  = editing?.row === r && editing?.col === c
              const safety     = safetyLookup[`${r}-${c}`] ?? null
              const heat       = (heatGrid[r]?.[c] ?? 3) as 1 | 2 | 3 | 4 | 5
              const origVal    = originalValues[r]?.[c] ?? value
              const isModified = isMapModified && value !== origVal

              return (
                <div key={`c-${r}-${c}`} className="border-r border-b border-border">
                  <MapCell
                    value={value}
                    isModified={isModified}
                    isSelected={isFocused}
                    isEditing={isEditing}
                    heatLevel={heat}
                    safetySeverity={safety}
                    onSelect={() => focusCell({ row: r, col: c })}
                    onActivate={() => { setFocused({ row: r, col: c }); setEditing({ row: r, col: c }) }}
                    onCommit={(v) => commitEdit(r, c, v)}
                    onCancel={cancelEdit}
                  />
                </div>
              )
            }),
          ])}
        </div>
      </div>

      {/* ── Footer: selected cell info ── */}
      {focused && effectiveValues[focused.row]?.[focused.col] !== undefined && (
        <div className="flex items-center gap-3 px-4 h-7 border-t border-border bg-card shrink-0 font-mono text-[10px] text-muted-foreground">
          <span className="tabular-nums">
            R{focused.row} C{focused.col}
          </span>
          <span className="text-muted-foreground/40">|</span>
          <span className="tabular-nums">
            {effectiveValues[focused.row]![focused.col]}
            {activeMap.valueUnit ? ` ${activeMap.valueUnit}` : ''}
          </span>
          {safetyLookup[`${focused.row}-${focused.col}`] && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span
                className={
                  safetyLookup[`${focused.row}-${focused.col}`] === 'critical'
                    ? 'text-red-400'
                    : safetyLookup[`${focused.row}-${focused.col}`] === 'warning'
                      ? 'text-orange-400'
                      : 'text-cyan-400'
                }
              >
                {safetyLookup[`${focused.row}-${focused.col}`]}
              </span>
            </>
          )}
          <span className="ml-auto text-muted-foreground/40">
            Doppelklick / Enter zum Bearbeiten
          </span>
        </div>
      )}
    </div>
  )
}
