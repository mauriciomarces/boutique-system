import os
import tempfile
from pathlib import Path

ROOT = Path(tempfile.mkdtemp(prefix="sposabella-ai-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(ROOT / 'history.sqlite').as_posix()}"
os.environ["AI_DATA_DIR"] = str(ROOT / "data")
os.environ["AI_MODELS_DIR"] = str(ROOT / "models")
os.environ["AI_METRICS_DIR"] = str(ROOT / "metrics")
