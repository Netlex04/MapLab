# Open TODOs — MapLab Editor

Dinge, die noch gebaut werden müssen, aber bewusst zurückgestellt sind.

---

## WASM Parser (packages/ecu-parser-wasm)

- [ ] Rust-Crate aufsetzen (`wasm-pack`, `wasm-bindgen`)
- [ ] `ECUParser::new(buffer, format)` implementieren
- [ ] `extract_maps()` — bekannte MS43-Karten-Offsets aus Binary lesen
- [ ] `get_hex_slice(offset, length)` — Hex-View Slicing
- [ ] `checksum()` — SHA-256
- [ ] `fast_diff(other)` — Byte-Range-Diff für DiffView
- [ ] `write_map_values(map_id, values)` — Map-Edit in Buffer schreiben
- [ ] `wasm-pack build --target web` in Turborepo-Pipeline integrieren

**Blockiert:** Editor nutzt vorerst Mock-Daten + DataSource-Interface. WASM wird eingestöpselt, sobald fertig.

---

## Python ECU Engine — /parse/full

- [ ] Echte MS43-Karten-Offsets recherchieren (ms4x.net / DAMOS-Referenz)
- [ ] `parse_full()` Endpoint implementieren: Binary → `{maps[], metadata}`
- [ ] Maps-Struktur: `{id, name, type, offset, rows, cols, xAxis, yAxis, values[][]}`
- [ ] MS42 / MS45 / GS20 Offsets ergänzen (nach MS43)
- [ ] `/checksum/fix` implementieren (Hersteller-spezifischer Algorithmus)
- [ ] `/export/{format}` für BIN → HEX Konvertierung

**Blockiert:** Wird parallel zum Editor-UI entwickelt und dann über DataSource-Interface angebunden.

---

## Explore-Seite

- [ ] Öffentliche Projekte laden und anzeigen
- [ ] Filter: ECU-Typ, Stage, Fahrzeug
- [ ] Community-Feed mit Likes / Forks

---

## Sonstiges

- [ ] `.superpowers/` zu `.gitignore` hinzufügen (Brainstorming-Artefakte)
