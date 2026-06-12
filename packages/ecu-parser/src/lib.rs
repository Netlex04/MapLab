use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

// ─── MapDefinition input types (mirrored from @maplab/definition-parser) ──────

#[derive(Deserialize, Clone, Debug)]
struct AxisScale {
    factor: f64,
    offset: f64,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct AxisDefinition {
    label: Option<String>,
    unit: Option<String>,
    source: String,
    values: Option<Vec<f64>>,
    offset: Option<usize>,
    length: Option<usize>,
    data_type: Option<String>,
    endianness: Option<String>,
    scale: Option<AxisScale>,
}

#[derive(Deserialize, Clone, Debug)]
struct MapValueDef {
    unit: Option<String>,
    factor: f64,
    offset: f64,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct MapDefinitionSource {
    #[serde(rename = "type")]
    source_type: String,
    name: Option<String>,
    version: Option<String>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct MapCompatibility {
    ecu: Option<String>,
    expected_file_size: Option<usize>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct MapDefinition {
    id: String,
    name: String,
    category: String,
    offset: usize,
    rows: usize,
    cols: usize,
    data_type: String,
    endianness: String,
    value: MapValueDef,
    x_axis: Option<AxisDefinition>,
    y_axis: Option<AxisDefinition>,
    source: MapDefinitionSource,
    compatibility: Option<MapCompatibility>,
    confidence: String,
}

// ─── Extraction output types ───────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ExtractionAxis {
    label: Option<String>,
    unit: Option<String>,
    values: Vec<f64>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ExtractionMapSource {
    #[serde(rename = "type")]
    source_type: String,
    name: Option<String>,
    version: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct MapWarning {
    code: String,
    severity: String,
    message: String,
    map_id: Option<String>,
    offset: Option<usize>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ExtractedMap {
    id: String,
    definition_id: String,
    name: String,
    category: String,
    offset: usize,
    rows: usize,
    cols: usize,
    value_unit: Option<String>,
    x_axis: ExtractionAxis,
    y_axis: ExtractionAxis,
    values: Vec<Vec<f64>>,
    raw_values: Vec<Vec<f64>>,
    source: ExtractionMapSource,
    confidence: String,
    warnings: Vec<MapWarning>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtractionResult {
    maps: Vec<ExtractedMap>,
    warnings: Vec<MapWarning>,
}

// ─── Data types (mirrored from @maplab/types) ─────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ECUMap {
    pub id: String,
    #[serde(rename = "fileVersionId")]
    pub file_version_id: String,
    pub name: Option<String>,
    #[serde(rename = "aiLabel")]
    pub ai_label: Option<String>,
    #[serde(rename = "type")]
    pub map_type: Option<String>,
    pub offset: usize,
    pub rows: usize,
    pub cols: usize,
    #[serde(rename = "xAxisLabel")]
    pub x_axis_label: Option<String>,
    #[serde(rename = "yAxisLabel")]
    pub y_axis_label: Option<String>,
    #[serde(rename = "valueUnit")]
    pub value_unit: Option<String>,
    pub values: Vec<Vec<f64>>,
    #[serde(rename = "scaledValues")]
    pub scaled_values: Option<Vec<Vec<f64>>>,
    #[serde(rename = "safetyFlags")]
    pub safety_flags: Option<Vec<()>>,
}

#[derive(Serialize, Deserialize)]
pub struct ParsedECU {
    pub format: String,
    pub size: usize,
    pub checksum: String,
    pub maps: Vec<ECUMap>,
    #[serde(rename = "detectedEcu")]
    pub detected_ecu: Option<String>,
    pub confidence: f64,
}

#[derive(Serialize)]
pub struct HexSlice {
    pub offset: usize,
    pub bytes: Vec<u8>,
    pub ascii: Vec<String>,
}

// ─── ECU signature detection ──────────────────────────────────────────────────

struct EcuSignature {
    name: &'static str,
    size: usize,
    identifier: &'static [u8],
    id_offset: usize,
}

const SIGNATURES: &[EcuSignature] = &[
    EcuSignature { name: "Siemens MS42", size: 524288,  identifier: b"MS42", id_offset: 0x7F020 },
    EcuSignature { name: "Siemens MS43", size: 524288,  identifier: b"MS43", id_offset: 0x7F020 },
    EcuSignature { name: "Siemens MS45", size: 1048576, identifier: b"MS45", id_offset: 0xFF020 },
    EcuSignature { name: "Siemens GS20", size: 262144,  identifier: b"GS20", id_offset: 0x3F020 },
];

fn detect_ecu(buffer: &[u8]) -> Option<(&'static str, f64)> {
    for sig in SIGNATURES {
        if buffer.len() == sig.size {
            let end = (sig.id_offset + sig.identifier.len()).min(buffer.len());
            if end > sig.id_offset && &buffer[sig.id_offset..end] == sig.identifier {
                return Some((sig.name, 0.95));
            }
            // Size match only – lower confidence
            return Some((sig.name, 0.5));
        }
    }
    None
}

// ─── Extraction engine ────────────────────────────────────────────────────────

fn byte_width(data_type: &str) -> usize {
    match data_type {
        "uint8" | "int8" => 1,
        "uint16" | "int16" => 2,
        "uint32" | "int32" | "float32" => 4,
        _ => 2,
    }
}

fn read_raw_value(buffer: &[u8], offset: usize, data_type: &str, big_endian: bool) -> Option<f64> {
    let width = byte_width(data_type);
    if offset + width > buffer.len() {
        return None;
    }
    let b = &buffer[offset..offset + width];
    Some(match data_type {
        "uint8"  => b[0] as f64,
        "int8"   => b[0] as i8 as f64,
        "uint16" => if big_endian { u16::from_be_bytes([b[0], b[1]]) as f64 }
                    else          { u16::from_le_bytes([b[0], b[1]]) as f64 },
        "int16"  => if big_endian { i16::from_be_bytes([b[0], b[1]]) as f64 }
                    else          { i16::from_le_bytes([b[0], b[1]]) as f64 },
        "uint32" => { let a: [u8;4] = b.try_into().ok()?;
                      if big_endian { u32::from_be_bytes(a) as f64 } else { u32::from_le_bytes(a) as f64 } },
        "int32"  => { let a: [u8;4] = b.try_into().ok()?;
                      if big_endian { i32::from_be_bytes(a) as f64 } else { i32::from_le_bytes(a) as f64 } },
        "float32" => { let a: [u8;4] = b.try_into().ok()?;
                       let f = if big_endian { f32::from_be_bytes(a) } else { f32::from_le_bytes(a) };
                       if f.is_nan() || f.is_infinite() { return None; }
                       f as f64 },
        _ => return None,
    })
}

fn resolve_axis(
    buffer: &[u8],
    axis: &Option<AxisDefinition>,
    count: usize,
    map_id: &str,
    label: &str,
) -> (ExtractionAxis, Vec<MapWarning>) {
    let mut warnings: Vec<MapWarning> = Vec::new();
    let (ax_label, ax_unit) = axis
        .as_ref()
        .map(|ax| (ax.label.clone(), ax.unit.clone()))
        .unwrap_or((None, None));

    if let Some(ax) = axis {
        match ax.source.as_str() {
            "inline" => {
                if let Some(vals) = &ax.values {
                    if vals.len() == count {
                        return (ExtractionAxis { label: ax_label, unit: ax_unit, values: vals.clone() }, warnings);
                    }
                    warnings.push(MapWarning {
                        code: "AXIS_LENGTH_MISMATCH".to_string(),
                        severity: "warning".to_string(),
                        message: format!(
                            "{label}-axis has {} inline values but map dimension is {count}",
                            vals.len()
                        ),
                        map_id: Some(map_id.to_string()),
                        offset: None,
                    });
                }
            }
            "address" => {
                if let (Some(off), Some(len)) = (ax.offset, ax.length) {
                    let dt = ax.data_type.as_deref().unwrap_or("uint16");
                    let be = ax.endianness.as_deref().unwrap_or("big") == "big";
                    let w = byte_width(dt);
                    let mut values = Vec::with_capacity(len);
                    let mut any_failed = false;

                    for i in 0..len {
                        if let Some(raw) = read_raw_value(buffer, off + i * w, dt, be) {
                            let scaled = ax.scale.as_ref()
                                .map_or(raw, |s| raw * s.factor + s.offset);
                            values.push(scaled);
                        } else {
                            any_failed = true;
                            values.push(i as f64);
                        }
                    }

                    if any_failed {
                        warnings.push(MapWarning {
                            code: "AXIS_READ_ERROR".to_string(),
                            severity: "warning".to_string(),
                            message: format!("{label}-axis at 0x{off:X} partially out of buffer"),
                            map_id: Some(map_id.to_string()),
                            offset: Some(off),
                        });
                    }

                    return (ExtractionAxis { label: ax_label, unit: ax_unit, values }, warnings);
                }

                warnings.push(MapWarning {
                    code: "AXIS_ADDRESS_MISSING".to_string(),
                    severity: "info".to_string(),
                    message: format!("{label}-axis source is 'address' but offset/length is missing"),
                    map_id: Some(map_id.to_string()),
                    offset: None,
                });
            }
            _ => {} // "index", "calculated", "unknown" → fall through to index
        }
    }

    // Index fallback
    let values: Vec<f64> = (0..count).map(|i| i as f64).collect();
    (ExtractionAxis { label: ax_label, unit: ax_unit, values }, warnings)
}

fn extract_single_map(buffer: &[u8], def: &MapDefinition) -> Result<ExtractedMap, MapWarning> {
    let big_endian = def.endianness == "big";
    let width = byte_width(&def.data_type);
    let required = def.offset + def.rows * def.cols * width;

    if required > buffer.len() {
        return Err(MapWarning {
            code: "OFFSET_OUT_OF_BOUNDS".to_string(),
            severity: "warning".to_string(),
            message: format!(
                "Map '{}' at 0x{:X} needs {required} bytes, buffer is {} — skipped",
                def.name, def.offset, buffer.len()
            ),
            map_id: Some(def.id.clone()),
            offset: Some(def.offset),
        });
    }

    let factor = def.value.factor;
    let scale_offset = def.value.offset;
    let mut raw_values: Vec<Vec<f64>> = Vec::with_capacity(def.rows);
    let mut scaled_values: Vec<Vec<f64>> = Vec::with_capacity(def.rows);

    for row in 0..def.rows {
        let mut raw_row = Vec::with_capacity(def.cols);
        let mut scaled_row = Vec::with_capacity(def.cols);
        for col in 0..def.cols {
            let byte_offset = def.offset + (row * def.cols + col) * width;
            let raw = read_raw_value(buffer, byte_offset, &def.data_type, big_endian)
                .unwrap_or(0.0); // bounds already verified above
            raw_row.push(raw);
            scaled_row.push(raw * factor + scale_offset);
        }
        raw_values.push(raw_row);
        scaled_values.push(scaled_row);
    }

    let mut map_warnings: Vec<MapWarning> = Vec::new();

    let (x_axis, xw) = resolve_axis(buffer, &def.x_axis, def.cols, &def.id, "x");
    let (y_axis, yw) = resolve_axis(buffer, &def.y_axis, def.rows, &def.id, "y");
    map_warnings.extend(xw);
    map_warnings.extend(yw);

    // Flag suspiciously blank data (erased flash)
    let all_zero = raw_values.iter().all(|r| r.iter().all(|&v| v == 0.0));
    let all_ff   = raw_values.iter().all(|r| r.iter().all(|&v| v == 255.0));
    if all_zero || all_ff {
        map_warnings.push(MapWarning {
            code: "SUSPICIOUS_MAP_DATA".to_string(),
            severity: "info".to_string(),
            message: format!(
                "Map '{}' contains only {} — may be blank or wrong offset",
                def.name, if all_zero { "0x00" } else { "0xFF" }
            ),
            map_id: Some(def.id.clone()),
            offset: Some(def.offset),
        });
    }

    Ok(ExtractedMap {
        id: def.id.clone(),
        definition_id: def.id.clone(),
        name: def.name.clone(),
        category: def.category.clone(),
        offset: def.offset,
        rows: def.rows,
        cols: def.cols,
        value_unit: def.value.unit.clone(),
        x_axis,
        y_axis,
        values: scaled_values,
        raw_values,
        source: ExtractionMapSource {
            source_type: def.source.source_type.clone(),
            name: def.source.name.clone(),
            version: def.source.version.clone(),
        },
        confidence: def.confidence.clone(),
        warnings: map_warnings,
    })
}

// ─── SHA-256 helper ───────────────────────────────────────────────────────────

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

// ─── WASM-exported parser ─────────────────────────────────────────────────────

#[wasm_bindgen]
pub struct ECUParser {
    buffer: Vec<u8>,
    format: String,
    maps: Vec<ECUMap>,
}

#[wasm_bindgen]
impl ECUParser {
    #[wasm_bindgen(constructor)]
    pub fn new(buffer: &[u8], format: &str) -> Self {
        Self {
            buffer: buffer.to_vec(),
            format: format.to_string(),
            maps: Vec::new(),
        }
    }

    /// Parse buffer and return ParsedECU as JsValue.
    /// Also caches the maps internally so write_map_values can look them up.
    pub fn extract_maps(&mut self) -> JsValue {
        let (detected_ecu, confidence) = match detect_ecu(&self.buffer) {
            Some((name, conf)) => (Some(name.to_string()), conf),
            None => (None, 0.0),
        };

        // extract_maps() is intentionally metadata-only: it returns an empty
        // map list and is only used by parseECU() to populate checksum, size,
        // and detected ECU. Actual extraction runs through
        // extract_maps_from_definitions(), which accepts a MapDefinition[]
        // from the caller and is the authoritative extraction path.
        self.maps = Vec::new();

        let result = ParsedECU {
            format: self.format.clone(),
            size: self.buffer.len(),
            checksum: sha256_hex(&self.buffer),
            maps: self.maps.clone(),
            detected_ecu,
            confidence,
        };

        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    /// Extract maps from a MapDefinition[] passed as JsValue (JSON array).
    ///
    /// Deserializes definitions, runs the extraction engine over the buffer,
    /// and returns ExtractionResult { maps, warnings } as JsValue.
    /// Invalid or out-of-bounds maps produce warnings and are skipped — no panics.
    pub fn extract_maps_from_definitions(&self, definitions_js: JsValue) -> JsValue {
        let definitions: Vec<MapDefinition> = match serde_wasm_bindgen::from_value(definitions_js) {
            Ok(d) => d,
            Err(e) => {
                let result = ExtractionResult {
                    maps: vec![],
                    warnings: vec![MapWarning {
                        code: "DEFINITION_PARSE_ERROR".to_string(),
                        severity: "critical".to_string(),
                        message: format!("Failed to parse map definitions: {e}"),
                        map_id: None,
                        offset: None,
                    }],
                };
                return serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL);
            }
        };

        let mut maps: Vec<ExtractedMap> = Vec::with_capacity(definitions.len());
        let mut warnings: Vec<MapWarning> = Vec::new();

        for def in &definitions {
            match extract_single_map(&self.buffer, def) {
                Ok(map) => maps.push(map),
                Err(w) => warnings.push(w),
            }
        }

        let result = ExtractionResult { maps, warnings };
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    /// Return a hex + ASCII slice of the buffer for the Hex View.
    pub fn get_hex_slice(&self, offset: usize, length: usize) -> JsValue {
        let start = offset.min(self.buffer.len());
        let end = (offset + length).min(self.buffer.len());
        let slice = &self.buffer[start..end];

        let ascii: Vec<String> = slice
            .iter()
            .map(|&b| {
                if (0x20..=0x7e).contains(&b) {
                    (b as char).to_string()
                } else {
                    ".".to_string()
                }
            })
            .collect();

        let result = HexSlice {
            offset: start,
            bytes: slice.to_vec(),
            ascii,
        };

        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    /// SHA-256 of the entire buffer.
    pub fn checksum(&self) -> String {
        sha256_hex(&self.buffer)
    }

    /// Write map values back into a copy of the buffer and return it.
    ///
    /// Values are stored as unsigned 16-bit integers in big-endian (Motorola)
    /// byte order – the standard for Siemens MS4X ECUs.
    ///
    /// The map must have been returned by extract_maps() so the parser knows
    /// its offset and dimensions. If the map_id is not found, the original
    /// buffer is returned unchanged.
    pub fn write_map_values(&mut self, map_id: &str, values: JsValue) -> Vec<u8> {
        let Ok(values): Result<Vec<Vec<f64>>, _> = serde_wasm_bindgen::from_value(values) else {
            return self.buffer.clone();
        };

        let Some(map) = self.maps.iter().find(|m| m.id == map_id).cloned() else {
            return self.buffer.clone();
        };

        for (row, row_vals) in values.iter().enumerate() {
            for (col, &val) in row_vals.iter().enumerate() {
                let byte_offset = map.offset + (row * map.cols + col) * 2;
                if byte_offset + 2 > self.buffer.len() {
                    continue;
                }
                // Clamp to u16 range before casting
                let raw = val.round().clamp(0.0, 65535.0) as u16;
                self.buffer[byte_offset] = (raw >> 8) as u8;      // high byte
                self.buffer[byte_offset + 1] = (raw & 0xFF) as u8; // low byte
            }
        }

        self.buffer.clone()
    }

    /// Byte-level diff: returns changed byte ranges as [{offset, length}] JSON.
    pub fn fast_diff(&self, other: &ECUParser) -> JsValue {
        #[derive(Serialize)]
        struct DiffRange { offset: usize, length: usize }

        let mut ranges: Vec<DiffRange> = Vec::new();
        let len = self.buffer.len().max(other.buffer.len());
        let mut in_range = false;
        let mut range_start = 0;

        for i in 0..len {
            let a = self.buffer.get(i).copied().unwrap_or(0);
            let b = other.buffer.get(i).copied().unwrap_or(0);
            if a != b && !in_range {
                in_range = true;
                range_start = i;
            } else if a == b && in_range {
                ranges.push(DiffRange { offset: range_start, length: i - range_start });
                in_range = false;
            }
        }
        if in_range {
            ranges.push(DiffRange { offset: range_start, length: len - range_start });
        }

        serde_wasm_bindgen::to_value(&ranges).unwrap_or(JsValue::NULL)
    }
}
