# Editor – Implementierungsplan

## Ziel

Ein voll funktionsfähiger, browserseitiger ECU-Map-Editor. Der Nutzer lädt eine ECU-Datei (.bin), sieht alle erkannten Maps in einer strukturierten Baumansicht, kann Werte in einer 2D-Tabelle bearbeiten, eine Hex-Ansicht navigieren und schließlich einen Commit erstellen.

**Scope MVP-Editor**: 2D Map View + Hex View. 3D und Diff kommen danach.

---

## Was alles nötig ist

### 1. Daten-Fundament

| Was | Warum |
|---|---|
| `ECUParser` WASM-Modul im Browser verfügbar | Ohne WASM kein clientseitiges Parsen – Upload würde sofort blockieren |
| `ParsedECU`-Typen als shared TypeScript-Paket | Alle Components und der Zustand Store brauchen eine einheitliche Typdefinition |
| Web Worker für WASM-Aufruf | Parsen einer 1 MB BIN darf den UI-Thread nicht blockieren |
| Initialisierungs-Flow: Datei → Worker → Store | Klar definierter Einstiegspunkt ohne Race Conditions |

### 2. State-Management

| Was | Warum |
|---|---|
| Zustand Store `useEditorStore` | Alle Editor-Views teilen denselben Zustand ohne Prop-Drilling |
| `ParsedECU` im Store (rawBytes + maps) | Basis für alle Views |
| `activeMapId` | Welche Map ist gerade selektiert |
| `pendingChanges: Map<mapId, number[][]>` | Änderungen werden gesammelt, nicht sofort geschrieben |
| `selectedCells: CellRef[]` | Für Multiselect, Copy/Paste, Safety-Check-Scope |
| `isDirty` Flag | Commit-Button aktiv/inaktiv |
| Undo/Redo Stack | Wertänderungen müssen reversibel sein |

### 3. Editor-Shell (Layout)

| Was | Warum |
|---|---|
| `EditorShell` – Vollbild-Layout | Feste Outer-Shell mit Toolbar, Sidebar, Canvas |
| `EditorToolbar` | Aktionen: Speichern (Commit), View-Toggle (Hex/2D/3D/Diff), AI-Button |
| `EditorSidebar` – MapTree | Alle erkannten Maps als Baum, nach Typ gruppiert |
| Sidebar-Resize | Tuner brauchen Platz für die Map-Tabelle |
| View-Switcher | Umschalten zwischen Hex/2D/3D/Diff ohne State-Verlust |

### 4. Map-2D-View (Kern-Feature)

| Was | Warum |
|---|---|
| Virtualisierte Tabelle | Maps können bis 32×32 Zellen haben – kein DOM-Overflow |
| Zell-Editor (Inline) | Doppelklick → Eingabe → Validate → `pendingChanges` schreiben |
| Typenvalidierung pro Zelle | Kein Freitext – nur gültige Zahlen im Wertebereich |
| Axis-Header (X/Y) | Achswerte aus der Map-Definition anzeigen |
| Safety-Highlighting | Zellen außerhalb sicherer Grenzwerte rot/orange markieren |
| Copy/Paste (Excel-kompatibel) | Standard-Workflow für Tuner |

### 5. Hex-View

| Was | Warum |
|---|---|
| Virtualisiertes Hex-Grid | 512 KB–1 MB Buffer – ohne Virtualisierung nicht darstellbar |
| Adress-Column + Hex-Bytes + ASCII-Overlay | Standard-Hex-Editor-Layout |
| Offset-Hervorhebung aus aktiver Map | Nutzer sieht genau, wo im Binary seine Map liegt |
| Navigation per Offset-Sprung | Scrollen zu beliebiger Adresse |
| Read-Only im MVP | Direktes Byte-Editing erhöht Fehlerrisiko massiv |

### 6. Commit-Flow

| Was | Warum |
|---|---|
| `write_map_values()` via WASM | Geänderte Werte werden zurück in den Buffer geschrieben |
| Commit-Dialog (Message eingeben) | Git-Analogie – Nutzer muss Änderungen benennen |
| Upload des modifizierten Buffers | Neuer FileVersion-Eintrag in DB + Storage |
| API Route `/api/commits` POST | Server erstellt Branch/Commit-Record |
| Optimistic Update im Store | UI zeigt `isDirty: false` sofort nach Commit |

