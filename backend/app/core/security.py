from datetime import datetime, timedelta, timezone
from typing import Any, Union
import jwt
import bcrypt
from app.core.config import settings

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(subject: Union[str, Any], role: str, expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
        "iat": datetime.now(timezone.utc)
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decodes and validates JWT access tokens.
    Supports Supabase Auth JWTs (HS256 with SUPABASE_JWT_SECRET or JWKS)
    as well as application-signed tokens for dual-mode enterprise compatibility.
    """
    # 1. Try Supabase JWT Secret if configured
    if settings.SUPABASE_JWT_SECRET:
        try:
            decoded = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            return decoded
        except jwt.PyJWTError:
            pass

    # 2. Try application internal SECRET_KEY
    try:
        decoded_token = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_aud": False}
        )
        return decoded_token
    except jwt.PyJWTError:
        pass

    # 3. If Supabase is enabled, verify via Supabase Auth API
    if settings.is_supabase_enabled:
        try:
            from app.services.supabase_service import get_supabase_client
            client = get_supabase_client()
            if client:
                user_res = client.auth.get_user(token)
                if user_res and user_res.user:
                    u = user_res.user
                    return {
                        "sub": u.id,
                        "email": u.email,
                        "role": u.user_metadata.get("role", "candidate").lower(),
                        "user_metadata": u.user_metadata
                    }
        except Exception:
            pass

    return None
