'use client'

import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { Binary, Search } from 'lucide-react'
import { useEditorStore, selectActiveMap } from '@/lib/editor/store'
import { HexRow } from './HexRow'

// ─── Constants ────────────────────────────────────────────────────────────────

const BYTES_PER_ROW = 16
const ROW_H = 20 // px – must match h-5 (1.25rem = 20px at base 16px)
const OVERSCAN = 8

// ECU maps are typically 16-bit values; used for approximate byte-length.
// A proper bytesPerValue field will be added to ECUMap in a later step.
const BYTES_PER_VALUE = 2

// ─── Column Header ────────────────────────────────────────────────────────────

function ColumnHeader() {
  return (
    <div className="flex items-center h-5 shrink-0 bg-card border-b border-border select-none">
      <span className="shrink-0 w-[76px] pl-3 font-mono text-[10px] text-muted-foreground/30 uppercase tracking-wider">
        Offset
      </span>
      <span className="shrink-0 pr-3 font-mono text-[10px] text-border">│</span>
      <div className="flex shrink-0 gap-0.5 pr-3">
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className={[
              'w-[18px] text-center font-mono text-[10px] text-muted-foreground/30 tabular-nums',
              i === 8 ? 'ml-2' : '',
            ].join(' ')}
          >
            {i.toString(16).toUpperCase().padStart(2, '0')}
          </span>
        ))}
      </div>
      <span className="shrink-0 pr-3 font-mono text-[10px] text-border">│</span>
      <span className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-wider">
        ASCII
      </span>
    </div>
  )
}

// ─── No-Buffer State ──────────────────────────────────────────────────────────

