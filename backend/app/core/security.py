import uuid
import jwt
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext

from app.core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_DELTA
from app.db.session import fetch_one

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/admin/login")

def create_access_token(data: Dict[str, Any], expires_delta: Optional = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or ACCESS_TOKEN_EXPIRE_DELTA)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_admin(token: str = Depends(oauth2_scheme)):
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid: str | None = payload.get("uid")
        if uid is None:
            raise cred_exc
    except jwt.PyJWTError:
        raise cred_exc

    row = await fetch_one(
        "SELECT id, email, created_at FROM admin_user WHERE id = :id",
        {"id": uuid.UUID(uid)},
    )
    if not row:
        raise cred_exc
    return {"id": str(row["id"]), "email": row["email"]}
