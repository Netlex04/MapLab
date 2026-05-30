'use client'

import { Binary } from 'lucide-react'
import { useEditorStore } from '@/lib/editor/store'
import { Map2DView } from './views/Map2DView'
import { Map3DView } from './views/Map3DView'
import { HexView } from './views/HexView'
import { DiffView } from './views/DiffView'

// ─── No-file State ────────────────────────────────────────────────────────────

function NoFileState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="size-16 rounded-xl bg-secondary flex items-center justify-center">
        <Binary className="size-7 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Keine ECU-Datei geladen</p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-64">
          Lade eine .bin-Datei über die Projektseite hoch, um den Editor zu öffnen.
        </p>
      </div>
    </div>
  )
}

// ─── Loading State ────────────────────────────────────────────────────────────

function ParseLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="size-2 rounded-full bg-amber-400 animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">ECU-Datei wird geparst…</p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditorCanvas() {
  const status = useEditorStore((s) => s.status)
  const activeView = useEditorStore((s) => s.activeView)

  if (status === 'idle') return <NoFileState />
  if (status === 'parsing') return <ParseLoadingState />
  if (status === 'error') {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-destructive">
          Fehler beim Laden der ECU-Datei. Bitte erneut versuchen.
        </p>
      </div>
    )
  }

  // status === 'ready'
  switch (activeView) {
    case 'map-2d':
      return <Map2DView />
    case 'hex':
      return <HexView />
    case 'map-3d':
      return <Map3DView />
    case 'diff':
      return <DiffView />
  }
}
