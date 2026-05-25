# MS4X Map Extraction – Implementierungsplan

## Ziel

Zwei Phasen:

**Phase 1 – WASM / Browser Worker (offline, definition-based):**  
Den WASM-Parser (`packages/ecu-parser/src/lib.rs`) so erweitern, dass er reale Maps aus dem Binary liest – ohne Python-Microservice, offline, direkt im Browser-Worker-Thread.

Basis sind nicht mehr ausschließlich statische Map-Tabellen im Rust-Code, sondern ein gemeinsames internes `MapDefinition`-Format.

Definitionen können kommen aus:

- internen MapForge-Definitionen für bekannte Siemens-MS4X-ROMs
- vom Nutzer hochgeladenen XDF-Dateien
- später aus ecuflash-/RomRaider-XMLs
- später aus DAMOS/A2L über den Python-Service

**Phase 2 – Python-Service `/parse` (dynamisch, DAMOS/A2L-basiert):**  
Den Python-Microservice um einen `/parse`-Endpunkt erweitern, der eine hochwertigere Map-Liste mit vollständigen Achswerten aus DAMOS/A2L-Definitionen liefert. Wird als Ergänzung zu Phase 1 eingebunden: Wenn der Service verfügbar ist, kann sein Ergebnis die WASM/Definition-Daten verbessern.

**Scope:** MS42 · MS43 · MS45  
**Nicht im Scope:** GS20 (Getriebesteuergerät, niedrige Priorität)

---

## Grundprinzip

Die Map Extraction soll unabhängig davon funktionieren, woher eine Definition kommt.

```txt
Interne Definition
User-XDF
ecuflash XML
RomRaider XML
DAMOS / A2L
        ↓
Normalized MapDefinition[]
        ↓
Map Extraction Engine
        ↓
ECUMap[]
        ↓
Editor UI
```

Die eigentliche Extraction Engine darf nicht wissen müssen, ob eine Map aus einer internen Definition, einer User-XDF oder später aus DAMOS/A2L stammt.

---

## Warum beides

| Kriterium | WASM / Browser Worker Phase 1 | Python-Service Phase 2 |
|---|---|---|
| Runtime-Dependency | keine | Service muss laufen |
| Latenz | sehr niedrig | Netzwerk-Round-Trip + Upload |
| Offline-Betrieb | ✓ | ✗ |
| User-XDF-Support | ✓ | optional |
| Interne Definitionen | ✓ | optional |
| Achswerte X/Y | teilweise, abhängig von Definition | vollständig, wenn DAMOS/A2L vorhanden |
| Neue ECU-Typen ohne Deploy | über User-XDF möglich | über neue DAMOS/A2L-Datei möglich |
| Qualität der Map-Metadaten | gut, abhängig von Definition | sehr gut, wenn hochwertige DAMOS/A2L vorhanden |

**Strategie:**  
Phase 1 macht den Editor sofort funktionsfähig und offline-tauglich. User können eigene XDFs hochladen, wenn keine interne Definition passt. Phase 2 verbessert die Datenqualität inkrementell.

---

## Was genau extrahiert wird

Pro Map:

| Feld | Typ | Beispiel |
|---|---|---|
| `offset` | `number` | `0x18C40` |
| `rows` | `number` | `16` |
| `cols` | `number` | `16` |
| `name` | `string` | `"KFZW"` |
| `category` | `MapCategory` | `"ignition"` |
| `value_unit` | `string` | `"°KW"` |
| `x_axis_label` | `string` | `"n [rpm]"` |
| `y_axis_label` | `string` | `"Load"` |
| `data_type` | `DataType` | `"uint16"` |
| `endianness` | `Endianness` | `"big"` |
| `scale_factor` | `number` | `0.75` |
| `scale_offset` | `number` | `-48.0` |
| `source` | `DefinitionSource` | `"internal"` / `"xdf"` |
| `confidence` | `MapConfidence` | `"verified"` / `"user_uploaded"` |

Engineering-Wert:

```txt
engineeringValue = raw * scale_factor + scale_offset
```

Wichtig:  
`uint16 big-endian` darf nicht global hardcoded werden. Es kann für viele MS4X-Maps stimmen, muss aber pro Map definiert werden.

---

## Normalized MapDefinition Model

