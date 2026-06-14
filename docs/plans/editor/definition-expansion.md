# Definitions & Parser – Implementierungsplan

## Ziel

Vier parallele Zielrichtungen, die zusammen den ECU-Parsing-Kern produktionsreif machen:

1. **WASM-Modul vollständig verdrahten** – `extract_maps_from_definitions()` ist fertig in Rust, wird aber nie aufgerufen. Das reparieren.
2. **Python-Service erweiterbar machen** – weg von der manuellen Registry, hin zu Auto-Discovery.
3. **Neue Upload-Formate** – A2L, DAMOS, KP und raw JSON neben XDF.
4. **Definitions-Pool erweitern und verifizieren** – mehr ECUs, Confidence-System, Verification Workflow.

---

## Ist-Zustand (Probleme)

| Problem | Datei | Detail |
|---|---|---|
| `extract_maps_from_definitions()` ungenutzt | `ecu-parser-wasm/src/index.ts` | JS-Bindings exponieren die Methode nicht; Worker ruft TS `extractMaps()` auf |
| `parseECU()` gibt immer leere Maps zurück | `ecu-parser-wasm/src/index.ts` | Nur Metadaten (checksum, size) kommen aus WASM |
| `getHexSlice` & `computeDiff` bypassen WASM | `ecu-parser-wasm/src/index.ts` | Pure-JS-Implementierungen, WASM-Methoden ungenutzt |
| Python-Registry ist manuell | `services/ecu-engine/parse.py` | Jede neue ECU muss in `_DEFINITION_REGISTRY` eingetragen werden |
| MS42: alle 2875 Maps `category: "unknown"` | `internal/ms42/0110c6.json` | Kein einziger Eintrag kategorisiert |
| MS43: kein `confidence: "verified"` | `internal/ms43/ms430069.json` | Alle 3730 Einträge `"definition"` |
| Keine Achswerte | beide JSONs | Alle `xAxis.source: "index"` – echte Achswerte fehlen |
| MS45 fehlt komplett | – | XDF liegt in `local-fixtures/`, kein internes JSON |
| Nur XDF als Upload-Format | `xdf/parse-xdf.ts` | A2L, DAMOS, KP, JSON nicht unterstützt |
| Kein CAL/Full-Bin-Offset-Handling | überall (Extraction + Write) | `def.offset` wird immer als Datei-Offset gelesen. CAL-only-Bins (rausgeschnittener Kalibrierungsblock) und A2L-Absolutadressen liefern dadurch falsche Werte oder Out-of-Bounds |

---

## Abhängigkeitsgraph

```
[Phase 1: WASM Verdrahtung]
          ↓
[Phase 2: Python Auto-Discovery]   [Phase 6: CAL/Full-Bin Adressraum]
          ↓                                  ↓
          │                         [Phase 3: Neue Formate (A2L nutzt 6)]
          ↓                                  ↓
[Phase 4: Definition Expansion]  ←───────────┘
          ↓
[Phase 5: Verification Workflow]
```

Phase 1 ist Voraussetzung für Phase 4 (saubere IDs). Phase 6 ist Voraussetzung für A2L (3B) und Bosch-ECUs (4C), weil deren Adressen nicht datei-absolut sind. Phase 2 läuft unabhängig parallel.

---

## Phase 1 – WASM Verdrahtung ✅ Abgeschlossen

### Ziel

Rust `extract_maps_from_definitions()` ist der autoritative Extraction-Pfad. TypeScript `extractMaps()` bleibt als Fallback.

### Hintergrund

`lib.rs` hat `extract_maps_from_definitions(definitions_js: JsValue) → JsValue` vollständig implementiert. Die JS-Bindings (`ecu-parser-wasm/src/index.ts`) kennen nur `parser.extract_maps()` (gibt leere Maps zurück). Das muss korrigiert werden.

### 1A – JS-Bindings erweitern ✅

**Datei:** `packages/ecu-parser-wasm/src/index.ts`

Neue Methode im `WasmECUParser`-Interface:

