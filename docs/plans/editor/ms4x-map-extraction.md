# MS4X Map Extraction – Implementierungsplan

## Ziel

Zwei Phasen:

**Phase 1 – WASM (offline, statisch):** Den WASM-Parser (`packages/ecu-parser/src/lib.rs`)
so erweitern, dass er für bekannte Siemens-MS4X-ECUs reale Maps aus dem Binary liest –
ohne Python-Microservice, offline, direkt im Browser-Worker-Thread. Basis: statische
Map-Tabellen aus Community-Definitionen (ms4x.net XML).

**Phase 2 – Python-Service `/parse` (dynamisch, DAMOS-basiert):** Den Python-Microservice
um einen `/parse`-Endpunkt erweitern, der die authoritative Map-Liste mit vollständigen
Achswerten aus DAMOS-Definitionen liefert. Wird als Ergänzung zu Phase 1 eingebunden:
Wenn der Service verfügbar ist, überschreibt sein Ergebnis die WASM-Tabelle.

**Scope:** MS42 · MS43 · MS45  
**Nicht im Scope:** GS20 (Getriebesteuergerät, niedrige Priorität)

---

## Warum beides

| Kriterium | WASM Phase 1 | Python-Service Phase 2 |
|---|---|---|
| Runtime-Dependency | keine | Service muss laufen |
| Latenz | ~0 ms (Buffer schon im Worker) | Netzwerk-Round-Trip + 512 KB Upload |
| Offline-Betrieb | ✓ | ✗ |
| Achswerte (X/Y-Breakpoints) | ✗ hardcoded | ✓ aus DAMOS exakt |
| Neue ECU-Typen ohne Deploy | ✗ | ✓ neue DAMOS-Datei reicht |
| Qualität der Map-Metadaten | gut (Community-XML) | sehr gut (DAMOS authoritative) |

**Strategie**: Phase 1 macht den Editor sofort funktionsfähig und offline-tauglich.
Phase 2 verbessert die Datenqualität inkrementell – der Worker versucht zuerst den
Python-Service und fällt auf WASM zurück wenn er nicht erreichbar ist.

---

## Was genau extrahiert wird

Pro Map (aus DAMOS-Definitionen / Community-Quellen):

| Feld | Typ | Beispiel |
|---|---|---|
| `offset` | `usize` | `0x18C40` |
| `rows` | `usize` | `16` |
| `cols` | `usize` | `16` |
| `name` | `&str` | `"KFZW"` |
| `type` | `MapType` | `IGNITION` |
| `value_unit` | `&str` | `"°KW"` |
| `x_axis_label` | `&str` | `"n [rpm]"` |
| `y_axis_label` | `&str` | `"Load"` |
| `scale_factor` | `f64` | `0.75` (raw × factor = °KW) |
| `scale_offset` | `f64` | `-48.0` |

Raw-Werte im Binary sind `uint16 big-endian` (Motorola/Siemens-Standard).  
Engineering-Wert = `raw * scale_factor + scale_offset`

---

## Datenquellen (Offset-Recherche)

Die Map-Definitionen kommen aus öffentlich zugänglichen Community-Ressourcen:

| Quelle | Enthält |
|---|---|
| **ecuflash XML** (`ms42.xml`, `ms43.xml`) | Offsets, Dims, Skalierung, Namen – maschinell lesbar |
| **RomRaider-Definitions** (GitHub) | Ähnlich ecuflash, gut gepflegt für MS42/MS43 |
| **MSS42 Tuner-Projekt** | MS42-spezifische Offsets mit DAMOS-Mapping |
| **OpenECU / e46fanatics** | Validierungsdaten (community-verifizierte Werte) |

> **Reihenfolge**: ecuflash/RomRaider-XML zuerst parsen (maschinell auswertbar),
> Rest für Validierung und fehlende Maps.

---

## Komplexitätseinschätzung

| Teilaufgabe | Aufwand |
|---|---|
| Rust-Datenstruktur + Extraktions-Logik | **gering** – 1–2h Code |
| MS42 Maps recherchieren + einpflegen | **mittel** – ~50–80 Maps, gut dokumentiert |
| MS43 Maps recherchieren + einpflegen | **mittel** – sehr ähnlich zu MS42, viel Overlap |
| MS45 Maps recherchieren + einpflegen | **mittel-hoch** – 1 MB Binary, mehr Maps |
| Skalierungsfaktoren pro Map validieren | **hoch** – muss gegen bekannte Tune-Dateien geprüft werden |

