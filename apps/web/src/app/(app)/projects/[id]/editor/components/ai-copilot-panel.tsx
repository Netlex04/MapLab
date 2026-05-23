'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useEditorStore } from '@/stores/editor-store'

interface AICopilotPanelProps {
  ecuType: string | null
}

export function AICopilotPanel({ ecuType }: AICopilotPanelProps) {
  const {
    parsedECU,
    activeMapId,
    selectedCell,
    aiMessages,
    mapExplanationCache,
    appendAIMessage,
    updateLastAIMessage,
    setMapExplanation,
  } = useEditorStore()

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeMap = parsedECU?.maps.find((m) => m.id === activeMapId)

  // Cache key — changes whenever map values or id change
  const cacheKey = activeMap
    ? `${activeMap.id}:${activeMap.values.flat().join(',')}`
    : null

  const explanation = cacheKey ? mapExplanationCache.get(cacheKey) : undefined

  // Auto-load explanation when map changes
  useEffect(() => {
    if (!activeMap || !cacheKey || explanation !== undefined || loadingExplanation) return

    setLoadingExplanation(true)
    fetch('/api/ai/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mapId: activeMap.id,
        mapName: activeMap.name,
        unit: activeMap.unit,
        ecuType,
      }),
    })
      .then((r) => r.json())
      .then((data: { explanation?: string }) => {
        if (data.explanation) setMapExplanation(cacheKey, data.explanation)
        else setMapExplanation(cacheKey, '')
      })
      .catch(() => setMapExplanation(cacheKey ?? '', ''))
      .finally(() => setLoadingExplanation(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages])

  const selectedCellValue =
    activeMap && selectedCell
      ? (() => {
          const changes =
            useEditorStore.getState().pendingChanges.get(activeMapId ?? '') ?? []
          const change = changes.find(
            (c) => c.row === selectedCell[0] && c.col === selectedCell[1],
          )
          return change ? change.newValue : activeMap.values[selectedCell[0]]?.[selectedCell[1]] ?? null
        })()
      : null

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    appendAIMessage({ role: 'user', content: text, timestamp: Date.now() })
    appendAIMessage({ role: 'assistant', content: '', timestamp: Date.now() })
    setStreaming(true)

    try {
      const history = useEditorStore
        .getState()
        .aiMessages.slice(0, -1)
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          context: {
            activeMapName: activeMap?.name ?? null,
            ecuType,
            selectedCellValue,
          },
        }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') break
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string }
            if (parsed.text) {
              accumulated += parsed.text
              updateLastAIMessage(accumulated)
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch {
      updateLastAIMessage('Fehler beim Laden der Antwort.')
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* AI header */}
      <div className="border-b border-purple-500/20 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-purple-400">✦</span>
          <span className="font-mono text-label uppercase tracking-widest text-purple-400">
            AI Copilot
          </span>
        </div>
      </div>

      {/* Map explanation */}
      <div
        className="border-b border-border px-3 py-2.5"
        style={{ background: 'linear-gradient(to bottom right, rgba(168,85,247,0.04), rgba(34,211,238,0.03))' }}
      >
        {!activeMap ? (
          <p className="font-mono text-label text-muted-foreground">Wähle eine Karte aus</p>
        ) : loadingExplanation || explanation === undefined ? (
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 animate-pulse rounded-full bg-purple-500" />
            <span className="font-mono text-label text-muted-foreground">Analysiere…</span>
          </div>
        ) : explanation ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{explanation}</p>
        ) : (
          <p className="font-mono text-label text-muted-foreground">Keine Erklärung verfügbar</p>
        )}
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {aiMessages.length === 0 && (
          <p className="font-mono text-label text-muted-foreground/60 text-center pt-4">
            Stelle eine Frage zur aktiven Karte…
          </p>
        )}
        {aiMessages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'ml-2 rounded bg-secondary px-2 py-1.5 text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {msg.role === 'assistant' && (
              <span className="mr-1 text-purple-400">✦</span>
            )}
            {msg.content || (streaming && i === aiMessages.length - 1 ? (
              <span className="inline-block h-3 w-1 animate-pulse bg-purple-400" />
            ) : '')}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-2">
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Frage stellen…"
            className="h-7 flex-1 font-mono text-xs"
            disabled={streaming}
          />
          <Button
            size="sm"
            variant="ai"
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="h-7 px-2 text-xs"
          >
            ✦
          </Button>
        </div>
      </div>
    </div>
  )
}
