from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest

from app.core.config import get_settings
from app.core.exceptions.base import UnauthorizedException
from app.core.security import (
    create_access_token,
    hash_password,
    verify_access_token,
    verify_password,
)


def test_password_hashing():

    password = "password123"

    hashed = hash_password(password)

    assert hashed != password

    assert verify_password(password, hashed)

    assert not verify_password(
        "WrongPassword123!",
        hashed,
    )


def test_jwt_creation_and_verification():

    user_id = uuid4()

    token = create_access_token(user_id)

    decoded_user_id = verify_access_token(token)

    assert decoded_user_id == user_id


def test_invalid_jwt_rejected():

    with pytest.raises(UnauthorizedException):
        verify_access_token("invalid.jwt.token")


def test_wrong_jwt_type_rejected():

    settings = get_settings()

    now = datetime.now(UTC)

    token = jwt.encode(
        {
            "sub": str(uuid4()),
            "iat": now,
            "exp": now + timedelta(hours=1),
            "type": "refresh",
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    with pytest.raises(UnauthorizedException):
        verify_access_token(token)
