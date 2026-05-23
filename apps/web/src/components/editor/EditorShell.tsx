'use client'

import { useCallback, useState } from 'react'
import { Cpu, AlertTriangle } from 'lucide-react'
import { useEditorStore } from '@/lib/editor/store'
import { EditorToolbar } from './EditorToolbar'
import { EditorSidebar } from './EditorSidebar'
import { EditorCanvas } from './EditorCanvas'

// ─── Status Bar ───────────────────────────────────────────────────────────────

function EditorStatusBar() {
  const parsedECU = useEditorStore((s) => s.parsedECU)
  const activeMapId = useEditorStore((s) => s.activeMapId)
  const selectedCells = useEditorStore((s) => s.selectedCells)
  const pendingChanges = useEditorStore((s) => s.pendingChanges)

  const activeMap = parsedECU?.maps.find((m) => m.id === activeMapId)
  const changedMapCount = Object.keys(pendingChanges).length

  return (
    <footer className="flex items-center h-6 shrink-0 px-3 gap-4 border-t border-border bg-card text-[10px] text-muted-foreground font-mono">
      {parsedECU ? (
        <>
          <span className="flex items-center gap-1.5">
            <Cpu className="size-3 text-amber-400/70" />
            {parsedECU.detectedEcu ?? 'Unbekannte ECU'}
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span>{(parsedECU.size / 1024).toFixed(0)} KB</span>
          {activeMap && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <span>
                {activeMap.rows}×{activeMap.cols}{' '}
                {activeMap.valueUnit ? `[${activeMap.valueUnit}]` : ''}
              </span>
              <span className="text-muted-foreground/50">|</span>
              <span>Offset: 0x{activeMap.offset.toString(16).toUpperCase().padStart(5, '0')}</span>
            </>
          )}
          {selectedCells.length > 0 && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <span>{selectedCells.length} Zelle{selectedCells.length > 1 ? 'n' : ''} ausgewählt</span>
            </>
          )}
          {changedMapCount > 0 && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <span className="text-orange-400 flex items-center gap-1">
                <AlertTriangle className="size-2.5" />
                {changedMapCount} Map{changedMapCount > 1 ? 's' : ''} geändert
              </span>
            </>
          )}
        </>
      ) : (
        <span>Bereit</span>
      )}
    </footer>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EditorShellProps {
  projectId: string
  projectName: string
}

export function EditorShell({ projectId: _projectId, projectName }: EditorShellProps) {
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)

  const handleCommit = useCallback(() => {
    setCommitDialogOpen(true)
  }, [])

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorToolbar projectName={projectName} onCommit={handleCommit} />

      <div className="flex flex-1 overflow-hidden">
        <EditorSidebar />
        <main className="flex-1 overflow-hidden bg-background">
          <EditorCanvas />
        </main>
      </div>

      <EditorStatusBar />

      {/* CommitDialog wird in Schritt 7 implementiert */}
      {commitDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setCommitDialogOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-6 w-96 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium">Commit-Dialog</p>
            <p className="text-xs text-muted-foreground mt-1">Wird in Schritt 7 implementiert.</p>
            <button
              className="mt-4 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setCommitDialogOpen(false)}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
