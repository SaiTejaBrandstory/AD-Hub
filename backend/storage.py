"""Emergent Object Storage wrapper for AdHub dataset files."""
import os
import requests
import logging
from pathlib import Path

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "adhub"

logger = logging.getLogger("adhub.storage")
_storage_key = None


def _emergent_api_key() -> str:
    """Read EMERGENT_LLM_KEY from env, reloading backend/.env if needed."""
    key = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
    if key:
        return key
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parent / ".env", override=True)
    except Exception:
        pass
    return (os.environ.get("EMERGENT_LLM_KEY") or "").strip()


def init_storage():
    """Call once at startup; returns session-scoped storage key."""
    global _storage_key
    if _storage_key:
        return _storage_key
    api_key = _emergent_api_key()
    if not api_key:
        raise RuntimeError(
            "EMERGENT_LLM_KEY not configured — set it in backend/.env and restart the API"
        )
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": api_key}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    logger.info("Object storage initialized")
    return _storage_key


def _key():
    return init_storage()


def put_object(path: str, data: bytes, content_type: str) -> dict:
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": _key(), "Content-Type": content_type},
        data=data, timeout=180,
    )
    if resp.status_code == 403:
        # try to refresh once
        global _storage_key
        _storage_key = None
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": _key(), "Content-Type": content_type},
            data=data, timeout=180,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": _key()}, timeout=120,
    )
    if resp.status_code == 403:
        global _storage_key
        _storage_key = None
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": _key()}, timeout=120,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def dataset_path(workspace_id: str, dataset_id: str, ext: str) -> str:
    return f"{APP_NAME}/datasets/{workspace_id}/{dataset_id}.{ext}"
