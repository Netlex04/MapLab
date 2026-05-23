'use client'

import { useEffect } from 'react'
import { useEditorStore } from '@/stores/editor-store'
import { createDataSource } from '@/lib/editor/data-source'
import { EditorToolbar } from './editor-toolbar'
import { MapTreePanel } from './map-tree-panel'
import { AICopilotPanel } from './ai-copilot-panel'
import { Map2DView } from './map-2d-view'
import { StatusBar } from './status-bar'

interface EditorShellProps {
  projectId: string
  projectName: string
  ownerSlug: string
  branchId: string
  branchName: string
  commitHash: string
  ecuType: string | null
  fileUrl: string | null
}

export function EditorShell({
  projectId,
  projectName,
  ownerSlug,
  branchId,
  branchName,
  commitHash,
  ecuType,
  fileUrl,
}: EditorShellProps) {
  const { loadingState, errorMessage, activeSidebarTab, setLoadingState, setParsedECU } =
    useEditorStore()

  useEffect(() => {
    const ds = createDataSource()
    setLoadingState('loading')
    ds.loadECU(fileUrl, ecuType)
      .then((ecu) => setParsedECU(ecu))
      .catch((err) => setLoadingState('error', err instanceof Error ? err.message : 'Load failed'))
  }, [fileUrl, ecuType, setLoadingState, setParsedECU])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <EditorToolbar
        projectId={projectId}
        projectName={projectName}
        ownerSlug={ownerSlug}
        branchId={branchId}
        branchName={branchName}
        commitHash={commitHash}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="flex w-50 shrink-0 flex-col border-r border-border"
          style={{ backgroundColor: 'hsl(228 23% 9%)' }}
        >
          <SidebarTabs />
          <div className="flex-1 overflow-hidden">
            {activeSidebarTab === 'maps' && <MapTreePanel />}
            {activeSidebarTab === 'ai' && <AICopilotPanel ecuType={ecuType} />}
            {activeSidebarTab === 'hex' && <HexStub />}
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          <CanvasBody loadingState={loadingState} errorMessage={errorMessage} />
          <StatusBar />
        </main>
      </div>
    </div>
  )
}

function SidebarTabs() {
  const { activeSidebarTab, setActiveSidebarTab } = useEditorStore()

  const tabs = [
    { id: 'maps' as const, label: 'Maps', icon: '◫' },
    { id: 'hex' as const, label: 'Hex', icon: '⬡' },
    { id: 'ai' as const, label: 'AI', icon: '✦' },
  ]

  return (
    <div className="flex border-b border-border">
      {tabs.map((tab) => {
        const active = activeSidebarTab === tab.id
        const isAI = tab.id === 'ai'
        return (
          <button
            key={tab.id}
            onClick={() => setActiveSidebarTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1 border-b-2 py-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              active
                ? isAI
                  ? 'border-b-purple-500 text-purple-400'
                  : 'border-b-amber-500 text-amber-400'
                : 'border-b-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function CanvasBody({
  loadingState,
  errorMessage,
}: {
  loadingState: string
  errorMessage: string | null
}) {
  const { activeView, parsedECU, activeMapId } = useEditorStore()

  if (loadingState === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="animate-pulse font-mono text-2xl text-muted-foreground/30">⬡</span>
          <p className="font-mono text-label uppercase tracking-widest text-muted-foreground">
            Loading ECU data…
          </p>
        </div>
      </div>
    )
  }

  if (loadingState === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="font-mono text-sm text-destructive">{errorMessage ?? 'Unknown error'}</p>
      </div>
    )
  }

  if (!parsedECU || !activeMapId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="font-mono text-label uppercase tracking-widest text-muted-foreground">
          Select a map
        </p>
      </div>
    )
  }

  const activeMap = parsedECU.maps.find((m) => m.id === activeMapId)
  if (!activeMap) return null

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Canvas header */}
      <div className="flex items-baseline gap-3 border-b border-border px-5 py-3">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wider text-foreground">
          {activeMap.name}
        </h2>
        <span className="font-mono text-label text-muted-foreground">
          {activeMap.rows}×{activeMap.cols} · {activeMap.unit}
        </span>
        <span className="font-mono text-label text-muted-foreground">
          @0x{activeMap.offset.toString(16).toUpperCase().padStart(6, '0')}
        </span>
      </div>

      {/* Active view */}
      <div className="flex-1 overflow-auto p-4">
        {activeView === 'map2d' && <Map2DView map={activeMap} />}
        {activeView !== 'map2d' && (
          <div className="flex h-full items-center justify-center">
            <p className="font-mono text-label uppercase tracking-widest text-muted-foreground">
              View coming in Phase 2
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function HexStub() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="px-4 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Hex view — Phase 2
      </p>
    </div>
  )
}
