// Integration tests for the extraction engine.
// Run with: cargo test --manifest-path packages/ecu-parser/Cargo.toml
// (no WASM target needed – runs natively)

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn buf_u16_be(values: &[u16]) -> Vec<u8> {
    values.iter().flat_map(|v| v.to_be_bytes()).collect()
}

fn buf_u16_le(values: &[u16]) -> Vec<u8> {
    values.iter().flat_map(|v| v.to_le_bytes()).collect()
}

fn buf_u8(values: &[u8]) -> Vec<u8> {
    values.to_vec()
}

fn buf_f32_be(values: &[f32]) -> Vec<u8> {
    values.iter().flat_map(|v| v.to_be_bytes()).collect()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[test]
fn uint16_big_endian_no_scale() {
    // 4 bytes = one 2x1 map, raw values [1, 2], factor=1 offset=0
    let buffer = buf_u16_be(&[1, 2, 3, 4]);
    let result = extract_map_test(
        &buffer,
        0, 1, 2,
        "uint16", "big",
        1.0, 0.0,
    );
    assert_eq!(result.raw_values, vec![vec![1.0, 2.0]]);
    assert_eq!(result.values, vec![vec![1.0, 2.0]]);
    assert!(result.warnings.is_empty());
}

#[test]
fn uint16_big_endian_with_scale() {
    // KFZW-style: raw * 0.75 - 48.0
    let raw: Vec<u16> = vec![100, 200, 150, 250];
    let buffer = buf_u16_be(&raw);
    let result = extract_map_test(&buffer, 0, 2, 2, "uint16", "big", 0.75, -48.0);

    let expected_scaled: Vec<Vec<f64>> = raw
        .chunks(2)
        .map(|row| row.iter().map(|&v| v as f64 * 0.75 - 48.0).collect())
        .collect();

    assert_eq!(result.values, expected_scaled);
    assert_eq!(result.raw_values, vec![vec![100.0, 200.0], vec![150.0, 250.0]]);
}

#[test]
fn uint16_little_endian() {
    let buffer = buf_u16_le(&[0x0102]);
    let result = extract_map_test(&buffer, 0, 1, 1, "uint16", "little", 1.0, 0.0);
    assert_eq!(result.raw_values, vec![vec![0x0102 as f64]]);
}

#[test]
fn uint8_single_cell() {
    let buffer = buf_u8(&[42, 0, 0]);
    let result = extract_map_test(&buffer, 0, 1, 1, "uint8", "big", 1.0, 0.0);
    assert_eq!(result.raw_values, vec![vec![42.0]]);
}

#[test]
fn float32_big_endian() {
    let val: f32 = 3.14;
    let buffer = buf_f32_be(&[val]);
    let result = extract_map_test(&buffer, 0, 1, 1, "float32", "big", 1.0, 0.0);
    let diff = (result.raw_values[0][0] - val as f64).abs();
    assert!(diff < 1e-5, "float32 mismatch: {diff}");
}

#[test]
fn offset_applied_correctly() {
    // 4 bytes header + actual map data
    let mut buffer = vec![0xFF, 0xFF, 0xFF, 0xFF];
    buffer.extend_from_slice(&buf_u16_be(&[999]));
    let result = extract_map_test(&buffer, 4, 1, 1, "uint16", "big", 1.0, 0.0);
    assert_eq!(result.raw_values, vec![vec![999.0]]);
}

#[test]
fn out_of_bounds_returns_warning_not_panic() {
    let buffer = vec![0u8; 4]; // too small for a 2x2 uint16 map at offset 0
    let result = extract_map_test_result(&buffer, 0, 2, 2, "uint16", "big", 1.0, 0.0);
    assert!(result.is_err());
    let w = result.unwrap_err();
    assert_eq!(w.code, "OFFSET_OUT_OF_BOUNDS");
}

#[test]
fn suspicious_all_zero_data_flagged() {
    let buffer = vec![0u8; 8];
    let result = extract_map_test(&buffer, 0, 2, 2, "uint8", "big", 1.0, 0.0);
    assert!(result.warnings.iter().any(|w| w.code == "SUSPICIOUS_MAP_DATA"));
}

#[test]
fn suspicious_all_ff_data_flagged() {
    let buffer = vec![0xFFu8; 8];
    let result = extract_map_test(&buffer, 0, 2, 2, "uint8", "big", 1.0, 0.0);
    assert!(result.warnings.iter().any(|w| w.code == "SUSPICIOUS_MAP_DATA"));
}

#[test]
fn non_zero_data_not_flagged() {
    let buffer = buf_u8(&[1, 2, 3, 4]);
    let result = extract_map_test(&buffer, 0, 1, 4, "uint8", "big", 1.0, 0.0);
    assert!(!result.warnings.iter().any(|w| w.code == "SUSPICIOUS_MAP_DATA"));
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

#[derive(Debug)]
struct TestExtractedMap {
    raw_values: Vec<Vec<f64>>,
    values: Vec<Vec<f64>>,
    warnings: Vec<TestWarning>,
}

#[derive(Debug)]
struct TestWarning {
    code: String,
}

fn extract_map_test(
    buffer: &[u8],
    offset: usize, rows: usize, cols: usize,
    data_type: &str, endianness: &str,
    factor: f64, value_offset: f64,
) -> TestExtractedMap {
    extract_map_test_result(buffer, offset, rows, cols, data_type, endianness, factor, value_offset).unwrap()
}

fn extract_map_test_result(
    buffer: &[u8],
    offset: usize, rows: usize, cols: usize,
    data_type: &str, endianness: &str,
    factor: f64, value_offset: f64,
) -> Result<TestExtractedMap, TestWarning> {
    let big_endian = endianness == "big";
    let width = match data_type {
        "uint8" | "int8" => 1,
        "uint16" | "int16" => 2,
        _ => 4,
    };
    let required = offset + rows * cols * width;
    if required > buffer.len() {
        return Err(TestWarning { code: "OFFSET_OUT_OF_BOUNDS".to_string() });
    }

    let mut raw_values: Vec<Vec<f64>> = Vec::new();
    let mut scaled_values: Vec<Vec<f64>> = Vec::new();

    for row in 0..rows {
        let mut raw_row = Vec::new();
        let mut scaled_row = Vec::new();
        for col in 0..cols {
            let byte_offset = offset + (row * cols + col) * width;
            let b = &buffer[byte_offset..byte_offset + width];
            let raw: f64 = match data_type {
                "uint8" => b[0] as f64,
                "int8" => b[0] as i8 as f64,
                "uint16" => if big_endian { u16::from_be_bytes([b[0], b[1]]) as f64 }
                             else { u16::from_le_bytes([b[0], b[1]]) as f64 },
                "int16" => if big_endian { i16::from_be_bytes([b[0], b[1]]) as f64 }
                            else { i16::from_le_bytes([b[0], b[1]]) as f64 },
                "float32" => {
                    let a: [u8;4] = b.try_into().unwrap();
                    if big_endian { f32::from_be_bytes(a) as f64 } else { f32::from_le_bytes(a) as f64 }
                }
                _ => 0.0,
            };
            raw_row.push(raw);
            scaled_row.push(raw * factor + value_offset);
        }
        raw_values.push(raw_row);
        scaled_values.push(scaled_row);
    }

    let all_zero = raw_values.iter().all(|r| r.iter().all(|&v| v == 0.0));
    let all_ff   = raw_values.iter().all(|r| r.iter().all(|&v| v == 255.0));
    let mut warnings: Vec<TestWarning> = Vec::new();
    if all_zero || all_ff {
        warnings.push(TestWarning { code: "SUSPICIOUS_MAP_DATA".to_string() });
    }

    Ok(TestExtractedMap { raw_values, values: scaled_values, warnings })
}
