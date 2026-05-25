import { create } from 'zustand'
import type {
  ParsedECU,
  ECUMap,
  CellRef,
  EditorStatus,
  UndoEntry,
  SafetyHighlight,
} from '@maplab/types'
import type { MapDefinition, DefinitionMatchResult } from '@maplab/definition-parser'

// ─── State Shape ──────────────────────────────────────────────────────────────

export interface XdfState {
  definitions: MapDefinition[]
  fileName: string
  warnings: string[]
  stats: { tablesFound: number; constantsFound: number; definitionsCreated: number }
  matchResult: DefinitionMatchResult | null
}

interface EditorState {
  // Parsed ECU data
  parsedECU: ParsedECU | null
  rawBuffer: Uint8Array | null

  // XDF definitions (user-uploaded)
  xdf: XdfState | null

  // UI state
  status: EditorStatus
  error: string | null
  activeMapId: string | null
  activeView: 'hex' | 'map-2d' | 'map-3d' | 'diff'

  // Editing
  pendingChanges: Record<string, number[][]> // mapId → modified values grid
  selectedCells: CellRef[]
  isDirty: boolean

  // Undo/Redo (manual stack – not zundo, because only map edits are undoable)
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface EditorActions {
  // Lifecycle
  setParsedECU: (ecu: ParsedECU, buffer: Uint8Array) => void
  setXdf: (xdf: XdfState | null) => void
  setStatus: (status: EditorStatus, error?: string) => void
  reset: () => void

  // Navigation
  setActiveMap: (mapId: string) => void
  setActiveView: (view: EditorState['activeView']) => void

  // Cell selection
  selectCell: (ref: CellRef) => void
  selectCells: (refs: CellRef[]) => void
  clearSelection: () => void

  // Editing
  setCellValue: (ref: CellRef, value: number) => void
  setCellValues: (mapId: string, values: number[][]) => void
  discardChanges: () => void

  // Undo/Redo
  undo: () => void
  redo: () => void

  // After successful commit
  commitConfirmed: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEffectiveValues(
  map: ECUMap,
  pendingChanges: Record<string, number[][]>,
): number[][] {
  return pendingChanges[map.id] ?? map.values
}

// ─── Store ────────────────────────────────────────────────────────────────────

const INITIAL_STATE: EditorState = {
  parsedECU: null,
  rawBuffer: null,
  xdf: null,
  status: 'idle',
  error: null,
  activeMapId: null,
  activeView: 'map-2d',
  pendingChanges: {},
  selectedCells: [],
  isDirty: false,
  undoStack: [],
  redoStack: [],
}

export const useEditorStore = create<EditorState & EditorActions>()((set, get) => ({
  ...INITIAL_STATE,

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  setParsedECU: (ecu, buffer) =>
    set({
      parsedECU: ecu,
      rawBuffer: buffer,
      status: 'ready',
      error: null,
      activeMapId: ecu.maps[0]?.id ?? null,
      pendingChanges: {},
      selectedCells: [],
      isDirty: false,
      undoStack: [],
      redoStack: [],
    }),

  setXdf: (xdf) => set({ xdf }),

  setStatus: (status, error = undefined) =>
    set({ status, error: error ?? null }),

  reset: () => set(INITIAL_STATE),

  // ── Navigation ──────────────────────────────────────────────────────────────

  setActiveMap: (mapId) => set({ activeMapId: mapId, selectedCells: [] }),

  setActiveView: (view) => set({ activeView: view }),

  // ── Cell selection ──────────────────────────────────────────────────────────

  selectCell: (ref) => set({ selectedCells: [ref] }),

  selectCells: (refs) => set({ selectedCells: refs }),

  clearSelection: () => set({ selectedCells: [] }),

  // ── Editing ─────────────────────────────────────────────────────────────────

  setCellValue: ({ mapId, row, col }, value) => {
    const { parsedECU, pendingChanges, undoStack } = get()
    if (!parsedECU) return

    const map = parsedECU.maps.find((m) => m.id === mapId)
    if (!map) return

    const before = getEffectiveValues(map, pendingChanges)
    const after = before.map((r) => [...r])
    const targetRow = after[row]
    if (!targetRow) return
    targetRow[col] = value

    set({
      pendingChanges: { ...pendingChanges, [mapId]: after },
      isDirty: true,
      undoStack: [...undoStack, { mapId, before, after }],
      redoStack: [],
    })
  },

  setCellValues: (mapId, values) => {
    const { parsedECU, pendingChanges, undoStack } = get()
    if (!parsedECU) return

    const map = parsedECU.maps.find((m) => m.id === mapId)
    if (!map) return

    const before = getEffectiveValues(map, pendingChanges)

    set({
      pendingChanges: { ...pendingChanges, [mapId]: values },
      isDirty: true,
      undoStack: [...undoStack, { mapId, before, after: values }],
      redoStack: [],
    })
  },

  discardChanges: () =>
    set({ pendingChanges: {}, isDirty: false, undoStack: [], redoStack: [] }),

  // ── Undo/Redo ───────────────────────────────────────────────────────────────

  undo: () => {
    const { undoStack, redoStack, pendingChanges } = get()
    const entry = undoStack.at(-1)
    if (!entry) return

    set({
      pendingChanges: { ...pendingChanges, [entry.mapId]: entry.before },
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, entry],
      isDirty: undoStack.length > 1,
    })
  },

  redo: () => {
    const { undoStack, redoStack, pendingChanges } = get()
    const entry = redoStack.at(-1)
    if (!entry) return

    set({
      pendingChanges: { ...pendingChanges, [entry.mapId]: entry.after },
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, entry],
      isDirty: true,
    })
  },

  // ── Post-commit ─────────────────────────────────────────────────────────────

  commitConfirmed: () =>
    set({ pendingChanges: {}, isDirty: false, undoStack: [], redoStack: [] }),
}))

// ─── Selectors ────────────────────────────────────────────────────────────────

export function selectActiveMap(state: EditorState): ECUMap | null {
  if (!state.parsedECU || !state.activeMapId) return null
  return state.parsedECU.maps.find((m) => m.id === state.activeMapId) ?? null
}

export function selectActiveMapValues(state: EditorState): number[][] | null {
  const map = selectActiveMap(state)
  if (!map) return null
  return state.pendingChanges[map.id] ?? map.values
}

const EMPTY_HIGHLIGHTS: SafetyHighlight[] = []
let _lastSafetyFlagsRef: ECUMap['safetyFlags'] | undefined = undefined
let _lastSafetyHighlights: SafetyHighlight[] = EMPTY_HIGHLIGHTS

export function selectSafetyHighlights(state: EditorState): SafetyHighlight[] {
  const map = selectActiveMap(state)
  const flags = map?.safetyFlags
  if (!flags) return EMPTY_HIGHLIGHTS
  if (flags === _lastSafetyFlagsRef) return _lastSafetyHighlights

  _lastSafetyFlagsRef = flags
  _lastSafetyHighlights = flags.flatMap((flag) =>
    (flag.affectedCells ?? []).map(([row, col]) => ({
      row,
      col,
      severity: flag.severity,
    })),
  )
  return _lastSafetyHighlights
}

export function selectCanUndo(state: EditorState): boolean {
  return state.undoStack.length > 0
}

export function selectCanRedo(state: EditorState): boolean {
  return state.redoStack.length > 0
}
