'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/stores/editor-store'
import { CommitDialog } from './commit-dialog'

const VIEW_TABS = [
  { id: 'map2d' as const, label: '2D Map' },
  { id: 'map3d' as const, label: '3D' },
  { id: 'hex' as const, label: 'Hex' },
  { id: 'diff' as const, label: 'Diff' },
] as const

interface EditorToolbarProps {
  projectId: string
  projectName: string
  ownerSlug: string
  branchId: string
  branchName: string
  commitHash: string
}

export function EditorToolbar({
  projectId,
  projectName,
  ownerSlug,
  branchId,
  branchName,
  commitHash,
}: EditorToolbarProps) {
  const { activeView, setActiveView, pendingChanges } = useEditorStore()
  const [commitOpen, setCommitOpen] = useState(false)

  const totalPending = [...pendingChanges.values()].reduce((s, c) => s + c.length, 0)

  return (
    <header
      className="flex h-12 shrink-0 items-center border-b border-border px-4"
      style={{ backgroundColor: 'hsl(228 23% 9%)' }}
    >
      {/* Breadcrumb */}
      <div className="flex min-w-0 items-center gap-1.5 font-mono text-label">
        <Link
          href={`/projects/${projectId}`}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {ownerSlug}
        </Link>
        <span className="text-border">/</span>
        <Link
          href={`/projects/${projectId}`}
          className="text-foreground transition-colors hover:text-primary"
        >
          {projectName}
        </Link>
        <span className="text-border">·</span>
        <span className="text-muted-foreground">{branchName}</span>
        <span className="text-border">@</span>
        <span className="text-cyan-400">{commitHash}</span>
      </div>

      {/* View tabs */}
      <div className="mx-6 flex items-stretch gap-0 self-stretch">
        {VIEW_TABS.map((tab) => {
          const active = activeView === tab.id
          const disabled = tab.id !== 'map2d'
          return (
            <button
              key={tab.id}
              disabled={disabled}
              onClick={() => setActiveView(tab.id)}
              className={`flex items-center border-b-2 px-4 font-mono text-xs transition-colors ${
                active
                  ? 'border-b-amber-500 text-amber-400'
                  : 'border-b-transparent text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Action bar */}
      <div className="ml-auto flex items-center gap-3">
        {/* Pending indicator */}
        {totalPending > 0 && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-orange-400">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            {totalPending} {totalPending === 1 ? 'change' : 'changes'}
          </span>
        )}

        {/* Safety badge — static OK for MVP */}
        <span className="flex items-center gap-1 rounded-sm border border-green-500/20 bg-green-500/8 px-2 py-0.5 font-mono text-[10px] text-green-400">
          ✓ Safe
        </span>

        {/* Commit button */}
        <Button
          size="sm"
          disabled={totalPending === 0}
          onClick={() => setCommitOpen(true)}
          className="h-7 px-3 text-xs"
        >
          ↑ Commit
        </Button>
      </div>

      <CommitDialog
        open={commitOpen}
        onOpenChange={setCommitOpen}
        projectId={projectId}
        branchId={branchId}
      />
    </header>
  )
}