```ts
interface WasmECUParser {
  extract_maps(): unknown
  extract_maps_from_definitions(definitions: unknown): unknown  // NEU
  get_hex_slice(offset: number, length: number): unknown
  checksum(): string
  fast_diff(other: WasmECUParser): unknown
  write_map_values(mapId: string, values: number[][]): Uint8Array
  free(): void
}
```

Neue exportierte Funktion:

```ts
export async function extractMapsFromDefinitionsWasm(
  buffer: Uint8Array,
  format: FileFormat,
  definitions: MapDefinition[],
): Promise<ExtractionResult | null> {
  if (!wasmModule) wasmModule = await loadWasm()
  if (!wasmModule) return null

  const parser = new wasmModule.ECUParser(buffer, format)
  try {
    const result = parser.extract_maps_from_definitions(definitions) as ExtractionResult
    return result
  } finally {
    parser.free()
  }
}
```

`parseECU()` bleibt wie es ist (Metadaten-Quelle). Extraction läuft separat.

### 1B – Worker umstellen ✅

**Datei:** `apps/web/src/workers/ecu-parser.worker.ts`

Im `case 'parse'`-Block: Nach dem Laden der Definitions WASM-Extraction versuchen, bei Fehler auf TS-Extraction zurückfallen:

```ts
import { parseECU, getHexSlice, writeMapValues, extractMapsFromDefinitionsWasm } from '@maplab/ecu-parser-wasm'

// im parse-Handler:
if (definitions.length > 0) {
  const matchResult = matchDefinitions(buffer, definitions)
  result.matchStatus = /* ... bestehende Logik ... */

  // WASM-Extraction versuchen – fällt auf TS zurück wenn WASM nicht geladen
  const wasmExtraction = await extractMapsFromDefinitionsWasm(buffer, msg.format, definitions)
  const extraction = wasmExtraction ?? extractMaps(buffer, definitions)

  const safety = runSafetyChecks(buffer, definitions, extraction, matchResult)
  result.maps = extraction.maps.map((m): ECUMap => { /* bestehende Mapping-Logik */ })
  result.warnings = /* ... */
}
```

**Warum nicht nur WASM?** WASM-Binaries können in manchen Umgebungen nicht geladen werden (CSP, ältere Browser, Tests). TS-Fallback bleibt immer aktiv.

### 1C – `getHexSlice` auf WASM umstellen ✅

**Datei:** `packages/ecu-parser-wasm/src/index.ts`

Die aktuelle JS-Implementierung ist korrekt, aber `get_hex_slice()` im WASM hat dieselbe Logik. Für Konsistenz WASM nutzen wenn verfügbar:

```ts
export async function getHexSlice(buffer: Uint8Array, offset: number, length: number): Promise<HexSlice> {
  if (!wasmModule) wasmModule = await loadWasm()
  if (wasmModule) {
    const parser = new wasmModule.ECUParser(buffer, 'BIN')
    try {
      return parser.get_hex_slice(offset, length) as HexSlice
    } finally {
      parser.free()
    }
  }
  // JS-Fallback bleibt:
  const slice = buffer.slice(offset, offset + length)
  // ...
}
```

### 1D – Write-Pfad: JS-Bypass beibehalten (bewusste Entscheidung) ✅

Die aktuelle JS-Implementierung von `writeMapValues()` ist korrekt:
- Reverse-Scaling (`raw = (scaled - offset) / factor`)
- Alle DataTypes unterstützt
- Alle Endianness-Varianten

Die Rust-Version schreibt nur `uint16 big-endian` ohne Reverse-Scaling. Das **nicht** ändern – JS-Bypass bleibt der autoritative Write-Pfad. Dokumentation im Code aktualisieren.

### Definition of Done Phase 1

- `extractMapsFromDefinitionsWasm()` ist aufrufbar
- Worker nutzt WASM wenn verfügbar, TS als Fallback
- Extraction-Ergebnisse sind identisch (Spot-Check MS43 + MS42)
- Kein Panic bei falschem oder fehlendem WASM-Binary

---

