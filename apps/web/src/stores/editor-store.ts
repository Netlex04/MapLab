import { create } from 'zustand'
import type { EditorParsedECU, CellChange, EditorAIMessage } from '@/lib/editor/types'

interface EditorStore {
  parsedECU: EditorParsedECU | null
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: string | null

  activeMapId: string | null
  activeView: 'map2d' | 'hex' | 'map3d' | 'diff'
  activeSidebarTab: 'maps' | 'hex' | 'ai'

  pendingChanges: Map<string, CellChange[]>
  selectedCell: [number, number] | null

  aiMessages: EditorAIMessage[]
  mapExplanationCache: Map<string, string>

  setParsedECU: (ecu: EditorParsedECU) => void
  setLoadingState: (s: EditorStore['loadingState'], msg?: string) => void
  setActiveMap: (mapId: string) => void
  setActiveView: (view: EditorStore['activeView']) => void
  setActiveSidebarTab: (tab: EditorStore['activeSidebarTab']) => void
  setSelectedCell: (cell: [number, number] | null) => void
  applyChange: (mapId: string, row: number, col: number, value: number) => void
  revertChange: (mapId: string, row: number, col: number) => void
  revertAll: () => void
  appendAIMessage: (msg: EditorAIMessage) => void
  updateLastAIMessage: (content: string) => void
  setMapExplanation: (key: string, text: string) => void
  clearPendingChanges: () => void
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  parsedECU: null,
  loadingState: 'idle',
  errorMessage: null,
  activeMapId: null,
  activeView: 'map2d',
  activeSidebarTab: 'maps',
  pendingChanges: new Map(),
  selectedCell: null,
  aiMessages: [],
  mapExplanationCache: new Map(),

  setParsedECU: (ecu) =>
    set({ parsedECU: ecu, activeMapId: ecu.maps[0]?.id ?? null, loadingState: 'ready' }),

  setLoadingState: (s, msg) => set({ loadingState: s, errorMessage: msg ?? null }),

  setActiveMap: (mapId) => set({ activeMapId: mapId, selectedCell: null }),

  setActiveView: (view) => set({ activeView: view }),

  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

  setSelectedCell: (cell) => set({ selectedCell: cell }),

  applyChange: (mapId, row, col, value) => {
    const { pendingChanges, parsedECU } = get()
    const map = parsedECU?.maps.find((m) => m.id === mapId)
    if (!map) return

    const originalValue = map.values[row]?.[col]
    if (originalValue === undefined) return

    const newMap = new Map(pendingChanges)
    const changes = [...(newMap.get(mapId) ?? [])]
    const idx = changes.findIndex((c) => c.row === row && c.col === col)

    if (value === originalValue) {
      if (idx >= 0) changes.splice(idx, 1)
    } else {
      if (idx >= 0) {
        const existing = changes[idx]!
        changes[idx] = { row: existing.row, col: existing.col, originalValue: existing.originalValue, newValue: value }
      } else {
        changes.push({ row, col, originalValue, newValue: value })
      }
    }

    if (changes.length === 0) {
      newMap.delete(mapId)
    } else {
      newMap.set(mapId, changes)
    }
    set({ pendingChanges: newMap })
  },

  revertChange: (mapId, row, col) => {
    const { pendingChanges } = get()
    const newMap = new Map(pendingChanges)
    const changes = (newMap.get(mapId) ?? []).filter(
      (c) => !(c.row === row && c.col === col),
    )
    if (changes.length === 0) {
      newMap.delete(mapId)
    } else {
      newMap.set(mapId, changes)
    }
    set({ pendingChanges: newMap })
  },

  revertAll: () => set({ pendingChanges: new Map() }),

  appendAIMessage: (msg) => set((s) => ({ aiMessages: [...s.aiMessages, msg] })),

  updateLastAIMessage: (content) =>
    set((s) => {
      const msgs = [...s.aiMessages]
      const last = msgs[msgs.length - 1]
      if (!last) return s
      msgs[msgs.length - 1] = { role: last.role, timestamp: last.timestamp, content }
      return { aiMessages: msgs }
    }),

  setMapExplanation: (key, text) => {
    const newCache = new Map(get().mapExplanationCache)
    newCache.set(key, text)
    set({ mapExplanationCache: newCache })
  },

  clearPendingChanges: () => set({ pendingChanges: new Map() }),
}))
