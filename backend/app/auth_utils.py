import os
from datetime import datetime, timedelta

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import pandas as pd

SECRET_KEY = os.getenv("SECRET_KEY", "local-dev-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
USERS_CSV = os.path.join(DATA_DIR, "users.csv")


def _ensure_csv():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(USERS_CSV):
        df = pd.DataFrame(columns=["username", "hashed_password", "created_at"])
        df.to_csv(USERS_CSV, index=False)


def get_users_df() -> pd.DataFrame:
    _ensure_csv()
    return pd.read_csv(USERS_CSV)


def save_users_df(df: pd.DataFrame):
    _ensure_csv()
    df.to_csv(USERS_CSV, index=False)


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