## Phase 2 – Python Service Auto-Discovery ✅ Abgeschlossen

### Ziel

Statt manueller Registry werden Definition-JSONs automatisch aus dem Dateisystem geladen. Neue ECUs werden durch Ablegen einer JSON-Datei verfügbar, ohne Code-Änderung.

### 2A – Registry durch Discovery ersetzen ✅

**Datei:** `services/ecu-engine/parse.py`

Aktuell:
```python
_DEFINITION_REGISTRY: dict[str, list[dict[str, str]]] = {
    "Siemens MS43": [{"sw_version": "MS430069", "path": "ms43/ms430069.json"}],
    "Siemens MS42": [{"sw_version": "0110C6",   "path": "ms42/0110c6.json"}],
}
```

Neu: Automatisches Scannen von `_DEFS_ROOT/**/*.json`. Aus dem ersten Eintrag jedes JSON-Arrays werden ECU-Typ und Software-Version gelesen (aus `compatibility`-Feld):

```python
def _discover_definitions() -> dict[str, list[dict]]:
    """
    Scannt _DEFS_ROOT/**/*.json und baut die Registry aus den
    compatibility-Feldern der Definition-Einträge.
    """
    registry: dict[str, list[dict[str, str]]] = {}
    for path in sorted(_DEFS_ROOT.rglob("*.json")):
        try:
            with open(path) as f:
                defs = json.load(f)
            if not defs:
                continue
            compat = defs[0].get("compatibility", {})
            ecu_raw = compat.get("ecu")          # z.B. "MS43"
            sw_ver  = compat.get("softwareVersion")  # z.B. "MS430069"
            if not ecu_raw:
                continue
            # Normalisieren auf "Siemens MS43"-Format
            ecu_key = f"Siemens {ecu_raw.upper()}"
            entry = {"sw_version": sw_ver or "", "path": str(path.relative_to(_DEFS_ROOT))}
            registry.setdefault(ecu_key, []).append(entry)
        except Exception:
            continue
    return registry

_DEFINITION_REGISTRY = _discover_definitions()
```

### 2B – `load_definitions()` anpassen ✅ (keine Änderung nötig – ECU-Keys stimmen bereits überein)

Fingerprint gibt `ecu_type` als `"Siemens MS43"` zurück. `load_definitions()` greift damit direkt auf die Discovery-Registry zu. Keine weitere Änderung nötig.

### 2C – Fingerprint-Erweiterung Python ✅ (MS42-Größenbug gefixt: 512_000 → 524_288)

**Datei:** `services/ecu-engine/fingerprint.py`

Prüfen und analog zu TS-Fingerprinting für neue ECUs erweitern. Fingerprint-Entries als Daten-Array (nicht als Code-Logik) definieren – dann sind neue ECUs durch Daten-Erweiterung hinzufügbar, nicht durch Code-Änderung.

### Definition of Done Phase 2

- Neue JSON-Datei unter `internal/ms45/` wird automatisch erkannt
- Bestehende Tests für MS42/MS43 bleiben grün
- Registry-Log beim Start (wie viele Definitions geladen)

---

## Phase 3 – Neue Upload-Formate

### Überblick

| Format | Priorität | Aufwand | Datei | Status |
|---|---|---|---|---|
| JSON (raw `MapDefinition[]`) | Hoch | Klein | `json/parse-json.ts` | ✅ |
| A2L (ASAP2) | Hoch | Mittel | `a2l/parse-a2l.ts` | offen |
| DAMOS | Mittel | Mittel | `damos/parse-damos.ts` | offen (Sample fehlt) |
| KP | Mittel | Klein–Groß* | `kp/parse-kp.ts` | offen (Sample fehlt) |

*KP: Format muss anhand einer Sample-Datei verifiziert werden.

Alle Parser geben `MapDefinition[]` zurück – dieselbe Pipeline wie XDF.

### 3A – JSON Upload (`MapDefinition[]`) ✅

**Dateien:**
- `packages/definition-parser/src/json/parse-json.ts`
- `packages/definition-parser/src/index.ts` (Export)

