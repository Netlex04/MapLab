"""
MS4X ECU Fingerprinting

Identifies Siemens MS42, MS43, MS45, GS20 ECUs from raw binary data.
Detection priority: embedded identifier string > file size match > unknown.

Sources: ms4x.net community documentation, MapLab architecture spec.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


@dataclass
class FingerprintResult:
    ecu_type: Optional[str]
    engine: Optional[str]
    vehicles: Optional[str]
    sw_version: Optional[str]
    confidence: float        # 0.0 – 1.0
    size_bytes: int
    size_ok: bool
    detection_method: str    # "identifier_string" | "size_only" | "none"


# Profiles derived from architecture spec and ms4x.net documentation.
# sw_version_offset: offset in the binary where the ASCII software version string starts.
_ECU_PROFILES: dict[str, dict] = {
    "Siemens MS42": {
        "size_range": (512_000, 512_000),
        "sw_version_offset": 0x7F020,
        "identifier": b"MS42",
        "engine": "BMW M52TU",
        "vehicles": "E46 318i/320i/323i/328i, E39 520i/523i/528i",
    },
    "Siemens MS43": {
        "size_range": (524_288, 524_288),
        "sw_version_offset": 0x7F020,
        "identifier": b"MS43",
        "engine": "BMW M54",
        "vehicles": "E46 320i/325i/330i, E39 520i/525i/530i, Z3/Z4",
    },
    "Siemens MS45": {
        "size_range": (1_048_576, 1_048_576),
        "sw_version_offset": 0xFF020,
        "identifier": b"MS45",
        "engine": "BMW S54 / M54",
        "vehicles": "E46 M3, E85/E86 Z4, E39 M5 (MS45.1)",
    },
    "Siemens GS20": {
        "size_range": (262_144, 524_288),
        "sw_version_offset": 0x3F020,
        "identifier": b"GS20",
        "engine": "SMG Transmission",
        "vehicles": "E46 M3 SMG, E39 M5 SMG",
    },
}


def fingerprint_binary(data: bytes) -> FingerprintResult:
    """
    Identify an ECU binary.

    Phase 1 — identifier string search (most reliable):
      Each Siemens ECU embeds its model string (b"MS43" etc.) in the binary.
      If found, confidence is 0.95 when the file size also matches, else 0.70.

    Phase 2 — size-only fallback:
      If no identifier was found but exactly one profile matches the file size,
      return that with confidence 0.40.

    Phase 3 — unknown:
      Return an empty result with confidence 0.0.
    """
    size = len(data)

    # Phase 1: identifier string
    for ecu_name, profile in _ECU_PROFILES.items():
        if profile["identifier"] in data:
            size_min, size_max = profile["size_range"]
            size_ok = size_min <= size <= size_max
            return FingerprintResult(
                ecu_type=ecu_name,
                engine=profile["engine"],
                vehicles=profile["vehicles"],
                sw_version=_read_version_string(data, profile["sw_version_offset"]),
                confidence=0.95 if size_ok else 0.70,
                size_bytes=size,
                size_ok=size_ok,
                detection_method="identifier_string",
            )

    # Phase 2: size-only
    size_matches = [
        (name, prof)
        for name, prof in _ECU_PROFILES.items()
        if prof["size_range"][0] <= size <= prof["size_range"][1]
    ]
    if len(size_matches) == 1:
        ecu_name, profile = size_matches[0]
        return FingerprintResult(
            ecu_type=ecu_name,
            engine=profile["engine"],
            vehicles=profile["vehicles"],
            sw_version=_read_version_string(data, profile["sw_version_offset"]),
            confidence=0.40,
            size_bytes=size,
            size_ok=True,
            detection_method="size_only",
        )

    # Phase 3: unknown
    return FingerprintResult(
        ecu_type=None,
        engine=None,
        vehicles=None,
        sw_version=None,
        confidence=0.0,
        size_bytes=size,
        size_ok=False,
        detection_method="none",
    )


def _read_version_string(data: bytes, offset: int, max_len: int = 20) -> Optional[str]:
    """
    Read a printable ASCII run from the given offset.
    Returns None if the offset is out of bounds or the result is too short to be meaningful.
    """
    if offset + max_len > len(data):
        return None

    chars: list[str] = []
    for byte in data[offset : offset + max_len]:
        if 0x20 <= byte <= 0x7E:
            chars.append(chr(byte))
        elif chars:
            break  # stop at first non-printable after we started collecting

    result = "".join(chars).strip()
    return result if len(result) >= 4 else None
