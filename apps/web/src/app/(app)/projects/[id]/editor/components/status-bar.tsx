'use client'

import { useEditorStore } from '@/stores/editor-store'

export function StatusBar() {
  const { parsedECU, activeMapId, selectedCell, pendingChanges } = useEditorStore()

  const activeMap = parsedECU?.maps.find((m) => m.id === activeMapId)

  let cellLabel = '—'
  let valueLabel = '—'
  let originalLabel = '—'
  let deltaLabel: string | null = null
  let isDelta = false

  if (activeMap && selectedCell) {
    const [row, col] = selectedCell
    cellLabel = `R${row + 1}:C${col + 1}`

    const changes = pendingChanges.get(activeMapId ?? '') ?? []
    const change = changes.find((c) => c.row === row && c.col === col)
    const original = activeMap.values[row]?.[col]

    if (original !== undefined) {
      originalLabel = `${original} ${activeMap.unit}`
      if (change) {
        valueLabel = `${change.newValue} ${activeMap.unit}`
        const delta = change.newValue - original
        deltaLabel = `${delta >= 0 ? '+' : ''}${delta.toFixed(original % 1 !== 0 ? 2 : 0)}`
        isDelta = true
      } else {
        valueLabel = `${original} ${activeMap.unit}`
      }
    }
  }

  const totalPending = [...pendingChanges.values()].reduce((s, c) => s + c.length, 0)

  return (
    <footer
      className="flex h-7 shrink-0 items-center justify-between border-t border-border px-4"
      style={{ backgroundColor: 'hsl(228 23% 9%)' }}
    >
      {/* Left: cell info */}
      <div className="flex items-center gap-4 font-mono text-label">
        <span className="text-muted-foreground">{cellLabel}</span>
        {activeMap && selectedCell && (
          <>
            <span className="text-border">·</span>
            <span className="text-foreground">{valueLabel}</span>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">orig {originalLabel}</span>
            {isDelta && deltaLabel && (
              <>
                <span className="text-border">·</span>
                <span className="text-orange-400">Δ {deltaLabel}</span>
              </>
            )}
          </>
        )}
      </div>

      {/* Right: counts + safety */}
      <div className="flex items-center gap-4 font-mono text-label">
        {totalPending > 0 && (
          <span className="text-orange-400">
            {totalPending} {totalPending === 1 ? 'cell' : 'cells'} modified
          </span>
        )}
        <span className="text-green-400">✓ Safe</span>
      </div>
    </footer>
  )
}