Einfachster Fall: JSON-Datei wird eingelesen, Schema gegen `MapDefinition`-Interface validiert, ungültige Einträge werden übersprungen (nicht rejected). Damit können Nutzer ihre eigenen Definition-Sammlungen direkt hochladen.

```ts
export function parseDefinitionJSON(source: string | ArrayBuffer): {
  definitions: MapDefinition[]
  warnings: string[]
  stats: { total: number; valid: number; skipped: number }
}
```

Validierung: Pflichtfelder (`id`, `offset`, `rows`, `cols`, `dataType`, `endianness`, `value`) prüfen. Fehlende optionale Felder mit Defaults befüllen. Einträge mit ungültigen `offset`/`rows`/`cols` überspringen + Warning.

**Definition of Done:**
- Nutzer kann `.json` hochladen mit rohen `MapDefinition[]`
- Parser validiert und normalisiert
- Ungültige Einträge erzeugen Warnungen, kein Absturz

---

### 3B – A2L (ASAP2) Parser

**Dateien:**
- `packages/definition-parser/src/a2l/parse-a2l.ts`
- `packages/definition-parser/src/a2l/normalize-a2l.ts`

A2L ist ein standardisiertes Textformat (ASAP2 Spezifikation). Relevante A2L-Elemente:

| A2L-Element | Mappt auf |
|---|---|
| `CHARACTERISTIC` (MAP, CURVE) | `MapDefinition` |
| `AXIS_DESCR` + `AXIS_PTS` | `xAxis` / `yAxis` |
| `COMPU_METHOD` | `value.factor`, `value.offset` oder `expression` |
| `RECORD_LAYOUT` | `dataType`, `endianness` |
| `/begin MEMORY_SEGMENT` | Basis-Offset (wichtig!) |

**Parsing-Strategie:**
A2L ist kein XML. Es ist ein hierarchisches Keyword-Format. Parser nutzt reguläre String-Verarbeitung, keine XML-Bibliothek. Bekannte Libraries: `a2lfile` (Rust/Python), aber für Browser-Kompatibilität eine TS-Implementierung bauen.

**Wichtig:** A2L enthält absolute ECU-Adressen (z.B. `0x400000`). Die müssen gegen den ROM-Speicherbereich normalisiert werden. Basiert auf `MEMORY_SEGMENT`-Definitionen im A2L. Das Normalisieren ist Teil des allgemeinen Adressraum-Handlings → siehe **Phase 6**: A2L-Adressen werden mit `addressSpace: "ecu"` und der `MEMORY_SEGMENT`-Basis abgelegt, statt sie beim Import hart in Datei-Offsets umzurechnen.

```ts
export function parseA2L(source: string): {
  definitions: MapDefinition[]
  warnings: string[]
  stats: { characteristics: number; scalars: number; definitionsCreated: number }
}
```

**Definition of Done:**
- `CHARACTERISTIC` vom Typ `MAP` und `CURVE` werden extrahiert
- `AXIS_DESCR` werden als `xAxis`/`yAxis` normalisiert
- `COMPU_METHOD` `RAT_FUNC`/`LINEAR` wird zu factor/offset normalisiert
- Komplexe Formeln gehen in `expression`-Feld
- Nicht unterstützte Elemente → Warning, kein Absturz

---

### 3C – DAMOS Parser

**Dateien:**
- `packages/definition-parser/src/damos/parse-damos.ts`
- `packages/definition-parser/src/damos/normalize-damos.ts`

DAMOS (Daten-Austausch-Format Motor-Steuergerät) ist Bosch-intern, existiert in verschiedenen Varianten. Ohne Sample-Datei kann kein konkreter Parser geschrieben werden.

**Vorgehen:**
1. Sample-DAMOS-Datei beschaffen (ms4x.net Community, Bosch-Dienstleister)
2. Format analysieren (meist ASCII, ähnlich A2L aber älteres Schema)
3. Parser ähnlich wie A2L implementieren

**Vorläufig:** Gleiche Schnittstelle wie A2L-Parser, aber stub mit klarer Fehlermeldung bis Sample vorliegt.