Alle Definitionen werden in dieses interne Format überführt.

```ts
type MapCategory =
  | "ignition"
  | "fuel"
  | "lambda"
  | "torque"
  | "driver_wish"
  | "limit"
  | "vanos"
  | "idle"
  | "maf"
  | "boost"
  | "diagnostic"
  | "unknown";

type DataType =
  | "uint8"
  | "int8"
  | "uint16"
  | "int16"
  | "uint32"
  | "int32"
  | "float32";

type Endianness = "big" | "little";

type DefinitionSourceType =
  | "internal"
  | "xdf"
  | "ecuflash_xml"
  | "romraider_xml"
  | "damos"
  | "a2l"
  | "manual";

type MapConfidence =
  | "verified"
  | "definition"
  | "user_uploaded"
  | "inferred"
  | "unknown";

type AxisDefinition = {
  label?: string;
  unit?: string;

  source:
    | "inline"
    | "address"
    | "calculated"
    | "index"
    | "unknown";

  values?: number[];

  offset?: number;
  length?: number;
  dataType?: DataType;
  endianness?: Endianness;

  scale?: {
    factor: number;
    offset: number;
  };
};

type MapDefinition = {
  id: string;

  name: string;
  description?: string;
  category: MapCategory;

  offset: number;
  rows: number;
  cols: number;

  dataType: DataType;
  endianness: Endianness;

  value: {
    unit?: string;
    factor: number;
    offset: number;
    expression?: string;
  };

  xAxis?: AxisDefinition;
  yAxis?: AxisDefinition;

  source: {
    type: DefinitionSourceType;
    name?: string;
    version?: string;
    author?: string;
    license?: string;
  };

  compatibility?: {
    ecu?: "MS42" | "MS43" | "MS45";
    softwareVersion?: string;
    expectedFileSize?: number;
    fingerprints?: string[];
  };

  confidence: MapConfidence;

  safetyTags?: string[];

  metadata?: Record<string, unknown>;
};
```

---

## Parsed ECUMap

Aus `MapDefinition + BIN` entsteht:

```ts
type ECUMap = {
  id: string;
  definitionId: string;

  name: string;
  category: MapCategory;

  offset: number;
  rows: number;
  cols: number;

  valueUnit?: string;

  xAxis: {
    label?: string;
    unit?: string;
    values: number[];
  };

  yAxis: {
    label?: string;
    unit?: string;
    values: number[];
  };

  values: number[][];
  rawValues: number[][];

  source: {
    type: DefinitionSourceType;
    name?: string;
    version?: string;
  };

  confidence: MapConfidence;

  warnings: ValidationWarning[];
};
```

---

## ValidationWarning

```ts
type ValidationSeverity = "info" | "warning" | "critical";

type ValidationWarning = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  mapId?: string;
  offset?: number;
};
```

---

## Definition Matching

### Ziel

Vor dem Auslesen wird geprüft, ob eine interne Definition oder User-XDF zur geladenen BIN passt.

Eine XDF kann technisch gültig sein, aber trotzdem für eine andere Firmware-Version erstellt worden sein.

---

### Match Status

```ts
type DefinitionMatchStatus =
  | "exact"
  | "likely"
  | "weak"
  | "mismatch"
  | "unknown";

type DefinitionMatchResult = {
  status: DefinitionMatchStatus;
  score: number;
  warnings: ValidationWarning[];
};
```

---

### Matching-Kriterien

| Check | Bedeutung |
|---|---|
| Dateigröße | passt die BIN-Größe zur erwarteten ECU? |
| ECU-Typ | MS42/MS43/MS45 erkannt? |
| Softwareversion | passt Firmware-ID oder Fingerprint? |
| Offsets | liegen Map-Offsets innerhalb der Datei? |
| Wertebereiche | ergeben gelesene Werte plausible Engineering-Werte? |
| Achsen | sind Achsen monoton/plausibel? |
| Checksums | ist der Checksum-Status bekannt/gültig/ungültig? |
| Magic/Fingerprint | bekannte Identifier im ROM vorhanden? |

---

## Definition Source Priorität

Wenn mehrere Definitionen vorhanden sind:

