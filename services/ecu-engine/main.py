"""
MapLab ECU Engine – Python FastAPI Microservice

Zuständig für:
- Vollständige ECU-Analyse (server-seitig)
- Checksum-Validierung und -Korrektur
- Binary Diff via xdelta3
- Sicherheitsprüfung (Safety Check)
- Formatkonvertierung

Start: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, UploadFile, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import hashlib
import os

from fingerprint import fingerprint_binary, FingerprintResult
from parse import parse_binary

app = FastAPI(
    title="MapLab ECU Engine",
    version="0.1.0",
    docs_url="/docs" if os.getenv("ENV") != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Auth ─────────────────────────────────────────────────────────────────────

def verify_internal_secret(x_internal_secret: Optional[str] = Header(default=None)):
    expected: str = os.getenv("ECU_PARSER_SECRET", "dev-secret")
    if x_internal_secret != expected:
        raise HTTPException(status_code=403, detail="Unauthorized")

# ─── Models ───────────────────────────────────────────────────────────────────

class ChecksumResult(BaseModel):
    valid: bool
    computed: str
    expected: Optional[str] = None
    algorithm: str

class SafetyWarning(BaseModel):
    rule_id: str
    severity: str  # info | warning | critical
    message: str
    affected_offsets: list[int] = []

class SafetyReport(BaseModel):
    score: int  # 0–100
    warnings: list[SafetyWarning]
    passed: bool

class ParsedMapItem(BaseModel):
    name: str
    category: str
    offset: int
    rows: int
    cols: int
    value_unit: Optional[str] = None
    x_axis_label: Optional[str] = None
    y_axis_label: Optional[str] = None
    x_axis_values: list[float]
    y_axis_values: list[float]
    values: list[list[float]]
    scale_factor: float
    scale_offset: float
    source: str
    confidence: str

class ParseResponse(BaseModel):
    detected_ecu: Optional[str] = None
    confidence: float
    definition_source: str
    map_count: int
    maps: list[ParsedMapItem]

class DiffResult(BaseModel):
    base_checksum: str
    modified_checksum: str
    changed_ranges: list[dict]
    total_changed_bytes: int

class ECUMetadata(BaseModel):
    detected_ecu: Optional[str] = None
    engine: Optional[str] = None
    vehicles: Optional[str] = None
    sw_version: Optional[str] = None
    confidence: float
    detection_method: str
    size: int
    size_ok: bool
    checksum: str
    format: str
    map_count: int

# ─── Safety Rules ─────────────────────────────────────────────────────────────

SAFETY_RULES = [
    {
        "id": "LAMBDA_LEAN",
        "check": lambda values: any(v < 0.78 for row in values for v in row),
        "severity": "critical",
        "message": "Lambda-Ziel zu mager – Motorgefahr",
    },
    {
        "id": "BOOST_HIGH",
        "check": lambda values: any(v > 2.8 for row in values for v in row),
        "severity": "warning",
        "message": "Boost-Anforderung ungewöhnlich hoch",
    },
    {
        "id": "IGNITION_ADVANCE",
        "check": lambda values: any(v > 28 for row in values for v in row),
        "severity": "warning",
        "message": "Frühzündung möglicherweise klopfgefährdet",
    },
]

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "ecu-engine"}


@app.post("/fingerprint", response_model=ECUMetadata)
@app.post("/parse/metadata", response_model=ECUMetadata)
async def parse_metadata(
    file: UploadFile,
    _: None = Depends(verify_internal_secret),
):
    """ECU-Erkennung und Metadaten-Extraktion via Fingerprinting."""
    content = await file.read()
    fp = fingerprint_binary(content)

    return ECUMetadata(
        detected_ecu=fp.ecu_type,
        engine=fp.engine,
        vehicles=fp.vehicles,
        sw_version=fp.sw_version,
        confidence=fp.confidence,
        detection_method=fp.detection_method,
        size=fp.size_bytes,
        size_ok=fp.size_ok,
        checksum=hashlib.sha256(content).hexdigest(),
        format=_detect_format(file.filename or ""),
        map_count=0,
    )


@app.post("/parse", response_model=ParseResponse)
async def parse_ecu(
    file: UploadFile,
    include_unknown: bool = False,
    _: None = Depends(verify_internal_secret),
):
    """
    Full ECU parse: fingerprint + extract maps using internal definitions.

    Returns maps with known tuning categories by default.
    Pass include_unknown=true to include all maps (much larger response).
    """
    content = await file.read()
    fp = fingerprint_binary(content)
    result = parse_binary(content, fp, include_unknown=include_unknown)

    maps = [
        ParsedMapItem(
            name=m["name"],
            category=m["category"],
            offset=m["offset"],
            rows=m["rows"],
            cols=m["cols"],
            value_unit=m.get("value_unit"),
            x_axis_label=m.get("x_axis_label"),
            y_axis_label=m.get("y_axis_label"),
            x_axis_values=m["x_axis_values"],
            y_axis_values=m["y_axis_values"],
            values=m["values"],
            scale_factor=m["scale_factor"],
            scale_offset=m["scale_offset"],
            source=m["source"],
            confidence=m["confidence"],
        )
        for m in result["maps"]
    ]

    return ParseResponse(
        detected_ecu=result["detected_ecu"],
        confidence=result["confidence"],
        definition_source=result["definition_source"],
        map_count=len(maps),
        maps=maps,
    )


@app.post("/parse/full", response_model=ParseResponse)
async def parse_full(
    file: UploadFile,
    include_unknown: bool = False,
    _: None = Depends(verify_internal_secret),
):
    """Alias for POST /parse – kept for backwards compatibility."""
    return await parse_ecu(file, include_unknown, _)


@app.post("/checksum/validate", response_model=ChecksumResult)
async def validate_checksum(
    file: UploadFile,
    _: None = Depends(verify_internal_secret),
):
    """SHA-256 Checksum berechnen. Hersteller-spezifische Algorithmen folgen."""
    content = await file.read()
    computed = hashlib.sha256(content).hexdigest()

    return ChecksumResult(
        valid=True,
        computed=computed,
        algorithm="sha256",
    )


@app.post("/diff", response_model=DiffResult)
async def compute_diff(
    base: UploadFile,
    modified: UploadFile,
    _: None = Depends(verify_internal_secret),
):
    """Binary Diff zwischen zwei ECU-Dateien berechnen."""
    base_bytes = await base.read()
    mod_bytes = await modified.read()

    base_checksum = hashlib.sha256(base_bytes).hexdigest()
    mod_checksum = hashlib.sha256(mod_bytes).hexdigest()

    changed_ranges = []
    total_changed = 0
    in_range = False
    range_start = 0

    max_len = max(len(base_bytes), len(mod_bytes))
    for i in range(max_len):
        b = base_bytes[i] if i < len(base_bytes) else -1
        m = mod_bytes[i] if i < len(mod_bytes) else -1
        changed = b != m

        if changed and not in_range:
            in_range = True
            range_start = i
        elif not changed and in_range:
            length = i - range_start
            changed_ranges.append({"offset": range_start, "length": length})
            total_changed += length
            in_range = False

    if in_range:
        length = max_len - range_start
        changed_ranges.append({"offset": range_start, "length": length})
        total_changed += length

    return DiffResult(
        base_checksum=base_checksum,
        modified_checksum=mod_checksum,
        changed_ranges=changed_ranges,
        total_changed_bytes=total_changed,
    )


@app.post("/safety-check", response_model=SafetyReport)
async def safety_check(
    map_values: list[list[float]],
    map_type: str,
    _: None = Depends(verify_internal_secret),
):
    """Plausibilitätsprüfung für Map-Werte."""
    warnings = []

    for rule in SAFETY_RULES:
        try:
            if rule["check"](map_values):
                warnings.append(
                    SafetyWarning(
                        rule_id=rule["id"],
                        severity=rule["severity"],
                        message=rule["message"],
                    )
                )
        except Exception:
            pass

    critical_count = sum(1 for w in warnings if w.severity == "critical")
    warning_count = sum(1 for w in warnings if w.severity == "warning")
    score = max(0, 100 - critical_count * 40 - warning_count * 10)

    return SafetyReport(
        score=score,
        warnings=warnings,
        passed=critical_count == 0,
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _detect_format(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].upper() if "." in filename else "BIN"
    valid = {"BIN", "HEX", "FRF", "OLS", "XDF", "A2L", "DAMOS"}
    return ext if ext in valid else "BIN"