**Definition of Done:**
- Parser existiert mit stub + klarer Fehlermeldung
- Sobald Sample-Datei vorliegt: Vollimplementierung nach A2L-Muster

---

### 3D – KP Format

**Status:** Format muss verifiziert werden.

**Was KP vermutlich ist:**
- Im BMW-Tuning-Kontext: "Kennfeld-Parameter"-Datei
- Mögliche Formate: ecuflash XML, RomRaider XML, proprietäres BMW-Format
- Ohne Sample-Datei keine Aussage möglich

**Vorgehen:**
1. Sample-KP-Datei beschaffen
2. Format identifizieren (Binary? XML? Text?)
3. Wenn ecuflash XML: existierender Plan in `ms4x-map-extraction.md` → Parser implementieren
4. Wenn propriätär: Format reverse-engineeren

**Vorläufig:** Gleicher stub-Ansatz wie DAMOS.

---

### 3E – Upload-UI erweitern ✅

**Datei:** `apps/web/src/components/editor/XdfUploadPanel.tsx`

Aktuell nur `.xdf` als Accept. Erweitern auf alle unterstützten Formate:

```tsx
accept=".xdf,.a2l,.damos,.json,.kp"
```

Datei-Typ erkennen und richtigen Parser aufrufen:

```ts
function detectAndParse(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'xdf':   return parseXdf(content)
    case 'a2l':   return parseA2L(content)
    case 'damos': return parseDAMOS(content)
    case 'json':  return parseDefinitionJSON(content)
    case 'kp':    return parseKP(content)
    default: throw new Error(`Unbekanntes Format: .${ext}`)
  }
}
```

---

## Phase 4 – Definitions-Expansion

### 4A – Confidence-System erweitern

**Aktuell:** Alle Einträge haben `confidence: "definition"`. Das sagt nichts über Qualität aus.

**Neues Schema:**

```ts
type MapConfidence =
  | "verified"      // Gegen echtes ROM spot-gecheckt, Werte plausibel
  | "definition"    // Aus XDF/A2L generiert, nicht manuell verifiziert
  | "unverified"    // Neue/unsichere Einträge die noch geprüft werden müssen
  | "inferred"      // Automatisch hergeleitet (z.B. aus A2L-Konvertierung)
  | "user_uploaded" // Vom Nutzer hochgeladen
  | "unknown"       // Keine Aussage möglich
```

Für bestehende interne JSONs: Einträge mit echten `category`-Werten (nicht "unknown") können schrittweise auf `"verified"` gesetzt werden, wenn gegen ROM geprüft.

### 4B – MS45 internes Definition-JSON

**Voraussetzungen:** `local-fixtures/definitions/Siemens_MS451_457LO02S_1024K.xdf` vorhanden ✓

**Schritte:**
1. XDF mit bestehendem `parseXdf()` einlesen → `MapDefinition[]`
2. `compatibility.ecu: "MS45"`, `expectedFileSize: 1048576` setzen (1 MB ROM)
3. Output: `packages/definition-parser/src/internal/ms45/457lo02s.json`

**Fingerprint MS45 hinzufügen:**

```ts
// packages/definition-parser/src/internal/fingerprint.ts
{
  ecu: 'MS45',
  softwareVersion: '457LO02S',
  fileSize: 1048576,
  checks: [
    // Offset und Bytes aus ROM verifizieren (analog MS43-Vorgehen)
    { offset: 0xFF020, bytes: [0x4D, 0x53, 0x34, 0x35] }, // "MS45" ASCII
  ],
}
```

**Rust-Signatures ebenfalls erweitern:**

```rust
// packages/ecu-parser/src/lib.rs – SIGNATURES array
EcuSignature { name: "Siemens MS45", size: 1048576, identifier: b"MS45", id_offset: 0xFF020 },
```

*(bereits vorhanden in SIGNATURES, aber noch kein internes JSON)*

**Python-Registry:** Nach Phase 2 (Auto-Discovery) automatisch aufgenommen.

