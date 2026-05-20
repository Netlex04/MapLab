# ECU Parser – Architektur

## Zwei-Ebenen-Strategie

```
┌─────────────────────────────────────┐
│  Browser (WASM)                     │
│  - Schnelle Preview beim Upload     │
│  - Hex-Navigation                   │
│  - Map-Rendering                    │
│  - Offline-Fähig                    │
└──────────────┬──────────────────────┘
               │ Komplexe Operationen
┌──────────────▼──────────────────────┐
│  Server (Python Microservice)       │
│  - Vollständige ECU-Analyse         │
│  - Checksum-Berechnung/-Korrektur   │
│  - Binary Diff (xdelta3)            │
│  - Formatkonvertierung              │
│  - Safety-Check mit Gesamtkontext   │
└─────────────────────────────────────┘
```

---

## WASM-Modul (Rust)

### Aufgaben im Browser

```rust
// packages/ecu-parser/src/lib.rs

#[wasm_bindgen]
pub struct ECUParser {
    buffer: Vec<u8>,
    format: FileFormat,
}

#[wasm_bindgen]
impl ECUParser {
    pub fn new(buffer: Vec<u8>, format: FileFormat) -> Self { ... }

    // Alle Maps aus dem Buffer extrahieren
    pub fn extract_maps(&self) -> JsValue { ... }

    // Hex-Ansicht: Slice mit ASCII-Overlay
    pub fn get_hex_slice(&self, offset: usize, length: usize) -> HexSlice { ... }

    // SHA-256 Checksum
    pub fn checksum(&self) -> String { ... }

    // Schneller Byte-Diff (kein xdelta, nur markiert geänderte Ranges)
    pub fn fast_diff(&self, other: &ECUParser) -> Vec<DiffRange> { ... }

    // Map-Wert ändern (in Kopie des Buffers)
    pub fn write_map_values(&self, map_id: &str, values: JsValue) -> Vec<u8> { ... }
}
```

### Build-Pipeline

```
packages/ecu-parser/    (Rust)
├── src/lib.rs
├── src/formats/
│   ├── bin.rs
│   ├── hex.rs
│   ├── xdf.rs
│   └── a2l.rs
└── Cargo.toml
    │
    ▼ wasm-pack build --target web
packages/ecu-parser-wasm/   (npm Package)
├── ecu_parser.wasm
├── ecu_parser.js
└── package.json
```

---

## Python Microservice

### Endpunkte

```python
# services/ecu-engine/main.py (FastAPI)

@app.post("/parse/full")
async def parse_full(file: UploadFile) -> FullECUAnalysis:
    """Tiefe Analyse: alle Maps, Checksums, ECU-Erkennung"""

@app.post("/checksum/validate")
async def validate_checksum(req: ChecksumRequest) -> ChecksumResult:
    """Hersteller-spezifische Checksum-Algorithmen"""

@app.post("/checksum/fix")
async def fix_checksum(req: ChecksumRequest) -> bytes:
    """Checksum neu berechnen und in Datei schreiben"""

@app.post("/diff")
async def compute_diff(base: UploadFile, modified: UploadFile) -> DiffResult:
    """xdelta3 Binary Diff"""

@app.post("/safety-check")
async def safety_check(req: SafetyCheckRequest) -> SafetyReport:
    """Plausibilitätsprüfung aller Maps"""

@app.post("/export/{format}")
async def export_file(ecu: ECUData, format: ExportFormat) -> bytes:
    """Konvertierung zwischen Formaten"""
```

### ECU-Erkennung

```python
# Fingerprinting via bekannte Byte-Sequenzen + Dateistruktur
ECU_SIGNATURES = {
    "Bosch MED17.5": {
        "magic_bytes": b"\x01\x02...",
        "size_range": (512_000, 2_048_000),
        "checksum_offsets": [0x3FFF8, 0x7FFF8],
    },
    # ...
}
```

---

## Unterstützte Formate

| Format | WASM | Python | Beschreibung |
|---|---|---|---|
| **BIN** | Vollständig | Vollständig | Rohes ECU-Binary |
| **HEX** | Vollständig | Vollständig | Intel HEX / Motorola S-Record |
| **XDF** | Lesen | Lesen/Schreiben | TunerPro Definitionsdatei |
| **A2L** | Teilweise | Vollständig | ASAP2 Beschreibungsdatei |
| **FRF** | - | Vollständig | Flash Read File (VAG) |
| **OLS** | - | Vollständig | WinOLS Projektformat |
| **DAMOS** | - | Lesen | Siemens/Continental Map-Definitionen |

---

## Safety-Check Regelwerk

```python
SAFETY_RULES = [
    # Lambda
    Rule("LAMBDA_LEAN", lambda map_val: map_val < 0.78,
         severity="CRITICAL", msg="Lambda-Ziel zu mager – Motorgefahr"),

    # Boost
    Rule("BOOST_HIGH", lambda map_val: map_val > 2.8,
         severity="WARNING", msg="Boost-Anforderung ungewöhnlich hoch"),

    # Inkonsistenz: Boost + Lambda
    CrossRule("BOOST_LAMBDA_MISMATCH",
              lambda boost, lam: boost > 2.2 and lam < 0.85,
              severity="CRITICAL"),

    # Zündwinkel
    Rule("IGNITION_ADVANCE", lambda deg: deg > 28,
         severity="WARNING", msg="Frühzündung möglicherweise klopfgefährdet"),
]
```

Der **Safe Tune Score** (0-100) aggregiert alle Rule-Ergebnisse gewichtet.
