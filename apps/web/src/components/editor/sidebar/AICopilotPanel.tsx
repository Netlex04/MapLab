'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Sparkles, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEditorStore, selectActiveMap } from '@/lib/editor/store'
import { cn } from '@/lib/utils'

type StreamState = 'idle' | 'loading' | 'streaming' | 'done' | 'error'

interface AICopilotPanelProps {
  onClose: () => void
}

export function AICopilotPanel({ onClose }: AICopilotPanelProps) {
  const activeMap = useEditorStore(selectActiveMap)
  const parsedECU = useEditorStore((s) => s.parsedECU)

  const [streamState, setStreamState] = useState<StreamState>('idle')
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const mapLabel =
    activeMap?.aiLabel ??
    activeMap?.name ??
    (activeMap ? `0x${activeMap.offset.toString(16).toUpperCase().padStart(5, '0')}` : null)

  // Reset when a different map is selected
  useEffect(() => {
    setStreamState('idle')
    setExplanation('')
    setError(null)
    abortRef.current?.abort()
  }, [activeMap?.id])

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (streamState === 'streaming' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [explanation, streamState])

  const handleExplain = useCallback(async () => {
    if (!activeMap) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setStreamState('loading')
    setExplanation('')
    setError(null)

    try {
      const res = await fetch('/api/ai/explain-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          map: {
            name: activeMap.name,
            aiLabel: activeMap.aiLabel,
            type: activeMap.type,
            rows: activeMap.rows,
            cols: activeMap.cols,
            xAxisLabel: activeMap.xAxisLabel,
            yAxisLabel: activeMap.yAxisLabel,
            valueUnit: activeMap.valueUnit,
            values: activeMap.values,
            offset: activeMap.offset,
          },
          ecuContext: parsedECU
            ? { ecuType: parsedECU.detectedEcu, format: parsedECU.format }
            : undefined,
        }),
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      if (!res.body) throw new Error('Keine Antwort erhalten')

      setStreamState('streaming')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') {
            setStreamState('done')
            return
          }
          try {
            const chunk = JSON.parse(payload) as { text?: string; error?: string }
            if (chunk.error) throw new Error(chunk.error)
            if (chunk.text) setExplanation((prev) => prev + chunk.text)
          } catch (parseErr) {
            // re-throw non-JSON errors (stream errors); skip malformed SSE lines
            if ((parseErr as Error).name !== 'SyntaxError') throw parseErr
          }
        }
      }

      setStreamState('done')
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setStreamState('error')
    }
  }, [activeMap, parsedECU])

  const isActive = streamState === 'loading' || streamState === 'streaming'

  return (
    <aside className="flex flex-col w-80 shrink-0 border-l border-cyan-500/15 bg-gradient-to-b from-purple-500/[0.04] to-cyan-500/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-cyan-500/15 shrink-0">
        <span className="text-cyan-400 text-[10px] leading-none">✦</span>
        <span className="text-[11px] text-cyan-300/80 font-medium">Copilot</span>
        {mapLabel && (
          <span className="ml-1 text-[10px] font-mono text-muted-foreground/60 truncate flex-1">
            {mapLabel}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-6 ml-auto shrink-0 text-muted-foreground hover:text-foreground hover:bg-white/5"
          onClick={onClose}
          aria-label="Copilot schließen"
        >
          <X className="size-3" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* No map selected */}
        {!activeMap && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 px-5 text-center">
            <Sparkles className="size-7 text-cyan-400/25" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Wähle eine Map aus dem Baum, um sie von Copilot erklären zu lassen.
            </p>
          </div>
        )}

        {/* Map selected – idle prompt */}
        {activeMap && streamState === 'idle' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 px-5 text-center">
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground/80 truncate max-w-full">
                {mapLabel}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {activeMap.rows}×{activeMap.cols}
                {activeMap.valueUnit ? ` · ${activeMap.valueUnit}` : ''}
              </p>
            </div>
            <Button
              variant="ai"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleExplain}
            >
              <span className="text-[10px] leading-none">✦</span>
              Erklären
            </Button>
          </div>
        )}

        {/* Streaming / done */}
        {activeMap && (streamState === 'loading' || streamState === 'streaming' || streamState === 'done') && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {/* Map pill */}
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-cyan-500/6 border border-cyan-500/12">
                <span className="text-[10px] text-cyan-400 leading-none">✦</span>
                <span className="text-[11px] font-mono text-cyan-300/70 truncate">{mapLabel}</span>
              </div>

              {/* AI message bubble */}
              <div className="rounded-md bg-cyan-500/5 border border-cyan-500/10 px-3 py-2.5">
                {streamState === 'loading' ? (
                  <div className="flex items-center gap-2 py-0.5">
                    <Loader2 className="size-3 text-cyan-400 animate-spin shrink-0" />
                    <span className="text-xs text-muted-foreground">Analysiere Map…</span>
                  </div>
                ) : (
                  <p
                    className={cn(
                      'text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap',
                    )}
                  >
                    {explanation}
                    {streamState === 'streaming' && (
                      <span className="inline-block w-[2px] h-3 bg-cyan-400 ml-0.5 animate-pulse align-middle rounded-sm" />
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-3 pb-2.5 pt-1 shrink-0 border-t border-cyan-500/8">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-[11px] text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/8 gap-1.5"
                onClick={handleExplain}
                disabled={isActive}
              >
                <RefreshCw className={cn('size-3', isActive && 'animate-spin')} />
                {isActive ? 'Lädt…' : 'Erneut erklären'}
              </Button>
            </div>
          </div>
        )}

        {/* Error state */}
        {activeMap && streamState === 'error' && (
          <div className="flex flex-col flex-1 gap-3 p-3">
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-red-500/20 bg-red-500/6">
              <AlertTriangle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-red-400">Fehler</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{error}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/8"
              onClick={handleExplain}
            >
              <RefreshCw className="size-3" />
              Erneut versuchen
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
