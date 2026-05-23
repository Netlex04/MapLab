'use client'

import { Layers } from 'lucide-react'
import { useEditorStore } from '@/lib/editor/store'
import { MapTree } from './sidebar/MapTree'

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

// ─── Component ────────────────────────────────────────────────────────────────

export function EditorSidebar() {
  const status = useEditorStore((s) => s.status)
  const parsedECU = useEditorStore((s) => s.parsedECU)

  return (
    <aside className="flex flex-col w-52 shrink-0 border-r border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border shrink-0">
        <Layers className="size-3.5 text-muted-foreground/60" />
        <span className="text-label text-muted-foreground">
          Maps
        </span>
        {parsedECU && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
            {parsedECU.maps.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {status === 'parsing' && <SidebarSkeleton />}
        {status === 'idle' && <SidebarEmpty />}
        {status === 'ready' && <MapTree />}
        {status === 'error' && (
          <div className="p-3 text-xs text-destructive">
            Fehler beim Parsen der Datei.
          </div>
        )}
      </div>
    </aside>
  )
}