**Gesamt: 3–5 Tage**, davon >70% Datenbeschaffung/Validierung, <30% Code.

---

## Implementierungsschritte

---

### Schritt 1 – Rust-Datenmodell + Extraktor-Gerüst

**Ziel**: Der Code-Rahmen steht. Maps können anhand einer statischen Tabelle
aus dem Buffer extrahiert werden – noch ohne echte Offsets.

**Was sich ändert**:

`packages/ecu-parser/src/lib.rs`:

```rust
struct MapDef {
    name: &'static str,
    map_type: &'static str,
    offset: usize,
    rows: usize,
    cols: usize,
    value_unit: &'static str,
    x_axis_label: &'static str,
    y_axis_label: &'static str,
    scale_factor: f64,
    scale_offset: f64,
}

fn extract_from_def(buffer: &[u8], def: &MapDef, file_version_id: &str) -> Option<ECUMap> {
    // bounds-check, liest rows×cols uint16 BE, wendet Skalierung an
}

fn ms42_maps() -> &'static [MapDef] { &[] }  // Platzhalter
fn ms43_maps() -> &'static [MapDef] { &[] }
fn ms45_maps() -> &'static [MapDef] { &[] }
```

`extract_maps()` wählt anhand `detect_ecu()` die richtige Tabelle:

```rust
let defs = match detected_ecu.as_deref() {
    Some("Siemens MS42") => ms42_maps(),
    Some("Siemens MS43") => ms43_maps(),
    Some("Siemens MS45") => ms45_maps(),
    _ => &[],
};
self.maps = defs.iter()
    .filter_map(|d| extract_from_def(&self.buffer, d, &file_version_id))
    .collect();
```

**Definition of Done**: WASM baut, gibt bei Unbekannter ECU `maps: []`,
bei bekannter ECU leere Tabelle (Maps folgen in Schritt 3+).

---

### Schritt 2 – RomRaider/ecuflash XML auswerten

**Ziel**: Rohdaten für alle drei ECU-Typen in einem gemeinsamen Format vorliegen,
bevor sie in Rust-Konstanten überführt werden.

**Vorgehen**:
1. RomRaider-Definitions-Repository klonen / ZIP herunterladen
2. `ms42.xml`, `ms43.xml`, `ms45.xml` parsen
3. Pro Map extrahieren: `storageaddress`, `sizex`/`sizey`, `name`, `type`,
   `units`, Skalierungs-`expression` (z.B. `x*0.75-48`)
4. Ergebnis als kommentierte Zwischentabelle dokumentieren (CSV oder Markdown)

**Ausgabe**: `docs/data/ms42-maps.csv`, `ms43-maps.csv`, `ms45-maps.csv`  
(Nicht im Repo getracked wenn > 500 Zeilen, sonst als Referenz behalten)

**Definition of Done**: Tabelle enthält für jede ECU mind. die 20 wichtigsten Maps
(Injection, Ignition, Boost, Lambda) mit verifizierten Offsets.

---

### Schritt 3 – MS42 Maps implementieren

**Ziel**: MS42-BIN (`Siemens_MS42_*`) zeigt echte Maps im Editor.

**Priorität der Maps** (Reihenfolge des Einpflegens):

| Priorität | Name | Typ | Beschreibung |
|---|---|---|---|
| 1 | `KFZW` | IGNITION | Zündkennfeld Hauptkennfeld |
| 1 | `KFZW2` | IGNITION | Zündkennfeld Klopfregelung |
| 1 | `KFKHFM` | INJECTION | Einspritzmenge Hauptkennfeld |
| 1 | `KFPED` | DRIVER_WISH | Fahrerwunschkennfeld |
| 2 | `LDRPID` | BOOST | Ladedruck-Regelung |
| 2 | `KFLAM` | LAMBDA | Lambda-Sollwert-Kennfeld |
| 2 | `KFMIRL` | TORQUE | Motormomentkennfeld |
| 3 | alle weiteren Maps | – | nach Verfügbarkeit |

**Definition of Done**: MS42-Testfile zeigt mind. Priorität-1-Maps korrekt,
Werte stimmen mit WinOLS-Referenz überein (manuell spot-gecheckt).

