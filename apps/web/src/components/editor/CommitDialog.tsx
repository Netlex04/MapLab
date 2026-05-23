'use client'

import { useState, useTransition, useId } from 'react'
import { GitCommitHorizontal, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/lib/editor/store'
import { commitEditorChanges } from '@/app/actions/editor'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommitDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  branchId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommitDialog({ open, onClose, projectId, branchId }: CommitDialogProps) {
  const parsedECU = useEditorStore((s) => s.parsedECU)
  const rawBuffer = useEditorStore((s) => s.rawBuffer)
  const pendingChanges = useEditorStore((s) => s.pendingChanges)
  const commitConfirmed = useEditorStore((s) => s.commitConfirmed)

  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const inputId = useId()

  // Changed maps with their names
  const changedMaps = Object.keys(pendingChanges)
    .map((id) => parsedECU?.maps.find((m) => m.id === id))
    .filter(Boolean)

  function handleClose() {
    if (isPending) return
    setMessage('')
    setError(null)
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rawBuffer || !parsedECU || !message.trim()) return

    setError(null)

    startTransition(async () => {
      // Build the FormData payload.
      // `rawBuffer` is the original ECU binary. In Step 8 (real WASM),
      // this will be replaced by the write_map_values()-modified buffer.
      //
      // Copy into a plain ArrayBuffer to satisfy Blob's type constraints
      // (rawBuffer has ArrayBufferLike backing which includes SharedArrayBuffer).
      const ab = new ArrayBuffer(rawBuffer.byteLength)
      new Uint8Array(ab).set(rawBuffer)

      const formData = new FormData()
      formData.append('message', message.trim())
      formData.append('buffer', new Blob([ab], { type: 'application/octet-stream' }))
      formData.append('format', parsedECU.format)

      const result = await commitEditorChanges(projectId, branchId, formData)

      if (result?.error) {
        setError(result.error)
        return
      }

      commitConfirmed()
      setMessage('')
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <GitCommitHorizontal className="size-4 text-amber-400 shrink-0" />
            Commit erstellen
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-1 space-y-4">

          {/* ── Changed maps ── */}
          {changedMaps.length > 0 && (
            <div className="rounded-md border border-border bg-secondary/40 px-3 py-2.5 space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {changedMaps.length} Map{changedMaps.length > 1 ? 's' : ''} geändert
              </p>
              <ul className="space-y-0.5">
                {changedMaps.map((map) => (
                  <li key={map!.id} className="flex items-center gap-2 text-xs">
                    <span className="size-1.5 rounded-full bg-orange-400 shrink-0" />
                    <span className="text-foreground truncate">
                      {map!.aiLabel ?? map!.name ?? `Map @ 0x${map!.offset.toString(16).toUpperCase()}`}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/50">
                      0x{map!.offset.toString(16).toUpperCase().padStart(5, '0')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Commit message ── */}
          <div className="space-y-1.5">
            <label
              htmlFor={inputId}
              className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              Commit message *
            </label>
            <textarea
              id={inputId}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="z.B. Zündung +3° bei Volllast"
              rows={3}
              required
              autoFocus
              disabled={isPending}
              className="w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-amber-400/50 transition-shadow disabled:opacity-50"
            />
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={isPending}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !message.trim() || !rawBuffer}
              className="gap-1.5"
            >
              <GitCommitHorizontal className="size-3.5" />
              {isPending ? 'Wird committed…' : 'Commit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
