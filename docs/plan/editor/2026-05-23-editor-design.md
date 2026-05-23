# ECU Map Editor — Design Spec

**Datum:** 2026-05-23  
**Status:** Approved  
**Scope:** MVP-Editor für Siemens MS4X (MS42, MS43, MS45, GS20)

---

## Entscheidungen (zusammengefasst)

| Thema | Entscheidung | Begründung |
|---|---|---|
| Layout | C — Sidebar-Tabs + Canvas-Tabs | Maximale Canvas-Fläche, AI nicht immer sichtbar |
| Bootstrap | Hybrid — Mock + DataSource-Interface | Kein Blocking durch WASM oder Python-Service |
| Erster View | 2D Map Table | Kern des Tuning-Workflows, keine schweren Deps |
| Edit-Scope | Editierbar — pendingChanges → BIN-Export | Echter Nutzen, differenziert von reinen Viewern |
| AI Copilot | Map-Erklärung + freier Chat (Streaming) | Spürbar nützlich ohne Kosten bei jeder Änderung |

---

## Layout

```
EditorShell (h-screen, flex, flex-col)
├── EditorToolbar (48px)
│   ├── Breadcrumb: "username / project-name · branch @ hash"
│   ├── ViewTabs: [2D Map | Hex | 3D | Diff]  ← aktiv: Amber underline
│   └── ActionBar: PendingDot · SafetyBadge · CommitButton (Amber)
├── EditorBody (flex-1, flex, overflow-hidden)
│   ├── EditorSidebar (200px, bg-elevated, border-r)
│   │   ├── SidebarTabs: [◫ Maps | ⬡ Hex | ✦ AI]
│   │   │   Maps/Hex active = Amber,  AI active = Purple
│   │   └── SidebarContent (per Tab)
│   │       ├── MapTreePanel   (Tab: Maps)
│   │       ├── HexNavPanel    (Tab: Hex — Stub für später)
│   │       └── AICopilotPanel (Tab: AI)
│   └── EditorCanvas (flex-1, bg-base)
│       ├── CanvasHeader: Map-Titel (Rajdhani) + Meta (JetBrains Mono)
│       ├── CanvasBody: aktiver View
│       │   └── Map2DView (MVP), HexView / Map3DView / DiffView (später)
│       └── StatusBar (28px): Cell · Value · Original · Delta · Safety
```

---

## Komponenten

### EditorPage (`/projects/[id]/editor/page.tsx`)
- Server Component
- Lädt Projekt + aktiven Branch + letzten Commit (inkl. File-URL aus R2/Storage)
- Übergibt `initialData` an `EditorShell`
- Redirect auf `/projects/[id]` wenn kein Commit vorhanden

### EditorShell (`editor/components/editor-shell.tsx`)
- Client Component (`'use client'`)
- Initialisiert Zustand-Store mit `initialData`
- Ruft `DataSource.loadECU()` auf und befüllt den Store
- Rendert Toolbar, Sidebar, Canvas

### EditorToolbar (`editor/components/editor-toolbar.tsx`)
- Breadcrumb mit Projekt-Link und Commit-Hash (Cyan, `<CommitHash>`)
- `<Tabs>` (shadcn) für View-Wechsel — amber active state
- Pending-Dot (Orange, `#F97316`) wenn `pendingChanges.size > 0`
- `<SafeScore>` Badge oder simplifiziertes `✓ Safe` / `⚠ Warning`
- Commit-Button (`<Button>` Primary — Amber fill) → öffnet `<CommitDialog>`

### MapTreePanel (`editor/components/map-tree-panel.tsx`)
- Suchfeld (`<Input>` monospace) — filtert Maps by name
- Maps gruppiert: Torque / Fuel / Ignition / VVT / (weitere)
- Farbige Dots pro Gruppe (Amber / Green / Orange / Cyan)
- Klick → setzt `activeMapId` im Store
- Aktive Map: amber highlight (`bg-amber-500/8 text-amber-400`)

### AICopilotPanel (`editor/components/ai-copilot-panel.tsx`)
- Basiert auf `<AICopilotPanel>` aus Design-System (purple/cyan gradient border)
- Zwei Zonen:
  1. **Map-Erklärung** (oben, fixed height): Lädt wenn `activeMapId` sich ändert. API-Call auf `/api/ai/explain`, gecacht per Map-Hash (Haiku 4.5). Zeigt `✦`-Icon + Erklärungstext.
  2. **Chat** (unten, scrollable): Freie Eingabe, Streaming via SSE auf `/api/ai/chat`. Kontext: aktive Map-Daten + ECU-Typ. Sonnet 4.6.
- Input am unteren Rand mit Send-Button (`variant="ai"`)

