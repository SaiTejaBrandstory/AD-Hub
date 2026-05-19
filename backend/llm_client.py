"""LLM calls via Emergent proxy (works locally without emergentintegrations package)."""
import json
import logging
import os
import uuid
from pathlib import Path

import httpx

logger = logging.getLogger("adhub.llm")

EMERGENT_MESSAGES_URL = "https://integrations.emergentagent.com/llm/v1/messages"
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"


def _api_key() -> str:
    key = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
    if key:
        return key
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parent / ".env", override=True)
    except Exception:
        pass
    return (os.environ.get("EMERGENT_LLM_KEY") or "").strip()


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    return text


async def complete_text(system: str, user_text: str, max_tokens: int = 4096) -> str:
    """Return assistant text. Uses emergentintegrations if installed, else Emergent HTTP API."""
    api_key = _api_key()
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY not configured — set it in backend/.env")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        chat = (
            LlmChat(
                api_key=api_key,
                session_id=f"adhub_{uuid.uuid4().hex[:8]}",
                system_message=system,
            ).with_model("anthropic", DEFAULT_MODEL)
        )
        return await chat.send_message(UserMessage(text=user_text))
    except ImportError:
        pass

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            EMERGENT_MESSAGES_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": DEFAULT_MODEL,
                "max_tokens": max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": user_text}],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        blocks = data.get("content") or []
        return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")


async def complete_json(system: str, user_text: str, max_tokens: int = 4096) -> dict:
    raw = await complete_text(system, user_text, max_tokens=max_tokens)
    return json.loads(_strip_json_fences(raw))