---

### Schritt 4 – MS43 Maps implementieren

**Ziel**: MS43-BIN zeigt echte Maps.

**Hinweis**: MS43 teilt ~60% der Map-Offsets mit MS42 nicht (anderes ROM-Layout),
hat aber identische Map-Namen und Skalierungen. Trotzdem eigenständige Tabelle.

**Definition of Done**: Wie Schritt 3, mit MS43-Testfile.

---

### Schritt 5 – MS45 Maps implementieren

**Ziel**: MS45-BIN (1 MB) zeigt echte Maps.

**Besonderheiten MS45**:
- Doppelte Dateigröße → Offsets grundsätzlich anders
- Einige Maps haben andere Dimensionen (z.B. 16×16 statt 8×8)
- Weniger community-dokumentiert als MS42/43 → mehr manuelle Recherche

**Definition of Done**: Wie Schritt 3, mit MS45-Testfile.

---

### Schritt 6 – WASM neu bauen + integrieren

**Ziel**: Neues WASM-Binary landet im Browser-Worker.

**Befehle**:
```bash
wasm-pack build packages/ecu-parser --target web \
  --out-dir packages/ecu-parser-wasm/wasm
```

**Änderungen in `packages/ecu-parser-wasm/src/index.ts`**:  
Keine – das WASM-Interface bleibt identisch. `extract_maps()` gibt nun
echte Maps zurück statt `[]`.

**Definition of Done**: `pnpm dev` läuft, echte BIN laden zeigt Maps im Editor.

---

### Schritt 7 – Validierung & Edge Cases

**Ziel**: Keine Abstürze bei Randtypen, saubere Degradation bei unbekannter ECU.

**Testfälle**:
- [ ] Truncated Binary (<512KB) → keine Maps, kein Panic
- [ ] Unbekannte ECU → `maps: []`, Hex-View trotzdem öffnen
- [ ] Map-Offset außerhalb Buffer-Grenzen → Map überspringen, Rest anzeigen
- [ ] Alle MS42-Priorität-1-Maps Spot-Check gegen Referenzwerte
- [ ] MS43 Spot-Check
- [ ] MS45 Spot-Check

---

## Nicht im Scope dieses Plans

- **Achswerte** (X/Y-Breakpoints) in Phase 1: kommen mit Phase 2 (DAMOS hat sie)
- **Safety-Flags** aus Map-Grenzwerten: Folgt in separatem Plan
- **GS20** (Getriebesteuergerät): Niedrige Priorität, eigener Plan wenn nötig

---

## Abhängigkeiten

```
Phase 1 – WASM

[Schritt 1 – Rust-Gerüst]
        │
        ├──► [Schritt 2 – XML-Auswertung]
        │           │
        │    ┌──────┼───────┐
        │    ▼      ▼       ▼
        │  [3 MS42] [4 MS43] [5 MS45]   ← parallel möglich
        │    └──────┴───────┘
        │           │
        └──────────►[Schritt 6 – WASM Build]
                           │
                           ▼
                    [Schritt 7 – Validierung]
                           │
                           ▼
Phase 2 – Python-Service

              [Schritt 8 – /parse Endpoint]
                           │
                    ┌──────┴──────┐
                    ▼             ▼
          [Schritt 9 – API Route] [Schritt 10 – Worker Fallback]
                    └──────┬──────┘
                           ▼
                  [Schritt 11 – Validierung Phase 2]
```

---

## Phase 2 – Python-Service `/parse`

### Überblick

Der Python-Microservice kennt bereits den ECU-Typ (aus `/fingerprint`). Phase 2
fügt einen `/parse`-Endpunkt hinzu der die vollständige Map-Liste mit DAMOS-basierten
Achswerten zurückgibt. Der Worker ruft diesen Endpunkt nach dem WASM-Parse auf;
wenn er antwortet, ersetzt sein Ergebnis die statische WASM-Tabelle.

**Vorteil gegenüber Phase 1**: DAMOS-Dateien enthalten die echten X/Y-Achsvektoren
(RPM-Breakpoints, Last-Breakpoints etc.) — Phase 1 zeigt diese als `0..n` Indizes,
Phase 2 zeigt echte Werte wie `[800, 1200, 1600, 2000, ...]`.

