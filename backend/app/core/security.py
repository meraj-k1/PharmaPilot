from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash

from app.core.config import get_settings
from app.core.exceptions.base import UnauthorizedException

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash passwords using the recommended Argon2 configuration."""

    return password_hash.hash(password)


def verify_password(
    password: str,
    hashed_password: str,
) -> bool:
    """Verify a password against its stored hash."""

    return password_hash.verify(
        password,
        hashed_password,
    )


def create_access_token(user_id: UUID) -> str:
    """Generate a signed JWT access token."""

    settings = get_settings()

    now = datetime.now(UTC)

    expires_at = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": expires_at,
        "type": "access",
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def verify_access_token(token: str) -> UUID:
    """Validate a JWT and return its user UUID."""

    settings = get_settings()

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={
                "require": ["sub", "iat", "exp"],
            },
            leeway=30,
        )

        if payload.get("type") != "access":
            raise UnauthorizedException("Invalid authentication credentials.")

        return UUID(payload["sub"])

    except (
        InvalidTokenError,
        ValueError,
        TypeError,
        KeyError,
    ) as exc:
        raise UnauthorizedException("Invalid authentication credentials.") from exc
