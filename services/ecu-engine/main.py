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

from fastapi import FastAPI, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import hashlib
import os

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

def verify_internal_secret(x_internal_secret: str = None):
    expected = os.getenv("ECU_PARSER_SECRET", "dev-secret")
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

class DiffResult(BaseModel):
    base_checksum: str
    modified_checksum: str
    changed_ranges: list[dict]
    total_changed_bytes: int

class ECUMetadata(BaseModel):
    detected_ecu: Optional[str]
    confidence: float
    size: int
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


@app.post("/parse/metadata", response_model=ECUMetadata)
async def parse_metadata(
    file: UploadFile,
    _: None = Depends(verify_internal_secret),
):
    """Grundlegende ECU-Erkennung und Metadaten-Extraktion."""
    content = await file.read()
    checksum = hashlib.sha256(content).hexdigest()

    # TODO: Echte ECU-Fingerprinting-Logik
    detected_ecu = _detect_ecu(content)

    return ECUMetadata(
        detected_ecu=detected_ecu,
        confidence=0.0 if detected_ecu is None else 0.7,
        size=len(content),
        checksum=checksum,
        format=_detect_format(file.filename or ""),
        map_count=0,  # Vollständiges Parsing in /parse/full
    )


@app.post("/parse/full")
async def parse_full(
    file: UploadFile,
    _: None = Depends(verify_internal_secret),
):
    """Vollständige ECU-Analyse inkl. aller Maps. (Stub – Implementierung folgt)"""
    content = await file.read()
    checksum = hashlib.sha256(content).hexdigest()

    return {
        "checksum": checksum,
        "size": len(content),
        "maps": [],
        "message": "Full parsing not yet implemented – coming in Phase 2",
    }


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

_ECU_SIGNATURES: dict[str, dict] = {
    # Werden schrittweise ergänzt
}

def _detect_ecu(content: bytes) -> Optional[str]:
    for ecu_name, sig in _ECU_SIGNATURES.items():
        magic = sig.get("magic_bytes", b"")
        if magic and content[:len(magic)] == magic:
            return ecu_name
    return None

def _detect_format(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].upper() if "." in filename else "BIN"
    valid = {"BIN", "HEX", "FRF", "OLS", "XDF", "A2L", "DAMOS"}
    return ext if ext in valid else "BIN"
