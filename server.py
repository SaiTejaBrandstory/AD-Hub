"""ASGI entrypoint when Render runs from repo root (Start Command: uvicorn server:app)."""
import importlib.util
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

_spec = importlib.util.spec_from_file_location(
    "adhub_backend_server", _BACKEND / "server.py"
)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["adhub_backend_server"] = _mod
_spec.loader.exec_module(_mod)

app = _mod.app
