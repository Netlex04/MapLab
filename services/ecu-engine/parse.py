"""
ECU Map Extraction

Extracts map values from an ECU binary using the shared internal MapDefinition
JSON files (packages/definition-parser/src/internal/). Python and TypeScript
worker share the same definition source so results are consistent.
"""

from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Optional

from fingerprint import FingerprintResult

# ─── Paths ────────────────────────────────────────────────────────────────────

_DEFS_ROOT = (
    Path(__file__).parent.parent.parent
    / "packages"
    / "definition-parser"
    / "src"
    / "internal"
)

# ─── Definition auto-discovery ────────────────────────────────────────────────

# Maps are discovered at import time by scanning _DEFS_ROOT/**/*.json.
# Directory name → ECU type name (must match fingerprint.py's ecu_type strings).
_ECU_DIR_MAP: dict[str, str] = {
    "ms42": "Siemens MS42",
    "ms43": "Siemens MS43",
    "ms45": "Siemens MS45",
    "gs20": "Siemens GS20",
}


def _discover_definitions() -> dict[str, list[dict[str, str]]]:
    """
    Scan _DEFS_ROOT for <ecu_dir>/<sw_version>.json files and build a registry.

    Registry shape: ecu_type → [{"sw_version": str, "path": str}, ...]
    Each entry's sw_version is the stem of the JSON filename (e.g. "ms430069").
    The list is ordered alphabetically so results are deterministic.
    """
    registry: dict[str, list[dict[str, str]]] = {}
    for ecu_dir, ecu_type in _ECU_DIR_MAP.items():
        dir_path = _DEFS_ROOT / ecu_dir
        if not dir_path.is_dir():
            continue
        entries = sorted(
            [
                {"sw_version": p.stem.upper(), "path": f"{ecu_dir}/{p.name}"}
                for p in dir_path.glob("*.json")
            ],
            key=lambda e: e["sw_version"],
        )
        if entries:
            registry[ecu_type] = entries
    return registry


_DEFINITION_REGISTRY: dict[str, list[dict[str, str]]] = _discover_definitions()

_definition_cache: dict[str, list[dict]] = {}

# ─── Type helpers ─────────────────────────────────────────────────────────────

_STRUCT_CHAR: dict[str, str] = {
    "uint8":   "B",
    "int8":    "b",
    "uint16":  "H",
    "int16":   "h",
    "uint32":  "I",
    "int32":   "i",
    "float32": "f",
}

_BYTE_WIDTH: dict[str, int] = {
    "uint8": 1,   "int8": 1,
    "uint16": 2,  "int16": 2,
    "uint32": 4,  "int32": 4,
    "float32": 4,
}

# Categories that represent meaningful tuning maps.
KNOWN_CATEGORIES: frozenset[str] = frozenset({
    "ignition", "fuel", "lambda", "torque", "driver_wish",
    "limit", "idle", "vanos", "maf", "boost", "diagnostic",
})

# ─── Loader ───────────────────────────────────────────────────────────────────

def load_definitions(ecu_type: str, sw_version: Optional[str] = None) -> list[dict] | None:
    """
    Return MapDefinition list for the given ECU type and optional software version.

    Tries to match sw_version against registry entries; falls back to the first
    available entry for the ECU type. Returns None if no definition exists.
    """
    profiles = _DEFINITION_REGISTRY.get(ecu_type)
    if not profiles:
        return None

    target = profiles[0]
    if sw_version:
        sv = sw_version.upper()
        for p in profiles:
            if p["sw_version"].upper() in sv or sv in p["sw_version"].upper():
                target = p
                break

    cache_key = target["path"]
    if cache_key in _definition_cache:
        return _definition_cache[cache_key]

    path = _DEFS_ROOT / target["path"]
    if not path.exists():
        return None

    with open(path) as f:
        defs: list[dict] = json.load(f)

    _definition_cache[cache_key] = defs
    return defs

# ─── Axis resolver ────────────────────────────────────────────────────────────