```txt
1. Exakt passende interne verified Definition
2. Vom Nutzer explizit hochgeladene XDF
3. Wahrscheinlich passende interne Definition
4. Python-Service DAMOS/A2L Enhancement
5. Index-only Fallback ohne Maps
```

Wichtig:

- Nutzer-XDF darf interne Definition überschreiben, wenn Nutzer das aktiv auswählt.
- Interne verified Definitionen sollten als sicherste Quelle markiert werden.
- Python-Service-Ergebnisse dürfen nicht stillschweigend inkompatible Maps überschreiben.

---

## Datenquellen

Die Map-Definitionen können kommen aus:

| Quelle | Enthält | Nutzung |
|---|---|---|
| User-XDF | Offsets, Dims, Skalierung, Namen, Achsen | Phase 1 |
| Interne MapForge Definitionen | geprüfte bekannte ROMs | Phase 1 |
| ecuflash XML | Offsets, Dims, Skalierung, Namen | später/importierbar |
| RomRaider Definitions | ähnliche Struktur, community-gepflegt | später/importierbar |
| DAMOS/A2L | vollständige Definitionen inkl. Achsen | Phase 2 |
| Manuelle Definition | selbst gepflegte Definitionen | optional |

---

## Repo-Regeln

Keine fremden ROMs, XDFs, XMLs, DAMOS- oder A2L-Dateien ungeprüft ins öffentliche Repo committen.

```gitignore
local-fixtures/
packages/ecu-parser/tests/fixtures/*.bin
docs/data/definitions/*.xdf
docs/data/definitions/*.xml
docs/data/definitions/*.a2l
docs/data/definitions/*.damos
```

Lokale Test-Fixtures:

```txt
local-fixtures/
  roms/
    ms43_ms430069_stock.bin
    ms42_0110c6_stock.bin
    your_ms42_read.bin

  definitions/
    ms43_ms430069.xdf
    ms42_0110c6.xdf
    ms42_v041.xml

  expected/
    ms43_ms430069_expected_maps.json
    ms42_0110c6_expected_maps.json
```

---

## Empfohlene Projektstruktur

```txt
packages/
  ecu-parser/
    src/
      lib.rs
      extraction/
        mod.rs
      validation/
        mod.rs
    tests/
      fixtures/
        .gitkeep
      README.md

  definition-parser/
    src/
      xdf/
        parse-xdf.ts
        normalize-xdf.ts
      ecuflash/
        parse-ecuflash.ts
        normalize-ecuflash.ts
      romraider/
        parse-romraider.ts
        normalize-romraider.ts
      common/
        map-definition.ts
        validation.ts

apps/
  web/
    src/
      workers/
        ecu-parser.worker.ts
      features/
        editor/
        definitions/
        upload/
        safety/

docs/
  architecture/
    map-extraction.md
    definition-model.md
```

---

# Implementierungsphasen

---

## Phase 1A – Gemeinsames MapDefinition Model

### Ziel

Ein gemeinsames internes Format für interne Definitionen, User-XDFs und spätere DAMOS/A2L-Daten schaffen.

### Aufgaben

- TypeScript-Typen für `MapDefinition`, `AxisDefinition`, `ECUMap`, `ValidationWarning`
- Rust-äquivalente Structs oder JSON-Input für WASM
- Serialisierung zwischen Worker und UI
- stabile Map-IDs generieren
- Source-Metadaten erfassen
- Confidence-Level einführen

### Definition of Done

- Interne Definitionen und User-XDFs können in dasselbe Format gebracht werden.
- Extraction Engine arbeitet nur mit `MapDefinition[]`.
- Keine Sonderlogik für XDF vs. interne Definition in der Extraction Engine.

---

## Phase 1B – Generic Map Extraction Engine

### Ziel

Eine generische Extraction Engine bauen, die unabhängig von MS42/MS43/MS45 und unabhängig von der Definitionsquelle funktioniert.

### Input

```txt
Binary Buffer
MapDefinition[]
```

### Output

```txt
ECUMap[]
ValidationWarning[]
```

### Aufgaben

- Bounds Checking
- Lesen von `uint8`, `int8`, `uint16`, `int16`, `uint32`, `int32`, `float32`
- Big Endian und Little Endian unterstützen
- Skalierung anwenden
- 1D-, 2D- und 3D-Maps unterstützen
- Achsen auslesen, falls vorhanden
- auf Index-Achsen zurückfallen, falls keine Achsen vorhanden
- ungültige Maps überspringen statt crashen
- Warnungen sammeln

