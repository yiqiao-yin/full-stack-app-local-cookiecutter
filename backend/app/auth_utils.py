import os
from datetime import datetime, timedelta

import requests as http_requests
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("SECRET_KEY", "local-dev-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

DYNAMODB_API_URL = os.getenv("DYNAMODB_API_URL", "")
DYNAMODB_API_KEY = os.getenv("DYNAMODB_API_KEY", "")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def _api_headers():
    return {"x-api-key": DYNAMODB_API_KEY, "Content-Type": "application/json"}


def get_user(username: str) -> dict | None:
    resp = http_requests.post(
        f"{DYNAMODB_API_URL}/login",
        headers=_api_headers(),
        json={"username": username},
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def create_user(username: str, hashed_password: str) -> bool:
    resp = http_requests.post(
        f"{DYNAMODB_API_URL}/register",
        headers=_api_headers(),
        json={
            "username": username,
            "hashed_password": hashed_password,
            "created_at": datetime.utcnow().isoformat(),
        },
    )
    if resp.status_code == 409:
        return False
    resp.raise_for_status()
    return True


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
