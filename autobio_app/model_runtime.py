import os
from threading import Lock
from typing import Dict, List, Optional, Tuple

from .config import SETTINGS


def _build_available_models() -> List[str]:
    configured = [
        m.strip()
        for m in os.environ.get(
            "ARK_MODEL_CHOICES",
            f"{SETTINGS.default_model},{SETTINGS.fallback_model}",
        ).split(",")
        if m.strip()
    ]
    if not configured:
        configured = [SETTINGS.default_model, SETTINGS.fallback_model]
    out: List[str] = []
    for model in configured:
        if model not in out:
            out.append(model)
    return out


_LOCK = Lock()
_AVAILABLE_MODELS = _build_available_models()
_DEFAULT_MODEL = SETTINGS.default_model
if _DEFAULT_MODEL not in _AVAILABLE_MODELS:
    _AVAILABLE_MODELS.append(_DEFAULT_MODEL)

_ORCH_MODEL = _DEFAULT_MODEL
_WRITE_MODEL = _DEFAULT_MODEL


def get_active_models() -> Tuple[str, str]:
    with _LOCK:
        return _ORCH_MODEL, _WRITE_MODEL


def get_model_config() -> Dict[str, object]:
    with _LOCK:
        return {
            "orch_model": _ORCH_MODEL,
            "write_model": _WRITE_MODEL,
            "available_models": list(_AVAILABLE_MODELS),
            "default_model": _DEFAULT_MODEL,
        }


def set_model_config(
    *,
    model: Optional[str] = None,
    orch_model: Optional[str] = None,
    write_model: Optional[str] = None,
) -> Dict[str, object]:
    global _ORCH_MODEL, _WRITE_MODEL

    with _LOCK:
        next_orch = _ORCH_MODEL
        next_write = _WRITE_MODEL

        if model:
            name = model.strip()
            if not name:
                raise ValueError("模型名不能为空")
            if name not in _AVAILABLE_MODELS:
                raise ValueError("不支持的模型")
            next_orch = name
            next_write = name

        if orch_model:
            name = orch_model.strip()
            if not name:
                raise ValueError("编排模型名不能为空")
            if name not in _AVAILABLE_MODELS:
                raise ValueError("不支持的模型")
            next_orch = name

        if write_model:
            name = write_model.strip()
            if not name:
                raise ValueError("写作模型名不能为空")
            if name not in _AVAILABLE_MODELS:
                raise ValueError("不支持的模型")
            next_write = name

        _ORCH_MODEL = next_orch
        _WRITE_MODEL = next_write

        return {
            "orch_model": _ORCH_MODEL,
            "write_model": _WRITE_MODEL,
            "available_models": list(_AVAILABLE_MODELS),
            "default_model": _DEFAULT_MODEL,
        }
