'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Undo2, Redo2, GitCommitHorizontal, Cpu, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { writeMapValues } from '@maplab/ecu-parser-wasm'
import {
  useEditorStore,
  selectCanUndo,
  selectCanRedo,
} from '@/lib/editor/store'

// ─── View Tab ─────────────────────────────────────────────────────────────────

type View = 'map-2d' | 'hex' | 'map-3d' | 'diff'

const VIEWS: { id: View; label: string }[] = [
  { id: 'map-2d', label: '2D Map' },
  { id: 'hex', label: 'HEX' },
  { id: 'map-3d', label: '3D View' },
  { id: 'diff', label: 'Diff' },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  projectId: string
  projectName: string
  onCommit: () => void
  canCommit: boolean
  copilotOpen: boolean
  onToggleCopilot: () => void
}

export function EditorToolbar({ projectId, projectName, onCommit, canCommit, copilotOpen, onToggleCopilot }: EditorToolbarProps) {
  const activeView = useEditorStore((s) => s.activeView)
  const setActiveView = useEditorStore((s) => s.setActiveView)
  const isDirty = useEditorStore((s) => s.isDirty)
  const status = useEditorStore((s) => s.status)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore(selectCanUndo)
  const canRedo = useEditorStore(selectCanRedo)

  const [isDownloading, setIsDownloading] = useState(false)

  const isReady = status === 'ready'

  async function handleDownload() {
    const { rawBuffer, parsedECU, pendingChanges } = useEditorStore.getState()
    if (!rawBuffer || !parsedECU) return
    setIsDownloading(true)
    try {
      const modified = await writeMapValues(rawBuffer, parsedECU.maps, pendingChanges)
      const ab = modified.buffer.slice(
        modified.byteOffset,
        modified.byteOffset + modified.byteLength,
      ) as ArrayBuffer
      const url = URL.createObjectURL(new Blob([ab], { type: 'application/octet-stream' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName.replace(/\s+/g, '_')}.bin`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-card px-3 gap-2">
      {/* Left — back + project breadcrumb */}
      <Link
        href={`/projects/${projectId}`}
        className="font-mono text-label uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground shrink-0"
      >
        ← Projekt
      </Link>

      <Separator orientation="vertical" className="h-5" />

      <div className="flex items-center gap-2 min-w-0 mr-2">
        <Cpu className="size-3.5 shrink-0 text-amber-400" />
        <span className="font-mono text-label text-muted-foreground truncate max-w-36">
          {projectName}
        </span>
        {isDirty && (
          <span
            className="size-1.5 rounded-full bg-amber-400 shrink-0"
            title="Ungespeicherte Änderungen"
          />
        )}
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Center — view tabs */}
      <nav className="flex items-center gap-0" aria-label="Editor-Ansicht">
        {VIEWS.map(({ id, label }) => {
          const isActive = activeView === id
          const isDisabled = !isReady
          return (
            <button
              key={id}
              onClick={() => !isDisabled && setActiveView(id)}
              disabled={isDisabled}
              className={[
                'relative px-3.5 h-12 text-xs font-medium transition-colors duration-100',
                'border-b-2 -mb-px',
                isActive
                  ? 'text-amber-400 border-b-amber-400'
                  : 'text-muted-foreground border-b-transparent hover:text-foreground',
                isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              {label}
            </button>
          )
        })}
      </nav>

      {/* Right — actions */}
      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={undo}
              disabled={!canUndo}
              className="size-8"
              aria-label="Rückgängig"
            >
              <Undo2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rückgängig (⌘Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={redo}
              disabled={!canRedo}
              className="size-8"
              aria-label="Wiederholen"
            >
              <Redo2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Wiederholen (⌘⇧Z)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Button
          variant={copilotOpen ? 'ai' : 'ghost'}
          size="sm"
          className="h-8 text-xs gap-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
          onClick={onToggleCopilot}
        >
          <span className="text-[10px]">✦</span>
          Copilot
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              disabled={!isReady || isDownloading}
              className="size-8"
              aria-label="BIN herunterladen"
            >
              <Download className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>BIN herunterladen</TooltipContent>
        </Tooltip>

        {canCommit && (
          <Button
            size="sm"
            onClick={onCommit}
            disabled={!isDirty || !isReady}
            className="h-8 text-xs gap-1.5"
          >
            <GitCommitHorizontal className="size-3.5" />
            Commit
          </Button>
        )}
      </div>
    </header>
  )
}
