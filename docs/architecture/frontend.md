# Frontend-Architektur

## Technologie-Stack

| Schicht | Technologie | Begründung |
|---|---|---|
| Framework | **Next.js 15** (App Router) | SSR für SEO/Landing, Client-Side für Editor |
| Sprache | **TypeScript** | Typsicherheit für komplexe ECU-Datenstrukturen |
| Styling | **Tailwind CSS + shadcn/ui** | VSCode/Figma-ähnliche Dark-Mode-UX |
| 3D Rendering | **Three.js / React Three Fiber** | 3D Map View |
| Hex Editor | **Monaco Editor** (Kern) | VSCode-Feeling, bekannt für Entwickler |
| WASM Runtime | **Rust → WASM** | ECU-Parsing direkt im Browser |
| State | **Zustand** | Leichtgewichtig, kein Redux-Overhead |
| Data Fetching | **TanStack Query** | Caching, Optimistic Updates |
| Realtime | **Supabase Realtime** | Live Collaboration |

---

## App-Struktur (Next.js App Router)

```
app/
├── (marketing)/          # Landing, Pricing, Docs
│   ├── page.tsx
│   └── pricing/
├── (auth)/               # Login, Register, OAuth
│   ├── login/
│   └── register/
├── (app)/                # Hauptanwendung (authenticated)
│   ├── dashboard/        # Projektübersicht
│   ├── projects/
│   │   ├── [id]/
│   │   │   ├── page.tsx         # Projekt-Übersicht
│   │   │   ├── editor/          # Map-Editor
│   │   │   │   ├── hex/         # Hex View
│   │   │   │   ├── map-2d/      # 2D Tabellenansicht
│   │   │   │   ├── map-3d/      # 3D Surface
│   │   │   │   └── diff/        # Vergleichsansicht
│   │   │   ├── versions/        # Commit-Historie
│   │   │   └── settings/
│   ├── explore/          # Community Feed
│   ├── marketplace/      # Phase 3
│   └── profile/[username]/
├── api/                  # API Routes (Server Actions bevorzugt)
└── layout.tsx
```

---

## Editor-Architektur

Der browserbasierte Map-Editor ist das Herzstück der Plattform.

```
EditorShell
├── EditorToolbar          # Aktionen, Versionsinfo, AI-Button
├── EditorSidebar
│   ├── MapTree            # Alle erkannten Maps
│   ├── SearchPanel        # „Zeige alle Torque Limiter"
│   └── AICopilotPanel     # Chat + Erklärungen
└── EditorCanvas
    ├── HexView            # Monaco-basiert, Byte-Highlighting
    ├── Map2DView          # AG Grid / eigene Canvas-Tabelle
    ├── Map3DView          # Three.js Surface
    └── DiffView           # Side-by-Side Vergleich
```

### Datenfluss im Editor

```
ECU-Datei (BIN/HEX/...)
    │
    ▼ (WASM ECU Parser)
ParsedECU
    ├── maps: Map[]
    ├── rawBytes: Uint8Array
    └── metadata: ECUMetadata
    │
    ▼ (Zustand Store)
EditorState
    ├── activeMap
    ├── selectedCells
    ├── pendingChanges
    └── aiContext
    │
    ▼ (React Components)
Rendered Views
```

---

## WASM Integration

```typescript
// packages/ecu-parser-wasm/
interface ECUParser {
  parse(buffer: Uint8Array, format: FileFormat): ParsedECU;
  validateChecksum(buffer: Uint8Array): ChecksumResult;
  generateDiff(base: Uint8Array, modified: Uint8Array): BinaryDiff;
  exportBin(ecu: ParsedECU): Uint8Array;
}
```

Der WASM-Core wird als separates npm-Package verwaltet und aus dem Rust-Workspace gebaut.

---

## Performance-Strategie

- **Code Splitting**: Editor-Bundle separat, nur bei Bedarf laden
- **Worker Threads**: Hex-Parsing in Web Worker (kein UI-Blocking)
- **Virtualisierung**: Große Hex-Tabellen mit virtuellem Scrolling
- **Lazy WASM**: WASM-Modul erst nach Upload initialisieren
