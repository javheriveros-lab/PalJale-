import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cryptography.fernet import Fernet

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "paljale_test")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_connect_test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@paljale.mx")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin-pass")
os.environ.setdefault("BANK_DATA_ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ.setdefault("FRONTEND_URL", "https://paljale.mx")

import pytest
import pytest_asyncio
from mongomock_motor import AsyncMongoMockClient
from jose import jwt
from fastapi.testclient import TestClient

import database


@pytest_asyncio.fixture(autouse=True)
async def mock_db(monkeypatch):
    mock_client = AsyncMongoMockClient()
    test_db = mock_client["paljale_test"]
    monkeypatch.setattr(database, "db", test_db)
    monkeypatch.setattr(database, "client", mock_client)
    yield test_db


@pytest.fixture
def client():
    import server
    return TestClient(server.app)


def _make_token(user_id: str, email: str, role: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "role": role}, os.environ["JWT_SECRET"], algorithm="HS256")


@pytest.fixture
def auth_headers():
    def _factory(user_id: str, email: str, role: str) -> dict:
        return {"Authorization": f"Bearer {_make_token(user_id, email, role)}"}
    return _factory