### Map2DView (`editor/components/map-2d-view.tsx`)
- Basiert auf `<MapGrid>` aus Design-System
- Props: `map: ParsedMap`, `pendingChanges`, `selectedCell`, `onCellSelect`, `onCellChange`
- Heatmap: `heat-1` bis `heat-5` (amber transparent) — Stufe = normierter Wert in Range
- Selektierte Zelle: `outline-2 ring-amber-500` (amber)
- Geänderte Zelle: `outline-2 ring-orange-500` (orange), zeigt neuen Wert
- Doppelklick / Enter → Inline-Input (kleines `<Input>` in der Zelle), Blur/Enter bestätigt
- Keyboard-Navigation: Arrow-Keys bewegen Selektion
- `role="grid"` + `role="gridcell"` für Accessibility

### StatusBar (`editor/components/status-bar.tsx`)
- 28px, `bg-elevated`, `border-t`
- Links: Cell (R:C) · Value · Original · Delta (Orange wenn geändert)
- Rechts: `N cells modified` · Safety-Status (Green / Amber / Red)
- Font: JetBrains Mono 9px

### CommitDialog (`editor/components/commit-dialog.tsx`)
- shadcn `<Dialog>`
- Zeigt Summary der `pendingChanges` (Map-Name, Anzahl Zellen, Delta)
- `<Input>` für Commit-Message
- Auf Submit:
  1. Safety-Check via `/api/ecu/safety-check` (Python-Service)
  2. Wenn failed → `<Alert>` (red variant) mit Details, kein Commit möglich
  3. Wenn passed → Export via `/api/ecu/export` → neue BIN → `uploadCommit` Action
- `<DiffLine>` Komponenten für jede geänderte Map

---

## State Management (Zustand)

```typescript
// apps/web/src/stores/editor-store.ts

interface EditorStore {
  // Geladene ECU-Daten
  parsedECU: ParsedECU | null
  loadingState: 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: string | null

  // Navigation
  activeMapId: string | null
  activeView: 'map2d' | 'hex' | 'map3d' | 'diff'
  activeSidebarTab: 'maps' | 'hex' | 'ai'

  // Editing
  pendingChanges: Map<string, CellChange[]>  // mapId → Änderungen
  selectedCell: [number, number] | null       // [row, col]

  // AI
  aiMessages: AIMessage[]
  mapExplanationCache: Map<string, string>    // mapHash → Erklärung

  // Actions
  setActiveMap: (mapId: string) => void
  setSelectedCell: (cell: [number, number]) => void
  applyChange: (mapId: string, row: number, col: number, value: number) => void
  revertChange: (mapId: string, row: number, col: number) => void
  revertAll: () => void
  appendAIMessage: (msg: AIMessage) => void
}
```

---

## Typen

```typescript
// packages/types/src/editor.ts

interface ParsedECU {
  metadata: ECUMetadata        // von Fingerprint-API
  maps: ParsedMap[]
}

interface ParsedMap {
  id: string                   // z.B. "ms43_torque_limiter"
  name: string                 // z.B. "Torque Limiter"
  group: MapGroup              // TORQUE | FUEL | IGNITION | VVT | OTHER
  offset: number               // Byte-Offset in der Binary
  rows: number
  cols: number
  xAxisLabel: string           // z.B. "RPM"
  yAxisLabel: string           // z.B. "Load %"
  xAxisValues: number[]
  yAxisValues: number[]
  values: number[][]
  unit: string                 // z.B. "Nm", "°KW", "λ"
  min: number                  // für Heatmap-Normierung
  max: number
}

interface CellChange {
  row: number
  col: number
  originalValue: number
  newValue: number
}

interface AIMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
```

---

## DataSource-Interface

```typescript
// apps/web/src/lib/editor/data-source.ts

interface DataSource {
  loadECU(fileUrl: string, ecuMeta: ECUMetadata): Promise<ParsedECU>
}

// Aktiv im MVP — realistic hardcoded MS43 maps
class MockDataSource implements DataSource { ... }

// Wird eingestöpselt sobald Python /parse/full implementiert ist
class APIDataSource implements DataSource { ... }

// Wird eingestöpselt sobald WASM-Parser fertig ist
class WASMDataSource implements DataSource { ... }

// Feature-Flag in env: NEXT_PUBLIC_EDITOR_DATASOURCE=mock|api|wasm
export function createDataSource(): DataSource { ... }
```

---

## API-Routes (MVP)

| Route | Methode | Beschreibung |
|---|---|---|
| `/api/ai/explain` | POST | Map-Erklärung (Haiku 4.5, gecacht) |
| `/api/ai/chat` | POST | Streaming-Chat (Sonnet 4.6, SSE) |
| `/api/ecu/safety-check` | POST | Weiterleitung an Python-Service |
| `/api/ecu/export` | POST | Geänderte Werte → neue BIN; im MVP: Mock-Implementierung patcht Werte direkt in die geladene Byte-Kopie |

Bestehende Routes bleiben unverändert: `/api/ecu/fingerprint`, `uploadCommit` Action.

---

## Mock-Daten (MS43)

Die Mock-Daten bilden realistische MS43-Karten ab:

