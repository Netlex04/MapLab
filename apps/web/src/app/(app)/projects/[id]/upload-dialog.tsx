'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { uploadCommit, type UploadState } from '@/app/actions/projects'

const ACCEPTED_EXTENSIONS = '.bin,.hex,.frf,.ols,.xdf,.a2l'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface UploadDialogProps {
  projectId: string
  branchId: string
  children?: React.ReactNode
}

export function UploadDialog({ projectId, branchId, children }: UploadDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const boundAction = uploadCommit.bind(null, projectId, branchId)
  const [state, action, pending] = useActionState<UploadState, FormData>(boundAction, null)

  // Track whether a submission has been attempted so we can distinguish
  // initial null state from a successful null result.
  const hasSubmitted = useRef(false)
  useEffect(() => { if (pending) hasSubmitted.current = true }, [pending])
  useEffect(() => {
    if (hasSubmitted.current && !pending && state === null) {
      hasSubmitted.current = false
      setOpen(false)
      setSelectedFile(null)
      router.refresh()
    }
  }, [pending, state, router])

  function handleFileChange(file: File | null) {
    setSelectedFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0] ?? null
    if (file) {
      handleFileChange(file)
      // Sync to the hidden input via DataTransfer
      if (fileInputRef.current) {
        const dt = new DataTransfer()
        dt.items.add(file)
        fileInputRef.current.files = dt.files
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelectedFile(null) }}>
      <DialogTrigger asChild>
        {children ?? (
          <button className="flex items-center gap-2 rounded border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20">
            <span>↑</span> Upload new version
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-wider">
            Upload ECU File
          </DialogTitle>
        </DialogHeader>

        <form action={action} className="mt-2 space-y-5">
          {/* Drop zone */}
          <div
            className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 text-center transition-colors ${
              dragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-border/80 hover:bg-secondary/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept={ACCEPTED_EXTENSIONS}
              className="sr-only"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />

            {selectedFile ? (
              <>
                <div className="mb-2 font-mono text-2xl text-primary">⬡</div>
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {formatBytes(selectedFile.size)}
                </p>
                <button
                  type="button"
                  className="mt-3 font-mono text-label uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                >
                  Change file
                </button>
              </>
            ) : (
              <>
                <div className="mb-2 font-mono text-2xl text-muted-foreground/30">⬡</div>
                <p className="text-sm font-medium text-foreground">
                  Drop file here or click to browse
                </p>
                <p className="mt-1 font-mono text-label uppercase tracking-wider text-muted-foreground">
                  .BIN · .HEX · .FRF · .OLS · .XDF · .A2L
                </p>
              </>
            )}
          </div>

          {/* Commit message */}
          <div className="space-y-1.5">
            <Label
              htmlFor="message"
              className="font-mono text-label uppercase tracking-widest text-muted-foreground"
            >
              Commit message *
            </Label>
            <Input
              id="message"
              name="message"
              placeholder="e.g. Stage 2 ignition advance +3°"
              required
              autoFocus={false}
            />
          </div>

          {state && 'error' in state && (
            <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); setSelectedFile(null) }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !selectedFile}>
              {pending ? 'Uploading…' : 'Commit file'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