function NoBufferState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="size-12 rounded-lg bg-secondary flex items-center justify-center">
        <Binary className="size-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">Kein Buffer geladen</p>
      <p className="text-xs text-muted-foreground/50 max-w-56 leading-relaxed">
        Lade eine .bin-Datei, um den Hex-Dump anzuzeigen.
      </p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HexView() {
  const rawBuffer = useEditorStore((s) => s.rawBuffer)
  const activeMap = useEditorStore(selectActiveMap)

  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerH, setContainerH] = useState(400)

  const [jumpInput, setJumpInput] = useState('')
  const [jumpedRow, setJumpedRow] = useState<number | null>(null)
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inputId = useId()

  // ── Derived ────────────────────────────────────────────────────────────────

  const totalRows = rawBuffer ? Math.ceil(rawBuffer.length / BYTES_PER_ROW) : 0

  const mapStart = activeMap?.offset ?? -1
  const mapByteLen = activeMap ? activeMap.rows * activeMap.cols * BYTES_PER_VALUE : 0
  const mapEnd = mapStart >= 0 ? mapStart + mapByteLen : -1

  // ── Container height via ResizeObserver ────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => setContainerH(el.clientHeight))
    obs.observe(el)
    setContainerH(el.clientHeight)
    return () => obs.disconnect()
  }, [])

  // ── Auto-scroll to active map start ───────────────────────────────────────

  useEffect(() => {
    if (!activeMap || !containerRef.current) return
    const targetRow = Math.floor(activeMap.offset / BYTES_PER_ROW)
    const targetScroll = Math.max(0, targetRow * ROW_H - containerH / 2)
    containerRef.current.scrollTop = targetScroll
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMap?.id]) // only re-run when the selected map changes, not on containerH updates

  // ── Scroll handler ─────────────────────────────────────────────────────────

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // ── Jump to offset ─────────────────────────────────────────────────────────

  const scrollToRow = useCallback(
    (row: number) => {
      if (!containerRef.current) return
      const targetScroll = Math.max(
        0,
        Math.min(row * ROW_H - containerH / 2, (totalRows - 1) * ROW_H),
      )
      containerRef.current.scrollTop = targetScroll
      setJumpedRow(row)
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
      jumpTimerRef.current = setTimeout(() => setJumpedRow(null), 1500)
    },
    [containerH, totalRows],
  )

  const handleJump = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!rawBuffer) return
      const raw = jumpInput.trim().replace(/^0x/i, '')
      const offset = parseInt(raw, 16)
      if (isNaN(offset) || offset < 0 || offset >= rawBuffer.length) return
      scrollToRow(Math.floor(offset / BYTES_PER_ROW))
    },
    [jumpInput, rawBuffer, scrollToRow],
  )

  useEffect(() => () => {
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
  }, [])

  // ── Virtual window ─────────────────────────────────────────────────────────

  const startRow = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const endRow = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + containerH) / ROW_H) + OVERSCAN,
  )
  const topPad = startRow * ROW_H
  const bottomPad = Math.max(0, (totalRows - 1 - endRow) * ROW_H)

  // ── Early return ───────────────────────────────────────────────────────────

  if (!rawBuffer) return <NoBufferState />

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Info header ── */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-border shrink-0 bg-card">
        {activeMap ? (
          <>
            <span className="text-sm font-medium text-foreground truncate">
              {activeMap.aiLabel ?? activeMap.name ?? `Map @ 0x${activeMap.offset.toString(16).toUpperCase()}`}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded">
              {`0x${activeMap.offset.toString(16).toUpperCase().padStart(5, '0')}`}
              {mapByteLen > 0 && ` – 0x${(mapEnd - 1).toString(16).toUpperCase().padStart(5, '0')}`}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Keine Map ausgewählt</span>
        )}

        {/* Jump-to-offset form */}
        <form onSubmit={handleJump} className="ml-auto flex items-center gap-1.5">
          <label htmlFor={inputId} className="sr-only">Sprung zu Offset</label>
          <Search className="size-3 text-muted-foreground/40 shrink-0" aria-hidden />
          <input
            id={inputId}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            placeholder="z.B. 0x1A00"
            spellCheck={false}
            className="w-36 h-6 px-2 font-mono text-[11px] bg-secondary border border-border rounded text-foreground placeholder:text-muted-foreground/35 outline-none focus:ring-1 focus:ring-amber-400/50 transition-shadow"
          />
          <button
            type="submit"
            className="h-6 px-2.5 text-[11px] font-mono bg-secondary border border-border rounded text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      {/* ── Column header (sticky) ── */}
      <ColumnHeader />

      {/* ── Virtual scroll area ── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-auto"
        aria-label="Hex-Dump"
        role="region"
      >
        {topPad > 0 && <div style={{ height: topPad }} />}

        {Array.from({ length: endRow - startRow + 1 }, (_, i) => {
          const rowIndex = startRow + i
          const offset = rowIndex * BYTES_PER_ROW
          const bytes = Array.from(rawBuffer.slice(offset, offset + BYTES_PER_ROW))

          return (
            <HexRow
              key={rowIndex}
              offset={offset}
              bytes={bytes}
              mapStart={mapStart}
              mapEnd={mapEnd}
              isJumpTarget={rowIndex === jumpedRow}
            />
          )
        })}

        {bottomPad > 0 && <div style={{ height: bottomPad }} />}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center gap-3 px-3 h-6 border-t border-border bg-card shrink-0 font-mono text-[10px] text-muted-foreground/40">
        <span className="tabular-nums">{(rawBuffer.length / 1024).toFixed(0)} KB</span>
        <span className="text-border">|</span>
        <span className="tabular-nums">{totalRows.toLocaleString()} Rows</span>
        {activeMap && mapByteLen > 0 && (
          <>
            <span className="text-border">|</span>
            <span className="text-amber-400/60 tabular-nums">
              Map: {mapByteLen} B @ 0x{activeMap.offset.toString(16).toUpperCase()}
            </span>
          </>
        )}
        <span className="ml-auto text-muted-foreground/25">read-only</span>
      </div>
    </div>
  )
}
