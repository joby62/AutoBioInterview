from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    base_dir: Path



def load_settings() -> Settings:
    base_dir = Path(__file__).resolve().parent.parent
    return Settings(
        app_name="Yunnan Journey Guide",
        app_version="1.0.0",
        base_dir=base_dir,
    )


SETTINGS = load_settings()