---

### Schritt 8 – Python: `/parse`-Endpunkt

**Ziel**: Der Python-Microservice kann eine ECU-Binary vollständig parsen und
eine strukturierte Map-Liste zurückgeben.

**Eingabe**: `multipart/form-data` mit `file` (Binary)

**Ausgabe** (JSON):
```json
{
  "detected_ecu": "Siemens MS42",
  "confidence": 0.95,
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
      "x_axis_values": [800, 1200, 1600, 2000, 2400, 3000, 3600, 4200, 4800, 5400, 6000, 6500, 6800, 7000, 7200, 7500],
      "y_axis_values": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6],
      "values": [[...], ...],
      "scale_factor": 0.75,
      "scale_offset": -48.0
    }
  ]
}
```

**Implementierung im Python-Service**:
- DAMOS-/A2L-Definitionen pro ECU-Typ als Paket-Ressource (`data/ms42.json` etc.)
- Binary einlesen, für jede MapDef: Offset lesen, uint16 BE dekodieren, Skalierung anwenden
- Achsvektoren aus separaten Offset-Angaben in der DAMOS-Definition lesen

**Definition of Done**: `POST /parse` mit MS42-Binary gibt vollständige Map-Liste
inkl. Achswerte zurück. Werte spot-gecheckt gegen Phase-1-Ergebnis.

---

### Schritt 9 – Next.js: `/api/ecu/parse` Route

**Ziel**: Der Browser kann den Python-Service über eine sichere Next.js-Route erreichen
(kein direkter Browser-zu-Python Zugriff, secret-geschützt wie `/fingerprint`).

**Datei**: `apps/web/src/app/api/ecu/parse/route.ts`

```typescript
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth-Check (wie /fingerprint)
  // FormData weiterleiten an ${ECU_PARSER_URL}/parse
  // Timeout: 15s (Parse dauert länger als Fingerprint)
  // Bei Fehler: { error: "ECU engine unavailable" }, status 502
}
```

**Definition of Done**: `curl -X POST /api/ecu/parse -F file=@ms42.bin`
gibt Map-Liste zurück.

---

### Schritt 10 – Worker: Fallback-Logik

**Ziel**: Der Worker versucht nach dem WASM-Parse den Python-Service und
merged das Ergebnis. Wenn der Service nicht antwortet, bleibt das WASM-Ergebnis.

**Datei**: `apps/web/src/workers/ecu-parser.worker.ts`

**Neue Logik im `parse`-Case**:
```typescript
case 'parse': {
  const buffer = new Uint8Array(msg.buffer)
  // 1. WASM-Parse (immer, gibt sofortige Basis-Maps)
  const wasmResult = await parseECU(buffer, msg.format)

  // 2. Python-Service versuchen (optional, verbessert Achswerte)
  const enhanced = await tryEnhanceWithService(buffer, wasmResult)

  self.postMessage({ type: 'parse:success', result: enhanced })
}

async function tryEnhanceWithService(
  buffer: Uint8Array,
  fallback: ParsedECU,
): Promise<ParsedECU> {
  try {
    const form = new FormData()
    form.append('file', new Blob([buffer]))
    const res = await fetch('/api/ecu/parse', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return fallback
    const data = await res.json()
    // Service-Maps haben Achswerte → überschreiben WASM-Maps
    return { ...fallback, maps: data.maps, detectedEcu: data.detected_ecu }
  } catch {
    return fallback  // Offline oder Service down → WASM-Ergebnis bleibt
  }
}
```

**Definition of Done**: Editor zeigt WASM-Maps sofort. Wenn Service antwortet,
werden Maps mit echten Achswerten aktualisiert (kein Flackern da gleiche Map-IDs).

---

### Schritt 11 – Validierung Phase 2

**Ziel**: Achswerte korrekt, Fallback funktioniert zuverlässig.

**Testfälle**:
- [ ] Service erreichbar: Maps haben echte RPM/Load-Achswerte
- [ ] Service nicht erreichbar (timeout): WASM-Maps werden angezeigt, kein Fehler
- [ ] Service gibt 502: Fallback greift, kein UI-Fehler
- [ ] Map-Werte Phase 1 vs. Phase 2 identisch (nur Achswerte unterscheiden sich)
- [ ] MS42, MS43, MS45 je spot-gecheckt
