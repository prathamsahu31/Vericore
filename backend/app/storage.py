"""Hash-addressed local file storage.

CLAUDE.md §3: local filesystem in dev, hash-addressed. The SHA-256 recorded on
upload is the immutable reference used in every downstream citation (§6), so
the hash is computed once, here, and never recomputed from a mutable path.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings
from app.errors import ValidationError

# Upload allowlist (CLAUDE.md §17). Extension and MIME must agree.
ALLOWED: dict[str, tuple[str, ...]] = {
    ".pdf": ("application/pdf",),
    ".png": ("image/png",),
    ".jpg": ("image/jpeg",),
    ".jpeg": ("image/jpeg",),
}
MAX_BYTES = 50 * 1024 * 1024


@dataclass(frozen=True)
class StoredFile:
    sha256: str
    path: Path
    size_bytes: int
    mime_type: str


def validate_upload(filename: str, mime_type: str, size_bytes: int) -> str:
    """Check extension, MIME and size. Returns the normalised extension."""
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED:
        raise ValidationError(
            f"File type {suffix or '(none)'} is not accepted. "
            f"Allowed: {', '.join(sorted(ALLOWED))}",
            detail={"filename": filename},
        )
    if mime_type not in ALLOWED[suffix]:
        raise ValidationError(
            f"File extension {suffix} does not match its content type {mime_type}.",
            detail={"filename": filename, "mime_type": mime_type},
        )
    if size_bytes <= 0:
        raise ValidationError("File is empty.", detail={"filename": filename})
    if size_bytes > MAX_BYTES:
        raise ValidationError(
            f"File is {size_bytes / 1_048_576:.1f} MB; the limit is "
            f"{MAX_BYTES // 1_048_576} MB.",
            detail={"filename": filename},
        )
    return suffix


def store(content: bytes, filename: str, mime_type: str) -> StoredFile:
    """Write content under its own hash. Re-uploading a file is a no-op on disk.

    Identical content therefore occupies one file, while each upload still gets
    its own ``documents`` row — which is what lets duplicate submission be
    *detected* rather than silently collapsed (§9).
    """
    suffix = validate_upload(filename, mime_type, len(content))
    digest = hashlib.sha256(content).hexdigest()

    root = Path(get_settings().storage_path)
    target = root / digest[:2] / digest[2:4] / f"{digest}{suffix}"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)

    return StoredFile(sha256=digest, path=target, size_bytes=len(content), mime_type=mime_type)
