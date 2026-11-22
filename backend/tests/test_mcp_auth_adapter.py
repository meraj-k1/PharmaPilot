from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.integrations.mcp import auth_adapter


class FakeSession:
    async def __aenter__(self):
        return self

    async def __aexit__(
        self,
        exc_type,
        exc_value,
        traceback,
    ):
        return False


@pytest.mark.asyncio
async def test_valid_user_and_membership(monkeypatch):
    user_id = uuid4()
    pharmacy_id = uuid4()

    user = SimpleNamespace(
        id=user_id,
        is_active=True,
    )

    role = SimpleNamespace(code="admin")

    class FakeRepository:
        def __init__(self, db):
            self.db = db

        async def get_user_by_id(self, requested_id):
            assert requested_id == user_id
            return user

        async def get_membership_for_pharmacy(
            self,
            user_id,
            pharmacy_id,
        ):
            return (object(), role)

    monkeypatch.setattr(
        auth_adapter,
        "verify_access_token",
        lambda token: user_id,
    )

    monkeypatch.setattr(
        auth_adapter,
        "AsyncSessionLocal",
        FakeSession,
    )

    monkeypatch.setattr(
        auth_adapter,
        "AuthRepository",
        FakeRepository,
    )

    identity = await auth_adapter.verify_existing_pharmacy_access(
        "valid-test-token",
        str(pharmacy_id),
    )

    assert identity.user_id == user_id
    assert identity.pharmacy_id == pharmacy_id
    assert identity.role == "admin"


@pytest.mark.asyncio
async def test_inactive_user_denied(monkeypatch):
    user_id = uuid4()

    class FakeRepository:
        def __init__(self, db):
            pass

        async def get_user_by_id(self, requested_id):
            return SimpleNamespace(
                id=user_id,
                is_active=False,
            )

    monkeypatch.setattr(
        auth_adapter,
        "verify_access_token",
        lambda token: user_id,
    )

    monkeypatch.setattr(
        auth_adapter,
        "AsyncSessionLocal",
        FakeSession,
    )

    monkeypatch.setattr(
        auth_adapter,
        "AuthRepository",
        FakeRepository,
    )

    with pytest.raises(
        PermissionError,
        match=r"^Authentication credentials are invalid\.$",
    ):
        await auth_adapter.verify_existing_pharmacy_access(
            "test-token",
            str(uuid4()),
        )


@pytest.mark.asyncio
async def test_missing_membership_denied(monkeypatch):
    user_id = uuid4()

    class FakeRepository:
        def __init__(self, db):
            pass

        async def get_user_by_id(self, requested_id):
            return SimpleNamespace(
                id=user_id,
                is_active=True,
            )

        async def get_membership_for_pharmacy(
            self,
            user_id,
            pharmacy_id,
        ):
            return None

    monkeypatch.setattr(
        auth_adapter,
        "verify_access_token",
        lambda token: user_id,
    )

    monkeypatch.setattr(
        auth_adapter,
        "AsyncSessionLocal",
        FakeSession,
    )

    monkeypatch.setattr(
        auth_adapter,
        "AuthRepository",
        FakeRepository,
    )

    with pytest.raises(
        PermissionError,
        match=r"^Pharmacy access denied\.$",
    ):
        await auth_adapter.verify_existing_pharmacy_access(
            "test-token",
            str(uuid4()),
        )