### Definition of Done

- Engine kann mit künstlichen Testdaten Maps korrekt extrahieren.
- Engine funktioniert ohne echte MS4X-Files.
- Ungültige Offsets führen zu Warnungen, nicht zu Panics.
- Tests decken Datentypen, Endianness und Scaling ab.

---

## Phase 1C – User-XDF Upload & Parser

### Ziel

Der Nutzer kann zusätzlich zur BIN-Datei eine eigene TunerPro-XDF hochladen.

### Ablauf

```txt
1. Nutzer lädt BIN hoch
2. Editor erkennt ECU/Firmware soweit möglich
3. Editor sucht passende interne Definition
4. Falls keine passende interne Definition vorhanden ist:
   Nutzer kann XDF hochladen
5. XDF wird geparst
6. XDF wird in MapDefinition[] normalisiert
7. Dieselbe Extraction Engine liest Maps aus der BIN
```

### Aufgaben

- `.xdf` Upload im UI ermöglichen
- XDF als XML einlesen
- Tables extrahieren
- Scalars extrahieren
- Map-Namen übernehmen
- Offsets/Addresses lesen
- Dimensionen erkennen
- Datentyp erkennen
- Endianness erkennen
- Units übernehmen
- Skalierungsformeln auslesen
- einfache Formeln in `factor + offset` normalisieren
- komplexe Formeln als `expression` speichern
- X-/Y-Achsen extrahieren, falls vorhanden
- Kategorien aus Namen/Ordnern ableiten
- nicht unterstützte XDF-Elemente sauber ignorieren oder warnen

### Definition of Done

- Nutzer kann eine `.xdf` hochladen.
- XDF wird clientseitig oder im Worker geparst.
- Mindestens Tables/Scalars werden erkannt.
- Offsets, Dimensionen, Datentypen, Skalierung und Units werden extrahiert.
- Nicht unterstützte XDF-Elemente erzeugen Warnungen statt Fehler.
- Die erzeugten `MapDefinition[]` können von derselben Extraction Engine genutzt werden wie interne Definitionen.

---

## Phase 1D – Definition Validation & Matching

### Ziel

Prüfen, ob eine interne Definition oder User-XDF zur geladenen BIN passt.

### Aufgaben

- Dateigröße gegen erwartete Größe prüfen
- ECU-Typ/Firmware-Fingerprint prüfen, falls vorhanden
- Offsets gegen Buffer-Grenzen prüfen
- Probeweise ausgewählte Maps lesen
- Wertebereiche grob prüfen
- Achsen auf Plausibilität prüfen
- Maps mit nur `0x00` oder `0xFF` erkennen
- Checksum-Status integrieren
- `DefinitionMatchResult` erzeugen

### Ergebnis

Der Nutzer sieht klar:

```txt
Diese Definition passt exakt.
Diese Definition passt wahrscheinlich.
Diese Definition passt nur schwach.
Diese Definition passt wahrscheinlich nicht.
```

### Definition of Done

- Falsche XDF führt nicht still zu falschen Maps.
- Der Editor zeigt einen Match-Status mit Warnungen.
- Bei `mismatch` muss der Nutzer bewusst bestätigen oder eine andere Definition wählen.
- Bei `exact` oder `likely` kann der Editor Maps automatisch anzeigen.

---

## Phase 1E – Interne MS4X-Definitionen

### Ziel

Für bekannte MS4X-ROMs können interne MapForge-Definitionen bereitgestellt werden.

### Wichtig

Interne Definitionen dürfen keine Sonderlogik verwenden. Sie müssen ebenfalls in `MapDefinition[]` vorliegen.

Nicht dauerhaft so:

```rust
fn ms42_maps() -> &'static [MapDef]
```

Sondern besser so:

```txt
loadInternalDefinition("MS43", "MS430069")
→ MapDefinition[]
```

### Priorität

Empfohlene Reihenfolge:

```txt
1. MS43 MS430069
2. MS42 0110C6
3. MS45 später
```

### Definition of Done

