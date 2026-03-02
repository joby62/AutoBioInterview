import json
import re
from typing import Any, Dict, Optional

from openai import OpenAI

from .config import SETTINGS


def _obj_get(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _extract_text(resp: Any) -> str:
    output_text = _obj_get(resp, "output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    choices = _obj_get(resp, "choices", [])
    if choices:
        msg = _obj_get(choices[0], "message", {})
        content = _obj_get(msg, "content")
        if isinstance(content, str) and content.strip():
            return content.strip()

    output = _obj_get(resp, "output", []) or []
    chunks = []
    for item in output:
        for part in _obj_get(item, "content", []) or []:
            text = _obj_get(part, "text")
            if isinstance(text, str) and text.strip():
                chunks.append(text.strip())
    return "\n".join(chunks).strip()


def _parse_json_text(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

    try:
        obj = json.loads(raw)
    except Exception:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise RuntimeError("Model did not return JSON")
        obj = json.loads(raw[start : end + 1])

    if not isinstance(obj, dict):
        raise RuntimeError("Expected JSON object")
    return obj


class LLMClient:
    def __init__(self) -> None:
        if not SETTINGS.ark_api_key:
            raise RuntimeError("Missing ARK_API_KEY (or OPENAI_API_KEY alias). Check root .env and restart uvicorn.")
        self.client = OpenAI(base_url=SETTINGS.ark_base_url, api_key=SETTINGS.ark_api_key)

    def text(self, *, system_prompt: str, user_text: str, model: Optional[str] = None) -> str:
        model_name = model or SETTINGS.default_model
        try:
            resp = self.client.responses.create(
                model=model_name,
                input=[
                    {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
                    {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
                ],
            )
            text = _extract_text(resp)
            if text:
                return text
            raise RuntimeError("Responses API returned empty text")
        except Exception as exc:
            raise RuntimeError(f"Responses API call failed (model={model_name}): {exc}") from exc

    def json(self, *, system_prompt: str, user_text: str, schema: Dict[str, Any], model: Optional[str] = None) -> Dict[str, Any]:
        model_name = model or SETTINGS.default_model

        try:
            resp = self.client.responses.create(
                model=model_name,
                input=[
                    {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
                    {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": schema["name"],
                        "schema": schema["schema"],
                        "strict": bool(schema.get("strict", True)),
                    }
                },
            )
            text = _extract_text(resp)
            if text:
                return _parse_json_text(text)
            raise RuntimeError("Responses API returned empty JSON text")
        except Exception as exc:
            raise RuntimeError(f"Responses API call failed (model={model_name}): {exc}") from exc


LLM = LLMClient()
