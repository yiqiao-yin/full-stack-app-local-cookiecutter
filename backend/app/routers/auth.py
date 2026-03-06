from fastapi import APIRouter, HTTPException, status

from app.models import UserCreate, Token
from app.auth_utils import (
    get_user,
    create_user,
    hash_password,
    verify_password,
    create_access_token,
)

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserCreate):
    hashed = hash_password(user.password)
    created = create_user(user.username, hashed)
    if not created:
        raise HTTPException(status_code=409, detail="Username already exists")
    return {"message": "registered"}


@router.post("/login", response_model=Token)
def login(user: UserCreate):
    db_user = get_user(user.username)
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user.username)
    return Token(access_token=token)