- Mindestens eine bekannte MS43-Definition kann geladen werden.
- Mindestens 10–20 wichtige Maps werden korrekt angezeigt.
- Interne Definitionen nutzen dieselbe Extraction Engine wie User-XDFs.
- Werte sind gegen lokale Stock-ROMs spot-gecheckt.

---

## Phase 1F – Editor Integration

### Ziel

Maps im Editor anzeigen und auswählbar machen.

### Aufgaben

- BIN Upload
- optionale XDF Upload UI
- automatische interne Definition suchen
- Definition Match Status anzeigen
- Map-Liste anzeigen
- Map Details anzeigen
- 2D Table View
- 3D View, falls vorhanden
- Hex Offset Sync
- Warnings pro Map anzeigen
- Source anzeigen: `internal`, `xdf`, `damos`, etc.
- Confidence anzeigen

### Definition of Done

- Nutzer kann eine BIN laden.
- Nutzer kann optional eine XDF hochladen.
- Der Editor zeigt Maps, wenn eine passende Definition vorhanden ist.
- Nutzer sieht, aus welcher Quelle die Definition stammt.
- Nutzer sieht Warnungen, wenn Definition oder Werte auffällig sind.

---

## Phase 1G – Basic Safety Checks

### Ziel

Noch keine vollständige Motor-Safety-Bewertung, sondern grundlegende Editor-Safety.

### Checks

- Definition passt nicht zur BIN
- Checksum ungültig oder unbekannt
- Map-Offset außerhalb Datei
- Map-Werte außerhalb grober Grenzwerte
- Achsen nicht plausibel
- Änderung größer als definierter Prozentwert
- wichtige Map geändert, aber verwandte Map nicht
- Datei wirkt truncated oder falsche Größe
- XDF wirkt inkompatibel

### Definition of Done

- Safety Checks laufen nach erfolgreicher Map Extraction.
- Warnungen werden im UI sichtbar.
- Der Editor behauptet nicht, ein File sei sicher flashbar.
- Safety Checks sind als Hinweise formuliert, nicht als endgültige Freigabe.

---

## Phase 1H – WASM neu bauen + integrieren

### Ziel

Neues WASM-Binary landet im Browser-Worker.

### Befehl

```bash
wasm-pack build packages/ecu-parser --target web \
  --out-dir packages/ecu-parser-wasm/wasm
```

### Definition of Done

- `pnpm dev` läuft.
- Echte BIN + interne Definition zeigt Maps.
- Echte BIN + User-XDF zeigt Maps.
- Unbekannte ECU öffnet weiterhin Hex View.
- Keine Panics bei falscher oder unvollständiger Definition.

---

## Phase 1I – Validierung & Edge Cases

### Ziel

Keine Abstürze bei Randfällen, saubere Degradation bei unbekannter ECU oder falscher Definition.

### Testfälle

- [ ] Truncated Binary → keine Maps, kein Panic
- [ ] Unbekannte ECU → Hex View öffnet trotzdem
- [ ] XDF passt exakt → Maps anzeigen
- [ ] XDF passt wahrscheinlich → Maps anzeigen mit Hinweis
- [ ] XDF passt schwach → Warnung anzeigen
- [ ] XDF mismatch → nicht automatisch Maps anzeigen
- [ ] Map-Offset außerhalb Buffer → Map überspringen, Rest anzeigen
- [ ] Nicht unterstützte XDF-Formel → Warnung, nicht crashen
- [ ] Achsen fehlen → Index-Achsen anzeigen
- [ ] Achsen unplausibel → Warnung anzeigen
- [ ] MS43 Spot-Check
- [ ] MS42 Spot-Check
- [ ] MS45 später Spot-Check

---

# Phase 2 – Python-Service `/parse`

## Überblick

Der Python-Microservice kennt den ECU-Typ aus `/fingerprint` oder erkennt ihn selbst. Phase 2 fügt einen `/parse`-Endpunkt hinzu, der eine vollständige Map-Liste mit DAMOS-/A2L-basierten Achswerten zurückgibt.

Der Worker kann diesen Endpunkt nach dem lokalen WASM/Definition-Parse aufrufen. Wenn der Service antwortet und kompatible Daten liefert, können Maps und Achswerte verbessert werden.

---

## Schritt 2A – Python `/parse` Endpoint

### Ziel

Der Python-Microservice kann eine ECU-Binary vollständig parsen und eine strukturierte Map-Liste zurückgeben.

