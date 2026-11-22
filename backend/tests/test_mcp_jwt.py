from uuid import uuid4

import jwt
import pytest

from app.core.config import get_settings
from app.core.exceptions.base import UnauthorizedException
from app.core.security import (
    create_access_token,
    verify_access_token,
)


def test_valid_jwt_returns_correct_user():
    user_id = uuid4()

    token = create_access_token(user_id)

    result = verify_access_token(token)

    assert result == user_id


def test_invalid_jwt_rejected():
    with pytest.raises(UnauthorizedException):
        verify_access_token("invalid.jwt.token")


def test_refresh_token_cannot_be_used_as_access_token():
    settings = get_settings()

    token = jwt.encode(
        {
            "sub": str(uuid4()),
            "iat": 1000000000,
            "exp": 4102444800,
            "type": "refresh",
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    with pytest.raises(UnauthorizedException):
        verify_access_token(token)


def test_jwt_signed_with_wrong_key_rejected():
    settings = get_settings()

    token = jwt.encode(
        {
            "sub": str(uuid4()),
            "iat": 1000000000,
            "exp": 4102444800,
            "type": "access",
        },
        "incorrect-signing-key-for-test",
        algorithm=settings.JWT_ALGORITHM,
    )

    with pytest.raises(UnauthorizedException):
        verify_access_token(token)
