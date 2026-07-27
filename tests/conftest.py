from pathlib import Path

import pytest

from backend.app import create_app


@pytest.fixture(autouse=True)
def isolated_database(tmp_path: Path):
    """Every test gets a fresh SQLite file instead of mutating data/games.sqlite3."""
    create_app(tmp_path / "games.sqlite3")
    yield
