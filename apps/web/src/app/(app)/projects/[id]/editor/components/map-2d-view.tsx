'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/stores/editor-store'
import { getHeatLevel, getHeatStyle } from '@/lib/editor/heatmap'
import type { EditorParsedMap } from '@/lib/editor/types'

interface Map2DViewProps {
  map: EditorParsedMap
}

export function Map2DView({ map }: Map2DViewProps) {
  const { activeMapId, pendingChanges, selectedCell, setSelectedCell, applyChange } =
    useEditorStore()
  const [editingCell, setEditingCell] = useState<[number, number] | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const changes = pendingChanges.get(map.id) ?? []

  const getCellValue = (row: number, col: number): number => {
    const change = changes.find((c) => c.row === row && c.col === col)
    return change ? change.newValue : (map.values[row]?.[col] ?? 0)
  }

  const isModified = (row: number, col: number): boolean =>
    changes.some((c) => c.row === row && c.col === col)

  const isSelected = (row: number, col: number): boolean =>
    selectedCell?.[0] === row && selectedCell?.[1] === col

  const startEdit = (row: number, col: number) => {
    setEditingCell([row, col])
    setEditValue(String(getCellValue(row, col)))
  }

  const commitEdit = useCallback(() => {
    if (!editingCell || activeMapId === null) return
    const [row, col] = editingCell
    const parsed = parseFloat(editValue)
    if (!isNaN(parsed)) {
      applyChange(activeMapId, row, col, parsed)
    }
    setEditingCell(null)
  }, [editingCell, editValue, activeMapId, applyChange])

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (editingCell) return
      if (!selectedCell) return

      const [row, col] = selectedCell
      const move = (dr: number, dc: number) => {
        const nr = Math.max(0, Math.min(map.rows - 1, row + dr))
        const nc = Math.max(0, Math.min(map.cols - 1, col + dc))
        setSelectedCell([nr, nc])
        e.preventDefault()
      }

      switch (e.key) {
        case 'ArrowUp':    return move(-1, 0)
        case 'ArrowDown':  return move(1, 0)
        case 'ArrowLeft':  return move(0, -1)
        case 'ArrowRight': return move(0, 1)
        case 'Enter':
          startEdit(row, col)
          e.preventDefault()
          return
        case 'Escape':
          setSelectedCell(null)
          return
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingCell, selectedCell, map.rows, map.cols],
  )

  const precision = map.unit === 'λ' ? 2 : map.unit.includes('°') ? 1 : 0

  return (
    <div
      ref={gridRef}
      role="grid"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="inline-block outline-none focus-visible:outline-none"
      aria-label={`${map.name} map grid`}
    >
      {/* x-axis labels */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `56px repeat(${map.cols}, minmax(52px, 1fr))` }}
      >
        {/* Corner */}
        <div className="flex items-end pb-1 pr-2">
          <span className="font-mono text-label text-muted-foreground/50">
            {map.yAxisLabel}↓ / {map.xAxisLabel}→
          </span>
        </div>
        {map.xAxisValues.map((v, ci) => (
          <div
            key={ci}
            className="pb-1 text-center font-mono text-label text-muted-foreground"
          >
            {v}
          </div>
        ))}
      </div>

      {/* Rows */}
      {map.values.map((rowVals, ri) => (
        <div
          key={ri}
          role="row"
          className="grid"
          style={{ gridTemplateColumns: `56px repeat(${map.cols}, minmax(52px, 1fr))` }}
        >
          {/* y-axis label */}
          <div className="flex items-center pr-2 font-mono text-label text-muted-foreground">
            {map.yAxisValues[ri]}
          </div>

          {rowVals.map((_, ci) => {
            const value = getCellValue(ri, ci)
            const level = getHeatLevel(value, map.min, map.max)
            const heatStyle = getHeatStyle(level)
            const modified = isModified(ri, ci)
            const selected = isSelected(ri, ci)
            const editing = editingCell?.[0] === ri && editingCell?.[1] === ci

            return (
              <div
                key={ci}
                role="gridcell"
                aria-selected={selected}
                style={heatStyle}
                onClick={() => {
                  setSelectedCell([ri, ci])
                  gridRef.current?.focus()
                }}
                onDoubleClick={() => startEdit(ri, ci)}
                className={`relative flex h-9 cursor-pointer select-none items-center justify-center border font-mono text-xs transition-colors ${
                  selected && !editing
                    ? 'border-amber-500 ring-1 ring-amber-500/50 z-10'
                    : modified
                      ? 'border-orange-500/60'
                      : 'border-border/40'
                }`}
              >
                {editing ? (
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                      if (e.key === 'Escape') { e.preventDefault(); setEditingCell(null) }
                      e.stopPropagation()
                    }}
                    className="absolute inset-0 w-full bg-secondary text-center font-mono text-xs text-foreground outline-none ring-1 ring-amber-500"
                  />
                ) : (
                  <span className={modified ? 'text-orange-400' : ''}>
                    {value.toFixed(precision)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Unit legend */}
      <div className="mt-2 flex items-center gap-4 font-mono text-label text-muted-foreground">
        <span>Unit: {map.unit}</span>
        <span>Min: {map.min}</span>
        <span>Max: {map.max}</span>
      </div>
    </div>
  )
}