**Definition of Done:**
- `ms45/457lo02s.json` existiert
- Fingerprint für MS45 vorhanden
- Beim Laden einer MS45-BIN werden Maps angezeigt

### 4C – Weitere ECU-Definitionen

Für jede neue ECU-Definitionen-Quelle (die der User bereits hat):

1. Dateiformate identifizieren (XDF? A2L? XML?)
2. Mit dem passenden Parser (Phase 3) zu `MapDefinition[]` konvertieren
3. In `packages/definition-parser/src/internal/<ecu-typ>/` ablegen
4. Fingerprint in `fingerprint.ts` + `lib.rs` hinzufügen
5. Python Auto-Discovery (Phase 2) pickt es automatisch auf

**Struktur:**

```
packages/definition-parser/src/internal/
  ms42/
    0110c6.json          ✓ vorhanden
  ms43/
    ms430069.json        ✓ vorhanden
  ms45/
    457lo02s.json        Phase 4B
  me7/                   später
    ...
  med17/                 später
    ...
```

### 4D – MS42 Kategorisierung

MS42: 2875 Einträge, alle `category: "unknown"`. Das ist der größte Qualitätsmangel bei den bestehenden Definitionen.

**Ansatz:** Wenn MS43-Einträge bereits kategorisiert sind, können Maps mit gleichen Namen in MS42 die Kategorie übernehmen (MS42 und MS43 teilen viele Map-Namen). Script:

```python
# scripts/sync-categories-ms42.py (lokales Utility)
# Liest ms43/ms430069.json, baut name → category lookup
# Überträgt categories auf ms42/0110c6.json wo name übereinstimmt
```

Manuelle Verifikation danach nötig.

---

## Phase 5 – Verification Workflow

### Ziel

Tuner und Admins können Maps schrittweise verifizieren. Der Verifizierungsstatus ist im JSON sichtbar.

### 5A – Verification-Tooling (lokal)

Einfaches CLI-Script zum Setzen von `confidence: "verified"` auf geprüften Maps:

```bash
# scripts/verify-map.mjs <ecudefinition.json> <map-id>
node scripts/verify-map.mjs packages/definition-parser/src/internal/ms43/ms430069.json map_kfzw_001
```

### 5B – UI: Confidence-Anzeige im MapTree

**Datei:** `apps/web/src/components/editor/sidebar/MapTreeItem.tsx`

Kleines Badge neben Map-Namen:
- `verified` → grüner Punkt
- `definition` → grauer Punkt  
- `unverified` → gelber Punkt
- `user_uploaded` → Nutzer-Icon

### 5C – Achswerte manuell ergänzen

Aktuell: Alle `xAxis.source: "index"` – Nutzer sehen Index 0,1,2,... statt echte RPM/Load-Werte.

**Vorgehen:** Für wichtige Maps (KFZW, KFVPDKSD, KFMIRL etc.) echte Achswerte aus Dokumentation oder ROM-Analyse eintragen:

```json
"xAxis": {
  "source": "inline",
  "label": "n [rpm]",
  "unit": "rpm",
  "values": [800, 1000, 1200, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500],
  "scale": { "factor": 1, "offset": 0 }
}
```

Kann auch `"source": "address"` sein, wenn Achswerte im ROM an bekanntem Offset liegen.

---

## Phase 6 – CAL/Full-Bin Adressraum-Handling

### Ziel

Dieselbe Definition funktioniert für **beide** Bin-Varianten desselben Steuergeräts:

| Variante | Inhalt | Beispiel-Größe |
|---|---|---|
| **Full-Bin** | komplettes Flash-Image (Bootloader + Programm + Kalibrierung) | MS43 `0x80000` |
| **CAL-only** | nur der herausgeschnittene Kalibrierungsblock | MS4x `0x10000` |