### Eingabe

```txt
multipart/form-data mit file
```

### Ausgabe

```json
{
  "detected_ecu": "Siemens MS43",
  "confidence": 0.95,
  "definition_source": "damos",
  "maps": [
    {
      "name": "KFZW",
      "type": "IGNITION",
      "offset": 100416,
      "rows": 16,
      "cols": 16,
      "value_unit": "°KW",
      "x_axis_label": "n [rpm]",
      "y_axis_label": "Load",
      "x_axis_values": [800, 1200, 1600, 2000],
      "y_axis_values": [0.1, 0.2, 0.3, 0.4],
      "values": [[0, 1, 2, 3]],
      "scale_factor": 0.75,
      "scale_offset": -48.0
    }
  ]
}
```

### Definition of Done

- `POST /parse` mit kompatibler MS4X-BIN gibt vollständige Map-Liste zurück.
- Werte sind gegen Phase-1-Ergebnis spot-gecheckt.
- Achswerte sind besser als indexbasierte Fallback-Achsen.

---

## Schritt 2B – Next.js `/api/ecu/parse` Route

### Ziel

Der Browser erreicht den Python-Service über eine sichere Next.js-Route.

### Datei

```txt
apps/web/src/app/api/ecu/parse/route.ts
```

### Aufgaben

- Auth-Check
- FormData an `${ECU_PARSER_URL}/parse` weiterleiten
- Timeout setzen
- Fehler sauber behandeln
- keine Python-Service-URL im Browser exposen

### Definition of Done

```bash
curl -X POST /api/ecu/parse -F file=@ms43.bin
```

gibt eine Map-Liste zurück.

---

## Schritt 2C – Worker Fallback / Enhancement

### Ziel

Der Worker parsed zuerst lokal und versucht danach den Python-Service als Enhancement.

```ts
case 'parse': {
  const buffer = new Uint8Array(msg.buffer)

  const localResult = await parseECU(buffer, msg.format, msg.definitions)

  const enhanced = await tryEnhanceWithService(buffer, localResult)

  self.postMessage({
    type: 'parse:success',
    result: enhanced,
  })
}
```

### Regeln

- Wenn Service down ist: lokales Ergebnis bleibt erhalten.
- Wenn Service inkompatible Daten liefert: lokales Ergebnis bleibt erhalten.
- Wenn Service bessere Achswerte liefert: Maps werden verbessert.
- Kein UI-Fehler bei Timeout.

### Definition of Done

- Service erreichbar: Maps haben bessere Achswerte.
- Service nicht erreichbar: lokale Maps bleiben.
- Service gibt 502: Fallback greift.
- Map-Werte Phase 1 vs. Phase 2 sind konsistent.

---

# Abhängigkeiten / Reihenfolge

```txt
Phase 1

[1A MapDefinition Model]
          ↓
[1B Generic Extraction Engine]
          ↓
[1C User-XDF Upload & Parser]
          ↓
[1D Definition Validation & Matching]
          ↓
[1E Interne MS4X-Definitionen]
          ↓
[1F Editor Integration]
          ↓
[1G Basic Safety Checks]
          ↓
[1H WASM Build & Integration]
          ↓
[1I Validierung & Edge Cases]


Phase 2

[2A Python /parse Endpoint]
          ↓
[2B Next.js API Route]
          ↓
[2C Worker Fallback / Enhancement]
```

---

# Nicht-Ziele

Die Plattform soll in diesem Plan nicht:

- illegale Emissionsmanipulation unterstützen
- DPF/EGR/AdBlue-Off automatisieren
- One-Click-Tuning erzeugen
- ungeprüfte KI-Optimierungen anwenden
- behaupten, ein File sei sicher flashbar
- fremde MS4X/XDF/DAMOS/A2L-Dateien ungeprüft redistributen

---

# Wichtigste Architekturentscheidung

Alle Quellen führen in dasselbe interne Format:

```txt
Definition Source
        ↓
MapDefinition[]
        ↓
extractMaps(buffer, definitions)
```

Dadurch bleiben interne Definitionen, User-XDFs und spätere DAMOS/A2L-Daten kompatibel und können dieselbe Editor-, Validierungs- und Safety-Pipeline nutzen.