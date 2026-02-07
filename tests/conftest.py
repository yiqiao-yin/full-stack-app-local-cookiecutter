import os
import sys
import tempfile

import pytest
from dotenv import load_dotenv

# Add backend/ to sys.path so "from app.xxx import yyy" works
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# Load .env from project root for CLAUDE_API_KEY etc.
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


@pytest.fixture()
def temp_data_dir(tmp_path, monkeypatch):
    """Patch auth_utils.DATA_DIR and USERS_CSV to a temp directory so tests
    never touch the production users.csv."""
    import app.auth_utils as au

    data_dir = str(tmp_path / "data")
    os.makedirs(data_dir, exist_ok=True)
    users_csv = os.path.join(data_dir, "users.csv")

    monkeypatch.setattr(au, "DATA_DIR", data_dir)
    monkeypatch.setattr(au, "USERS_CSV", users_csv)
    return tmp_path


@pytest.fixture()
def test_client(temp_data_dir):
    """FastAPI TestClient that uses the patched (temp) auth paths."""
    from starlette.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        yield client