Eine Map-Adresse ist nur sinnvoll *relativ zu einem Adressraum*. Lädt man eine CAL-only-Datei, liegt derselbe Kalibrierungsblock bei Datei-Offset 0 statt mitten in der Full-Bin – `def.offset` zeigt dann ins Leere. Aktuell behandelt MapLab jeden `offset` als Datei-Offset; das ist für die heutigen BMW-Full-ROMs (fixe Größe) zufällig korrekt, bricht aber bei CAL-only-Bins, A2L-Importen und Bosch-ECUs (ME7/MED17, wo CAL-only-Flashes üblich sind).

> **Vorbild Konkurrenz:** tune-editor löst das mit `isCalOnly()` + einem zentralen `calOffset`, der bei *jedem* Lese-/Schreibzugriff auf die Definitions-Adresse aufaddiert wird (`addressToOffset(address, calOffset)`). Es kennt sogar Sub-Varianten innerhalb von Full-Bins (DSG: zusätzlicher `-0x10000`/`-0x30000` je nach EPK-Fundort). Lehre: Variantenerkennung muss feinkörniger sein als nur „CAL vs. Full", und der Offset darf **nur an einer einzigen Stelle** aufaddiert werden.

### Bestätigte Entscheidungen (final)

1. **Default `addressSpace: 'file'`** — bestehende interne MS42/MS43-JSONs bleiben unverändert gültig, keine Migration. Neue interne Definitionen *sollen* wo möglich `'cal'` verwenden (portabel über Full-/CAL-Varianten), aber `'file'` bleibt der abwärtskompatible Default.
2. **Write-Pfad nutzt zwingend denselben `resolveOffset` wie der Lese-Pfad.** Ein Auseinanderlaufen würde still an die falsche Adresse schreiben. Abgesichert über den Round-Trip-Test (Byte-Diff == 0) in der Definition of Done.

### Designentscheidung: deklarierter Adressraum + ein zentraler `resolveOffset`

1. **Definition deklariert ihren Adressraum** (statt Datei-Offsets hart einzubacken). Neues optionales Feld in `MapDefinition` und `AxisDefinition`:

   ```ts
   // packages/definition-parser/src/common/map-definition.ts
   export type AddressSpace =
     | 'file'   // Offset ist absolut in DIESER Datei (heutiges Verhalten, Default)
     | 'cal'    // Offset ist relativ zum Beginn des Kalibrierungsblocks (robust, portabel)
     | 'ecu'    // Offset ist eine absolute ECU-/ROM-Adresse (A2L, DAMOS)
   ```

   `compatibility.addressSpace?: AddressSpace` (Default `'file'` → bestehende interne JSONs bleiben unverändert gültig, keine Migration nötig).

2. **Bin-Kontext wird beim Laden bestimmt** – Erweiterung des Fingerprints (`packages/definition-parser/src/internal/fingerprint.ts`, Rust `SIGNATURES` in `packages/ecu-parser/src/lib.rs`). Fingerprint liefert zusätzlich:

   ```ts
   interface BinContext {
     variant: 'full' | 'cal'      // erkannt über Dateigröße + CAL-Marker (z.B. ".DAT")
     calBase: number              // Datei-Offset, an dem der Kalibrierungsblock beginnt
     ecuBase: number              // ROM-Basisadresse des Kalibrierungsblocks (für 'ecu'-Defs)
   }
   ```

   CAL-Erkennung pro ECU als **Daten**, nicht als Code (analog zur Fingerprint-Tabelle): `{ ecu, fullSize, calSize, calMarker, calMarkerOffset, calBase, ecuBase }`.

3. **Ein einziger `resolveOffset`** rechnet Definitions-Adresse → tatsächlichen Datei-Offset. Wird von WASM-Extraction, TS-Extraction *und* Write-Pfad identisch genutzt:

   ```ts
   // packages/definition-parser/src/common/resolve-offset.ts (NEU)
   export function resolveOffset(
     defOffset: number,
     space: AddressSpace,
     ctx: BinContext,
   ): number {
     switch (space) {
       case 'file': return defOffset
       case 'cal':  return defOffset + ctx.calBase
       case 'ecu':  return defOffset - ctx.ecuBase + ctx.calBase
     }
   }
   ```

### 6A – Variantenerkennung im Fingerprint

