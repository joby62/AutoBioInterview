from pathlib import Path

from dotenv import load_dotenv

# Always load root .env for local runs and overwrite empty inherited vars.
load_dotenv(dotenv_path=Path(__file__).resolve().with_name(".env"), override=True)

from autobio_app import create_app

app = create_app()