def _resolve_axis(axis: dict, length: int, data: bytes) -> list[float]:
    """
    Resolve an AxisDefinition to a concrete list of float values.

    Priority: inline values → address read → index fallback.
    """
    source = axis.get("source", "index")
    scale  = axis.get("scale", {})
    factor = float(scale.get("factor", 1.0))
    off    = float(scale.get("offset", 0.0))

    if source == "inline":
        raw_vals = axis.get("values", [])
        if raw_vals:
            return [v * factor + off for v in raw_vals]

    if source == "address":
        a_offset = axis.get("offset")
        a_length = axis.get("length")
        if a_offset is not None and a_length:
            dt     = axis.get("dataType", "uint16")
            endian = axis.get("endianness", "big")
            prefix = ">" if endian == "big" else "<"
            char   = _STRUCT_CHAR.get(dt, "H")
            bw     = _BYTE_WIDTH.get(dt, 2)
            total  = a_length * bw
            if a_offset + total <= len(data):
                raw = struct.unpack(
                    f"{prefix}{a_length}{char}",
                    data[a_offset : a_offset + total],
                )
                return [v * factor + off for v in raw]

    # Index fallback
    return [float(i) for i in range(length)]

# ─── Map extractor ────────────────────────────────────────────────────────────

def extract_maps(
    data: bytes,
    definitions: list[dict],
    *,
    include_unknown: bool = False,
) -> list[dict]:
    """
    Extract map values from binary data using a list of MapDefinition dicts.

    Returns a list of extracted map dicts. Maps that fail bounds checks or
    struct unpacking are silently skipped.

    Set include_unknown=True to include maps with category "unknown".
    """
    result: list[dict] = []

    for defn in definitions:
        category = defn.get("category", "unknown")
        if not include_unknown and category not in KNOWN_CATEGORIES:
            continue

        offset = defn.get("offset", 0)
        rows   = max(1, defn.get("rows", 1))
        cols   = max(1, defn.get("cols", 1))
        dt     = defn.get("dataType", "uint16")
        endian = defn.get("endianness", "big")

        bw          = _BYTE_WIDTH.get(dt, 2)
        total_bytes = rows * cols * bw

        if offset < 0 or offset + total_bytes > len(data):
            continue

        char   = _STRUCT_CHAR.get(dt, "H")
        prefix = ">" if endian == "big" else "<"
        n      = rows * cols

        try:
            raw_flat = list(
                struct.unpack(f"{prefix}{n}{char}", data[offset : offset + total_bytes])
            )
        except struct.error:
            continue

        val_def    = defn.get("value", {})
        factor     = float(val_def.get("factor", 1.0))
        val_offset = float(val_def.get("offset", 0.0))

        raw_grid    = [raw_flat[r * cols : (r + 1) * cols] for r in range(rows)]
        scaled_grid = [[v * factor + val_offset for v in row] for row in raw_grid]

        x_axis_def = defn.get("xAxis") or {}
        y_axis_def = defn.get("yAxis") or {}

        x_values = _resolve_axis(x_axis_def, cols, data)
        y_values = _resolve_axis(y_axis_def, rows, data)

        result.append({
            "name":          defn.get("name", ""),
            "category":      category,
            "offset":        offset,
            "rows":          rows,
            "cols":          cols,
            "value_unit":    val_def.get("unit"),
            "x_axis_label":  x_axis_def.get("label"),
            "y_axis_label":  y_axis_def.get("label"),
            "x_axis_values": x_values,
            "y_axis_values": y_values,
            "values":        scaled_grid,
            "raw_values":    raw_grid,
            "scale_factor":  factor,
            "scale_offset":  val_offset,
            "source":        defn.get("source", {}).get("type", "internal"),
            "confidence":    defn.get("confidence", "definition"),
        })

    return result

# ─── Top-level parse ──────────────────────────────────────────────────────────

def parse_binary(
    data: bytes,
    fp: FingerprintResult,
    *,
    include_unknown: bool = False,
) -> dict:
    """
    Full parse: load internal definitions for the fingerprinted ECU, extract maps.

    Returns a dict matching ParseResponse in main.py.
    """
    if fp.ecu_type is None:
        return {
            "detected_ecu":      None,
            "confidence":        fp.confidence,
            "definition_source": "none",
            "maps":              [],
        }

    definitions = load_definitions(fp.ecu_type, fp.sw_version)
    if definitions is None:
        return {
            "detected_ecu":      fp.ecu_type,
            "confidence":        fp.confidence,
            "definition_source": "none",
            "maps":              [],
        }

    maps = extract_maps(data, definitions, include_unknown=include_unknown)

    return {
        "detected_ecu":      fp.ecu_type,
        "confidence":        fp.confidence,
        "definition_source": "internal",
        "maps":              maps,
    }
