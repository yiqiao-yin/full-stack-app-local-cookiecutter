from datetime import datetime

from fastapi import APIRouter, HTTPException, status
import pandas as pd

from app.models import UserCreate, Token
from app.auth_utils import (
    get_users_df,
    save_users_df,
    hash_password,
    verify_password,
    create_access_token,
)

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserCreate):
    df = get_users_df()
    if user.username in df["username"].values:
        raise HTTPException(status_code=409, detail="Username already exists")
    new_row = pd.DataFrame(
        [
            {
                "username": user.username,
                "hashed_password": hash_password(user.password),
                "created_at": datetime.utcnow().isoformat(),
            }
        ]
    )
    df = pd.concat([df, new_row], ignore_index=True)
    save_users_df(df)
    return {"message": "registered"}


@router.post("/login", response_model=Token)
def login(user: UserCreate):
    df = get_users_df()
    match = df[df["username"] == user.username]
    if match.empty:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    hashed = match.iloc[0]["hashed_password"]
    if not verify_password(user.password, hashed):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user.username)
    return Token(access_token=token)
