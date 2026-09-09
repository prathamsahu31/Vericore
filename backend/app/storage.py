"""Hash-addressed file storage with optional Supabase Storage backend.

CLAUDE.md §3: local filesystem in dev, hash-addressed. The SHA-256 recorded on
upload is the immutable reference used in every downstream citation (§6), so
the hash is computed once, here, and never recomputed from a mutable path.
When SUPABASE_URL and SUPABASE_KEY are provided, files are also synced to
Supabase Storage for persistent cloud durability.
"""

from __future__ import annotations

import hashlib
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings
from app.errors import ValidationError

log = logging.getLogger(__name__)

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


def _storage_key(digest: str, suffix: str) -> str:
    return f"{digest[:2]}/{digest[2:4]}/{digest}{suffix}"


def _upload_to_supabase(content: bytes, key: str, mime_type: str) -> None:
    settings = get_settings()
    if not settings.use_supabase_storage:
        return
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{settings.supabase_storage_bucket}/{key}"
    headers = {
        "apikey": settings.supabase_key or "",
        "Authorization": f"Bearer {settings.supabase_key or ''}",
        "Content-Type": mime_type,
        "x-upsert": "true",
    }
    req = urllib.request.Request(url, data=content, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status not in (200, 201):
                log.warning("Supabase storage upload status: %s", resp.status)
    except Exception as exc:
        log.error("Failed to upload %s to Supabase Storage: %s", key, exc)


def _download_from_supabase(key: str) -> bytes | None:
    settings = get_settings()
    if not settings.use_supabase_storage:
        return None
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/authenticated/{settings.supabase_storage_bucket}/{key}"
    headers = {
        "apikey": settings.supabase_key or "",
        "Authorization": f"Bearer {settings.supabase_key or ''}",
    }
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read()
    except Exception as exc:
        try:
            pub_url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/{settings.supabase_storage_bucket}/{key}"
            with urllib.request.urlopen(pub_url, timeout=30) as resp:
                return resp.read()
        except Exception:
            log.error("Failed to download %s from Supabase Storage: %s", key, exc)
            return None


def store(content: bytes, filename: str, mime_type: str) -> StoredFile:
    """Write content under its own hash. Re-uploading a file is a no-op on disk.

    Identical content therefore occupies one file, while each upload still gets
    its own ``documents`` row — which is what lets duplicate submission be
    *detected* rather than silently collapsed (§9).
    """
    suffix = validate_upload(filename, mime_type, len(content))
    digest = hashlib.sha256(content).hexdigest()
    key = _storage_key(digest, suffix)

    root = Path(get_settings().storage_path)
    target = root / digest[:2] / digest[2:4] / f"{digest}{suffix}"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)

    # Sync to Supabase Storage if configured
    _upload_to_supabase(content, key, mime_type)

    return StoredFile(sha256=digest, path=target, size_bytes=len(content), mime_type=mime_type)


def ensure_local_copy(path: str | Path) -> Path:
    """Ensure the file exists on the local filesystem.

    If missing locally (e.g. following a container restart), pulls it
    transparently from Supabase Storage into the local cache.
    """
    target = Path(path)
    if target.exists():
        return target

    # Reconstruct key from the path (assumes format .../<p1>/<p2>/<filename>)
    parts = target.parts
    if len(parts) >= 3:
        key = f"{parts[-3]}/{parts[-2]}/{parts[-1]}"
        content = _download_from_supabase(key)
        if content:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            return target

    return target
