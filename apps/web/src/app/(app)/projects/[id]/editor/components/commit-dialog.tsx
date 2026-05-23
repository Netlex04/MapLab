'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useEditorStore } from '@/stores/editor-store'
import { commitEditorChanges } from '@/app/actions/projects'
import type { SafetyCheckResult } from '@/app/api/ecu/safety-check/route'

interface CommitDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: string
  branchId: string
}

export function CommitDialog({ open, onOpenChange, projectId, branchId }: CommitDialogProps) {
  const router = useRouter()
  const { parsedECU, pendingChanges, clearPendingChanges } = useEditorStore()
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<'idle' | 'checking' | 'exporting' | 'committing' | 'done'>('idle')
  const [safetyResult, setSafetyResult] = useState<SafetyCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const entries = [...pendingChanges.entries()]
  const totalChanges = entries.reduce((s, [, c]) => s + c.length, 0)

  const resetDialog = () => {
    setMessage('')
    setPhase('idle')
    setSafetyResult(null)
    setError(null)
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) resetDialog()
    onOpenChange(v)
  }

  const handleCommit = async () => {
    if (!message.trim() || !parsedECU) return
    setError(null)
    setSafetyResult(null)

    // Safety check per map
    setPhase('checking')
    for (const [mapId, changes] of entries) {
      const map = parsedECU.maps.find((m) => m.id === mapId)
      if (!map) continue
      try {
        const res = await fetch('/api/ecu/safety-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ map, changes }),
        })
        const result: SafetyCheckResult = await res.json()
        if (!result.passed) {
          setSafetyResult(result)
          setPhase('idle')
          return
        }
      } catch {
        setError('Safety check failed — cannot connect to server.')
        setPhase('idle')
        return
      }
    }

    // Export binary
    setPhase('exporting')
    let binBase64: string
    try {
      const changesRecord: Record<string, (typeof entries)[number][1]> = {}
      for (const [mapId, changes] of entries) changesRecord[mapId] = changes
      const res = await fetch('/api/ecu/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maps: parsedECU.maps, changes: changesRecord }),
      })
      const data = await res.json()
      if (!data.binBase64) throw new Error('No binary returned')
      binBase64 = data.binBase64
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
      setPhase('idle')
      return
    }

    // Commit
    setPhase('committing')
    const result = await commitEditorChanges(projectId, branchId, binBase64, message.trim())
    if (result?.error) {
      setError(result.error)
      setPhase('idle')
      return
    }

    setPhase('done')
    clearPendingChanges()
    router.refresh()
    setTimeout(() => {
      handleOpenChange(false)
    }, 800)
  }

  const busy = phase === 'checking' || phase === 'exporting' || phase === 'committing'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg uppercase tracking-wider">
            Commit Changes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Changed maps summary */}
          {entries.length > 0 && (
            <div className="space-y-1">
              <Label className="font-mono text-label uppercase tracking-widest text-muted-foreground">
                Changed Maps ({totalChanges} {totalChanges === 1 ? 'cell' : 'cells'})
              </Label>
              <div className="rounded-md border border-border bg-secondary/30 py-1">
                {entries.map(([mapId, changes]) => {
                  const map = parsedECU?.maps.find((m) => m.id === mapId)
                  return (
                    <div
                      key={mapId}
                      className="flex items-center justify-between px-3 py-1.5 font-mono text-xs"
                    >
                      <span className="text-foreground">{map?.name ?? mapId}</span>
                      <span className="text-orange-400">
                        {changes.length} {changes.length === 1 ? 'cell' : 'cells'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Diff lines */}
          {entries.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-secondary/20 p-2 space-y-0.5">
              {entries.flatMap(([mapId, changes]) => {
                const map = parsedECU?.maps.find((m) => m.id === mapId)
                return changes.map((c, i) => {
                  const precision = map?.unit === 'λ' ? 2 : map?.unit?.includes('°') ? 1 : 0
                  const delta = c.newValue - c.originalValue
                  return (
                    <div key={`${mapId}-${i}`} className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="text-muted-foreground/60 w-28 truncate">{map?.name}</span>
                      <span className="text-muted-foreground">R{c.row + 1}:C{c.col + 1}</span>
                      <span className="text-muted-foreground">{c.originalValue.toFixed(precision)}</span>
                      <span className="text-border">→</span>
                      <span className="text-orange-400">{c.newValue.toFixed(precision)}</span>
                      <span className={delta >= 0 ? 'text-green-400' : 'text-red-400'}>
                        ({delta >= 0 ? '+' : ''}{delta.toFixed(precision)})
                      </span>
                    </div>
                  )
                })
              })}
            </div>
          )}

          {/* Commit message */}
          <div className="space-y-1.5">
            <Label
              htmlFor="commit-message"
              className="font-mono text-label uppercase tracking-widest text-muted-foreground"
            >
              Commit Message *
            </Label>
            <Input
              id="commit-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Reduce torque limiter at WOT"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && message.trim() && !busy) handleCommit()
              }}
            />
          </div>

          {/* Safety failure */}
          {safetyResult && !safetyResult.passed && (
            <Alert className="border-red-500/25 bg-red-500/8 text-red-400">
              <AlertTitle>Safety Check Failed</AlertTitle>
              <AlertDescription className="mt-1 space-y-1 text-muted-foreground">
                {safetyResult.issues.map((issue, i) => (
                  <p key={i} className={`text-xs ${issue.severity === 'critical' ? 'text-red-400' : 'text-orange-400'}`}>
                    {issue.severity === 'critical' ? '⚠ ' : '⚡ '}{issue.message}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Generic error */}
          {error && (
            <p className="rounded border border-destructive/30 bg-destructive/8 px-3 py-2 font-mono text-xs text-destructive">
              {error}
            </p>
          )}

          {/* Success */}
          {phase === 'done' && (
            <p className="font-mono text-xs text-green-400">✓ Committed successfully</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleCommit}
            disabled={busy || !message.trim() || totalChanges === 0 || phase === 'done'}
          >
            {phase === 'checking'
              ? 'Checking safety…'
              : phase === 'exporting'
                ? 'Exporting…'
                : phase === 'committing'
                  ? 'Committing…'
                  : '↑ Commit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