### 7. ECU-Parsing Pipeline (End-to-End)

```
Datei-Upload (Drag & Drop / File Input)
    │
    ▼ Web Worker
WASM ECUParser.new(buffer, format)
    │
    ▼
ParsedECU { maps[], rawBytes, metadata }
    │
    ▼ Server: POST /api/fingerprint (Python Microservice)
ECU-Typ erkannt (MS42/MS43/MS45/GS20)
    │
    ▼ Zustand Store
EditorState befüllt → Views rendern
```

### 8. API-Routen

| Route | Methode | Zweck |
|---|---|---|
| `/api/projects/[id]/commits` | POST | Neuen Commit erstellen |
| `/api/projects/[id]/file-versions/[vid]` | GET | Datei aus Storage laden |
| `/api/fingerprint` | POST | ECU-Typ-Erkennung via Python |
| `/api/ai/explain-map` | POST | Map-Erklärung streamen |

### 9. Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| Unbekanntes ECU-Format | Klare Fehlermeldung, Hex-View trotzdem öffnen |
| Ungültige Zell-Eingabe | Inline-Validation, kein Store-Update |
| WASM nicht geladen | Lade-Spinner mit Timeout-Fallback |
| Commit fehlgeschlagen | Toast-Notification, `pendingChanges` bleibt erhalten |

---

## Implementierungsplan

Die Umsetzung erfolgt in klar abgegrenzten Schritten. Jeder Schritt ist funktional abgeschlossen und testbar – nie mehrere offene Enden gleichzeitig.

---

### Schritt 1 – Shared Types & Store-Skeleton

**Ziel**: Alle anderen Schritte haben eine stabile Typ-Basis.

**Dateien**:
- `packages/types/src/editor.ts` – `ParsedECU`, `ECUMap`, `CellRef`, `EditorState`
- `apps/web/src/lib/editor/store.ts` – Zustand Store mit initialem State

**Definition of Done**: `useEditorStore()` ist importierbar, TypeScript kompiliert fehlerfrei.

---

### Schritt 2 – Web Worker + WASM-Integration (Mock)

**Ziel**: Der Parsing-Flow ist verdrahtet, mit Mock-Daten lauffähig.

**Dateien**:
- `apps/web/src/workers/ecu-parser.worker.ts`
- `apps/web/src/lib/editor/use-ecu-parser.ts` – Hook für Worker-Kommunikation

**Strategie**: Erstellt zunächst einen Mock-Parser (`packages/ecu-parser-mock`), der eine Beispiel-`ParsedECU` zurückgibt. WASM wird später eingehängt, ohne den Hook zu ändern.

**Definition of Done**: `useECUParser(file)` gibt `ParsedECU` zurück (Mock), Store wird befüllt.

---

### Schritt 3 – Editor-Shell & Layout

**Ziel**: Das Basis-Layout steht. Toolbar, Sidebar, Canvas sind leere Shells.

**Dateien**:
- `apps/web/src/components/editor/EditorShell.tsx`
- `apps/web/src/components/editor/EditorToolbar.tsx`
- `apps/web/src/components/editor/EditorSidebar.tsx`
- `apps/web/src/app/(app)/projects/[id]/editor/page.tsx` – verbindet Shell mit Store

**Definition of Done**: Die Editor-Route rendert das Layout ohne Fehler. View-Toggle-Buttons sind klickbar (aber ohne Canvas-Inhalt).

---

### Schritt 4 – MapTree (Sidebar)

**Ziel**: Alle Maps aus dem Store werden als Baum angezeigt. Klick selektiert eine Map.

**Dateien**:
- `apps/web/src/components/editor/sidebar/MapTree.tsx`
- `apps/web/src/components/editor/sidebar/MapTreeItem.tsx`

**Definition of Done**: Mock-Maps erscheinen gruppiert nach Typ. Klick setzt `activeMapId` im Store. Aktive Map ist optisch hervorgehoben.

---

### Schritt 5 – Map-2D-View

