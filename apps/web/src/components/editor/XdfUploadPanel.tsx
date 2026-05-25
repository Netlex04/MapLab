'use client'

import { useRef, useState } from 'react'
import { FileCode, X, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { parseAndNormalizeXdf } from '@maplab/definition-parser'
import { useEditorStore } from '@/lib/editor/store'

// ─── Warning list ─────────────────────────────────────────────────────────────

function WarningList({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(false)
  if (warnings.length === 0) return null

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors"
      >
        {open ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
        <AlertTriangle className="size-2.5" />
        {warnings.length} warning{warnings.length > 1 ? 's' : ''}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 pl-4">
          {warnings.map((w, i) => (
            <li key={i} className="font-mono text-[9px] text-muted-foreground leading-relaxed">
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function XdfUploadPanel() {
  const xdf = useEditorStore((s) => s.xdf)
  const setXdf = useEditorStore((s) => s.setXdf)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.xdf')) {
      setError('Only .xdf files are supported')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const text = await file.text()
      const result = parseAndNormalizeXdf(text, file.name)
      setXdf({
        definitions: result.definitions,
        fileName: file.name,
        warnings: result.warnings,
        stats: result.stats,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse XDF')
      setXdf(null)
    } finally {
      setLoading(false)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleClear() {
    setXdf(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="border-t border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-9 shrink-0">
        <FileCode className="size-3.5 text-muted-foreground/60" />
        <span className="text-label text-muted-foreground">XDF</span>
        {xdf && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            title="Remove XDF"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="px-3 pb-3">
        {xdf ? (
          // Loaded state
          <div>
            <div className="flex items-start gap-2 rounded border border-border bg-secondary/20 px-2.5 py-2">
              <span className="mt-px h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <p className="font-mono text-[10px] text-foreground truncate">{xdf.fileName}</p>
                <p className="font-mono text-[9px] text-muted-foreground">
                  {xdf.stats.definitionsCreated} maps
                  {xdf.stats.tablesFound > 0 && ` · ${xdf.stats.tablesFound}T`}
                  {xdf.stats.constantsFound > 0 && ` · ${xdf.stats.constantsFound}C`}
                </p>
              </div>
            </div>
            <WarningList warnings={xdf.warnings} />
          </div>
        ) : (
          // Upload area
          <div>
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded border border-dashed border-border py-4 text-center transition-colors hover:border-border/70 hover:bg-secondary/20"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xdf"
                className="sr-only"
                onChange={handleInputChange}
              />
              {loading ? (
                <span className="font-mono text-[10px] text-muted-foreground animate-pulse">
                  Parsing…
                </span>
              ) : (
                <>
                  <FileCode className="size-4 text-muted-foreground/30" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Drop .xdf or click
                  </span>
                </>
              )}
            </div>
            {error && (
              <p className="mt-1.5 font-mono text-[9px] text-destructive">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