**Dateien:** `packages/definition-parser/src/internal/fingerprint.ts`, `packages/ecu-parser/src/lib.rs`

- Fingerprint gibt zusätzlich `BinContext` zurück (`variant`, `calBase`, `ecuBase`).
- Erkennung über Dateigröße (`== fullSize` → full, `== calSize` → cal) plus CAL-Marker-Check (Bytes an `calMarkerOffset`), damit beschnittene/abweichende Dateien nicht falsch klassifiziert werden.
- Pro ECU als Daten-Tabelle, parallel zur bestehenden Signatur-Tabelle.

### 6B – `resolveOffset` zentral + überall durchziehen

**Dateien:** neu `common/resolve-offset.ts`; Aufrufer: `apps/web/src/workers/ecu-parser.worker.ts`, `packages/ecu-parser-wasm/src/index.ts` (`extractMapsFromDefinitionsWasm`, `writeMapValues`, `getHexSlice`), Rust `extract_maps_from_definitions`.

- `BinContext` wird beim `parse` einmal ermittelt und an Extraction **und** Write-Pfad durchgereicht.
- `resolveOffset` auf `def.offset` **und** auf `xAxis.offset`/`yAxis.offset` anwenden (`source: 'address'`).
- WASM bekommt den Kontext als Parameter (kein zweiter Code-Pfad mit eigener Offset-Logik).
- Write-Pfad (`writeMapValues`, JS-autoritativ laut Phase 1D) nutzt **denselben** `resolveOffset` – sonst schreibt man an eine andere Adresse als man liest.

### 6C – Import-Parser setzen `addressSpace` korrekt

- **A2L** (3B): `addressSpace: 'ecu'`, `ecuBase` aus `MEMORY_SEGMENT`. Keine Hart-Umrechnung beim Import → Definition bleibt für Full- und CAL-Varianten gültig.
- **XDF / interne JSONs:** `addressSpace: 'file'` (Status quo).
- **Empfehlung für neue interne Definitionen:** wo möglich `'cal'` verwenden, weil dieselbe JSON dann CAL-only- *und* Full-Bin desselben Softwarestands abdeckt.

### Definition of Done Phase 6

- Laden einer CAL-only-MS43 (`0x10000`, `.DAT`-Marker) zeigt dieselben Map-Werte wie die Full-Bin
- A2L-importierte Definition (absolute Adressen) liest gegen ein Full-ROM korrekte Werte
- Lese- und Schreib-Offset sind nachweislich identisch (Round-Trip-Test: read → write same value → byte-diff == 0)
- Bestehende interne MS42/MS43-JSONs funktionieren unverändert (Default `'file'`)
- Spot-Check: unbekannte/beschnittene Datei wird nicht fälschlich als CAL erkannt

---

## Implementierungsreihenfolge (empfohlen)

```
Woche 1:
  Phase 1A+1B (WASM JS-Bindings + Worker)
  Phase 2A    (Python Auto-Discovery)

Woche 2:
  Phase 3A    (JSON Upload)
  Phase 4B    (MS45 Definition + Fingerprint)

Woche 3:
  Phase 6A+6B (CAL/Full-Bin Adressraum – vor A2L, da A2L darauf aufbaut)
  Phase 3B    (A2L Parser, nutzt addressSpace 'ecu' aus Phase 6)
  Phase 4C    (weitere ECUs aus vorhandenen Dateien)

Woche 4:
  Phase 4D    (MS42 Kategorisierung)
  Phase 5A+5B (Verification Workflow)

Offen (nach Sample-Beschaffung):
  Phase 3C    (DAMOS)
  Phase 3D    (KP)
```

---

## Nicht-Ziele

- Vollautomatische Kategorisierung per KI (Halluzinationen bei Offsets zu gefährlich)
- DAMOS/KP ohne verifizierte Sample-Dateien implementieren
- Direkte Byte-Editing im WASM ohne vollständige DataType-Awareness (JS-Bypass bleibt)
- Rückwärtskompatibilität zu alten Map-IDs (IDs sind Hash-basiert, ändern sich nicht)