- **Torque Limiter** — 8×6, RPM × Last, 85–310 Nm
- **Lambda Target** — 8×6, RPM × Last, 0.75–1.00 λ
- **Ignition Advance** — 8×6, RPM × Last, 5–28 °KW
- **VVT Intake** — 6×4, RPM × Last, 0–40°

Offsets sind bewusst plausibel (basierend auf MS43-Dokumentation von ms4x.net), aber nicht produktiv verwendbar — das ist Aufgabe des echten Parsers.

---

## Commit-Flow (mit Editing)

```
1. Nutzer editiert Zellen → pendingChanges im Store
2. StatusBar zeigt "N cells modified"
3. Nutzer klickt "↑ Commit" → CommitDialog öffnet
4. Dialog zeigt: DiffLines (Map · Zelle · vorher → nachher)
5. Nutzer gibt Commit-Message ein
6. Submit:
   a. POST /api/ecu/safety-check (pendingChanges als map_values)
   b. Wenn FAILED → Alert anzeigen, abbrechen
   c. Wenn OK → POST /api/ecu/export → neue BIN-Bytes
   d. uploadCommit(projectId, branchId, newBin, message)
7. Store: pendingChanges leeren, Router refresh
```

---

## AI-Integration

### Map-Erklärung
```
Trigger: activeMapId ändert sich (im AICopilotPanel)
Cache-Key: SHA-256(map.id + map.values.flat().join(","))
Modell: claude-haiku-4-5 (günstig, gut für strukturierten Output)
System-Prompt: ECU-Experte, erkläre Maps verständlich für Hobby-Tuner,
               Deutsch, keine konkreten Wertvorschläge ohne Kontext
```

### Chat
```
Trigger: Nutzer sendet Nachricht
Kontext: activeMap.name, activeMap.unit, ecuType, selectedCell-Wert
Modell: claude-sonnet-4-6
Transport: Server-Sent Events (Next.js Route Handler mit ReadableStream)
Safety-Constraints (hardcoded im System-Prompt, nicht überschreibbar):
  - Schlage niemals konkrete Werte ohne explizite Anfrage vor
  - Weise auf Fahrzeugsicherheit hin bei kritischen Maps
  - Erzeuge niemals direkt flashbare Output-Daten
```

---

## Design-System-Compliance

| Element | Token / Komponente |
|---|---|
| Primary accent (Tabs, Buttons, Selection) | `amber` — `#F59E0B` |
| AI-Akzent (AI-Tab, AI-Panel) | `purple` — `#A855F7` |
| Commit-Hashes | `cyan` — `#22D3EE` |
| Modified cells | `orange` — `#F97316` |
| Safety OK | `green` — `#10B981` |
| Heatmap | `map-heat-1` … `map-heat-5` (amber/transparent) |
| Backgrounds | `bg-base` `#0B0D11` / `bg-elevated` `#131620` / `bg-surface` `#1C1F29` |
| Display-Titel | Rajdhani 600/700 |
| Body-Text | Outfit 400/500 |
| Hex-Werte, Adressen, Mono | JetBrains Mono |
| Map Grid | `<MapGrid>` (components.md) |
| AI Panel | `<AICopilotPanel>` (components.md) |
| Safe Indicator | `<SafeScore>` (components.md) |
| Commit Hash | `<CommitHash>` (components.md) |
| Commit Dialog | shadcn `<Dialog>` |
| Safety Alert | shadcn `<Alert>` (red variant) |
| View-Tabs | shadcn `<Tabs>` (amber active) |

---

## Explizit außerhalb MVP-Scope

| Feature | Warum zurückgestellt |
|---|---|
| Hex View (Monaco) | Großes Dependency, nicht der primäre Tuning-Workflow |
| 3D Surface (Three.js) | Phase 2 |
| Diff View | Phase 2 |
| WASM Parser (Rust) | Eigenes Ticket → `docs/plan/open-todos.md` |
| Live Collaboration (Supabase Realtime) | Phase 2 |
| AI Map-Klassifikation | Nach WASM (braucht echte Offsets) |
| Python `/parse/full` | Eigenes Ticket → `docs/plan/open-todos.md` |

---

## Dateistruktur (neu)

```
apps/web/src/
├── app/(app)/projects/[id]/editor/
│   ├── page.tsx                        # Server Component
│   └── components/
│       ├── editor-shell.tsx
│       ├── editor-toolbar.tsx
│       ├── map-tree-panel.tsx
│       ├── ai-copilot-panel.tsx
│       ├── map-2d-view.tsx
│       ├── status-bar.tsx
│       └── commit-dialog.tsx
├── app/api/
│   ├── ai/
│   │   ├── explain/route.ts
│   │   └── chat/route.ts
│   └── ecu/
│       ├── fingerprint/route.ts        # bereits vorhanden
│       ├── safety-check/route.ts
│       └── export/route.ts
├── stores/
│   └── editor-store.ts                 # Zustand
└── lib/editor/
    ├── data-source.ts                  # Interface + Implementierungen
    ├── mock-data.ts                    # MS43 Mock-Maps
    └── heatmap.ts                      # Wert → heat-1…5 Normierung
```