**Ziel**: Die selektierte Map wird als editierbare Tabelle angezeigt.

**Dateien**:
- `apps/web/src/components/editor/views/Map2DView.tsx`
- `apps/web/src/components/editor/views/MapCell.tsx`

**Features in diesem Schritt**:
- Virtualisierte Tabelle (TanStack Virtual oder eigene Canvas-Lösung)
- Achsen-Header
- Inline-Editing mit Validierung
- `pendingChanges` Update im Store
- Safety-Highlighting (Farbe basierend auf Grenzwerten aus Map-Definition)

**Definition of Done**: Nutzer kann Werte ändern. Geänderte Zellen sind optisch markiert. Store hat `isDirty: true`.

---

### Schritt 6 – Hex-View (Read-Only)

**Ziel**: Hex-Dump des ECU-Buffers mit Hervorhebung der aktiven Map.

**Dateien**:
- `apps/web/src/components/editor/views/HexView.tsx`
- `apps/web/src/components/editor/views/HexRow.tsx`

**Definition of Done**: Buffer wird als virtualisierter Hex-Dump angezeigt. Der Offset-Bereich der aktiven Map ist markiert. Sprung zu Adresse funktioniert.

---

### Schritt 7 – Commit-Flow

**Ziel**: Geänderte Werte werden in den Buffer geschrieben und als neuer Commit gespeichert.

**Dateien**:
- `apps/web/src/components/editor/CommitDialog.tsx`
- `apps/web/src/app/actions/editor.ts` – Server Action für Commit
- `apps/web/src/app/api/projects/[id]/commits/route.ts`

**Flow**:
1. Nutzer klickt „Commit" → Dialog öffnet
2. WASM `write_map_values()` schreibt alle `pendingChanges` in Buffer-Kopie
3. Modifizierter Buffer wird hochgeladen (Supabase Storage)
4. Server erstellt `FileVersion` + `Commit`-Record
5. Store: `pendingChanges` leeren, `isDirty: false`

**Definition of Done**: End-to-End-Test: Upload → Edit → Commit → DB-Eintrag vorhanden.

---

### Schritt 8 – Echter WASM-Parser einhängen

**Ziel**: Mock durch echten Rust/WASM-Parser ersetzen.

**Voraussetzung**: `packages/ecu-parser` (Rust) baut erfolgreich mit `wasm-pack`.

**Änderungen**: Nur in `apps/web/src/workers/ecu-parser.worker.ts` – der Hook aus Schritt 2 bleibt unverändert.

**Definition of Done**: Eine echte MS43-BIN-Datei wird korrekt geparst und Maps erscheinen im MapTree.

---

### Schritt 9 – AI Copilot Panel (optional, nach Core)

**Ziel**: Einklappbares Panel in der Sidebar mit Map-Erklärung via Claude.

**Dateien**:
- `apps/web/src/components/editor/sidebar/AICopilotPanel.tsx`
- `apps/web/src/app/api/ai/explain-map/route.ts`

**Definition of Done**: Klick auf „Erklären" streamt eine Map-Erklärung ins Panel.

---

## Abhängigkeitsgraph

```
[1 Typen + Store]
      │
      ├──► [2 Worker + Mock Parser]
      │         │
      │         └──► [8 Echter WASM Parser]  ← Rust-Build-Voraussetzung
      │
      └──► [3 Editor-Shell]
                │
                ├──► [4 MapTree]
                │
                ├──► [5 Map-2D-View]
                │         │
                │         └──► [7 Commit-Flow]
                │
                └──► [6 Hex-View]
                          │
                          └──► [9 AI Copilot]  ← optional
```

Schritte 4, 5 und 6 können parallel nach Schritt 3 entwickelt werden.

---

## Nicht im Scope (spätere Phasen)

- **Diff-View** (Schritt 10+): Side-by-Side Vergleich zweier Commits
- **3D Map View** (Schritt 11+): Three.js Surface-Rendering
- **Live Collaboration** (Phase 2): Supabase Realtime, Cursor-Sharing
- **Direktes Byte-Editing** im Hex-View
- **AI Autocomplete** beim Bearbeiten von Achsbeschriftungen
