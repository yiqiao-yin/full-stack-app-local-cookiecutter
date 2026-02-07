"""Tests for authentication utilities and endpoints."""

import csv
import os

import pytest
from jose import jwt

from app.auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    SECRET_KEY,
    ALGORITHM,
)


# ---------------------------------------------------------------------------
# Pure unit tests for password hashing
# ---------------------------------------------------------------------------
class TestPasswordHashing:
    def test_hash_returns_bcrypt(self):
        h = hash_password("secret")
        assert h.startswith("$2b$")

    def test_different_hashes_for_same_input(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # salt makes them unique

    def test_verify_correct(self):
        h = hash_password("mypass")
        assert verify_password("mypass", h) is True

    def test_verify_incorrect(self):
        h = hash_password("mypass")
        assert verify_password("wrong", h) is False


# ---------------------------------------------------------------------------
# Pure unit tests for JWT creation / decoding
# ---------------------------------------------------------------------------
class TestJWT:
    def test_returns_string(self):
        token = create_access_token("alice")
        assert isinstance(token, str)
        assert token.count(".") == 2  # header.payload.signature

    def test_contains_username(self):
        token = create_access_token("bob")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "bob"

    def test_has_expiry(self):
        token = create_access_token("carol")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload

    def test_valid_token_extracts_user(self):
        token = create_access_token("dave")
        # Simulate the credentials object that FastAPI injects
        from fastapi.security import HTTPAuthorizationCredentials

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        username = get_current_user(credentials=creds)
        assert username == "dave"

    def test_invalid_token_raises_401(self):
        from fastapi import HTTPException
        from fastapi.security import HTTPAuthorizationCredentials

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad.token.here")
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials=creds)
        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# Integration tests for /api/auth/register
# ---------------------------------------------------------------------------
class TestRegisterEndpoint:
    def test_new_user_returns_201(self, test_client):
        resp = test_client.post(
            "/api/auth/register",
            json={"username": "newuser", "password": "pass123"},
        )
        assert resp.status_code == 201
        assert resp.json()["message"] == "registered"

    def test_duplicate_returns_409(self, test_client):
        payload = {"username": "dupuser", "password": "pass123"}
        test_client.post("/api/auth/register", json=payload)
        resp = test_client.post("/api/auth/register", json=payload)
        assert resp.status_code == 409

    def test_creates_user_in_csv(self, test_client, temp_data_dir):
        test_client.post(
            "/api/auth/register",
            json={"username": "csvuser", "password": "pass123"},
        )
        csv_path = os.path.join(str(temp_data_dir), "data", "users.csv")
        assert os.path.exists(csv_path)
        with open(csv_path) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        usernames = [r["username"] for r in rows]
        assert "csvuser" in usernames


# ---------------------------------------------------------------------------
# Integration tests for /api/auth/login
# ---------------------------------------------------------------------------
class TestLoginEndpoint:
    def _register(self, client, username="loginuser", password="pass123"):
        client.post(
            "/api/auth/register",
            json={"username": username, "password": password},
        )

    def test_valid_creds_returns_token(self, test_client):
        self._register(test_client)
        resp = test_client.post(
            "/api/auth/login",
            json={"username": "loginuser", "password": "pass123"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["access_token"].count(".") == 2

    def test_wrong_password_returns_401(self, test_client):
        self._register(test_client, username="wrongpw")
        resp = test_client.post(
            "/api/auth/login",
            json={"username": "wrongpw", "password": "WRONG"},
        )
        assert resp.status_code == 401

    def test_nonexistent_user_returns_401(self, test_client):
        resp = test_client.post(
            "/api/auth/login",
            json={"username": "ghost", "password": "nope"},
        )
        assert resp.status_code == 401

    def test_token_works_for_auth(self, test_client):
        self._register(test_client, username="flowuser", password="flowpw")
        login_resp = test_client.post(
            "/api/auth/login",
            json={"username": "flowuser", "password": "flowpw"},
        )
        token = login_resp.json()["access_token"]
        # Use the token against the health endpoint (doesn't require auth,
        # but we can verify the header is accepted).
        resp = test_client.get(
            "/api/health",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_token_decoded_has_correct_user(self, test_client):
        self._register(test_client, username="decodeuser", password="decodepw")
        login_resp = test_client.post(
            "/api/auth/login",
            json={"username": "decodeuser", "password": "decodepw"},
        )
        token = login_resp.json()["access_token"]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "decodeuser"
