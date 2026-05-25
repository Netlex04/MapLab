'use client'

import { useCallback, useEffect, useState } from 'react'
import { Cpu, AlertTriangle } from 'lucide-react'
import { useEditorStore } from '@/lib/editor/store'
import { useECUParser } from '@/lib/editor/use-ecu-parser'
import { getLatestFileInfo } from '@/app/actions/projects'
import { EditorToolbar } from './EditorToolbar'
import { EditorSidebar } from './EditorSidebar'
import { EditorCanvas } from './EditorCanvas'
import { CommitDialog } from './CommitDialog'
import { AICopilotPanel } from './sidebar/AICopilotPanel'

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
  branchId: string
}

export function EditorShell({ projectId, projectName, branchId }: EditorShellProps) {
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const { parseFile, reExtract } = useECUParser()
  const xdf = useEditorStore((s) => s.xdf)

  // Load the head commit's ECU file once on mount (or when branch changes).
  // If the branch has no commits yet the action returns null and we stay idle.
  useEffect(() => {
    let cancelled = false

    async function load() {
      const info = await getLatestFileInfo(branchId)
      if (cancelled || !info) return

      const res = await fetch(info.signedUrl)
      if (!res.ok || cancelled) return

      const blob = await res.blob()
      const ext = info.format.toLowerCase()
      const file = new File([blob], `ecu.${ext}`, { type: 'application/octet-stream' })

      if (!cancelled) await parseFile(file)
    }

    load()
    return () => { cancelled = true }
  // parseFile is stable (useCallback with stable Zustand deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  // Re-extract maps whenever the XDF changes (user uploaded or cleared + re-uploaded).
  // reExtract is a no-op when no ROM is loaded yet.
  useEffect(() => {
    if (!xdf) return
    reExtract(xdf.definitions).catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xdf])

  const handleCommit = useCallback(() => {
    setCommitDialogOpen(true)
  }, [])

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorToolbar
        projectId={projectId}
        projectName={projectName}
        onCommit={handleCommit}
        copilotOpen={copilotOpen}
        onToggleCopilot={() => setCopilotOpen((o) => !o)}
      />

      <div className="flex flex-1 overflow-hidden">
        <EditorSidebar />
        <main className="flex-1 overflow-hidden bg-background">
          <EditorCanvas />
        </main>
        {copilotOpen && <AICopilotPanel onClose={() => setCopilotOpen(false)} />}
      </div>

      <EditorStatusBar />

      <CommitDialog
        open={commitDialogOpen}
        onClose={() => setCommitDialogOpen(false)}
        projectId={projectId}
        branchId={branchId}
      />
    </div>
  )
}
