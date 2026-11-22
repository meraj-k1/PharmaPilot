from uuid import uuid4

import pytest

from app.integrations.mcp import security
from app.integrations.mcp.context import (
    MCPIdentity,
    current_identity,
    reset_identity,
    set_identity,
)


@pytest.fixture(autouse=True)
def reset_authenticator(monkeypatch):
    monkeypatch.setattr(
        security,
        "_authenticator",
        None,
    )


def test_authenticated_context():
    identity = MCPIdentity(
        user_id=uuid4(),
        pharmacy_id=uuid4(),
        role="admin",
    )

    token = set_identity(identity)

    try:
        assert current_identity() == identity
    finally:
        reset_identity(token)


def test_missing_context():
    with pytest.raises(PermissionError):
        current_identity()


@pytest.mark.asyncio
async def test_missing_bearer_token():
    with pytest.raises(PermissionError):
        await security.authenticate_mcp_request(
            None,
            str(uuid4()),
        )


@pytest.mark.asyncio
async def test_invalid_bearer_token_format():
    with pytest.raises(PermissionError):
        await security.authenticate_mcp_request(
            "Basic fake-credentials",
            str(uuid4()),
        )


@pytest.mark.asyncio
async def test_missing_pharmacy_header():
    with pytest.raises(PermissionError):
        await security.authenticate_mcp_request(
            "Bearer valid-token",
            None,
        )


@pytest.mark.asyncio
async def test_invalid_pharmacy_uuid():
    with pytest.raises(PermissionError):
        await security.authenticate_mcp_request(
            "Bearer valid-token",
            "invalid-uuid",
        )


@pytest.mark.asyncio
async def test_unconfigured_authenticator():
    with pytest.raises(RuntimeError):
        await security.authenticate_mcp_request(
            "Bearer valid-token",
            str(uuid4()),
        )


@pytest.mark.asyncio
async def test_verified_membership():
    expected = MCPIdentity(
        user_id=uuid4(),
        pharmacy_id=uuid4(),
        role="staff",
    )

    async def verifier(token, pharmacy_id):
        assert token == "valid-token"
        assert pharmacy_id == str(expected.pharmacy_id)
        return expected

    security.configure_mcp_authenticator(verifier)

    result = await security.authenticate_mcp_request(
        "Bearer valid-token",
        str(expected.pharmacy_id),
    )

    assert result == expected


@pytest.mark.asyncio
async def test_cross_pharmacy_access_denied():
    verified_pharmacy_id = uuid4()
    requested_pharmacy_id = uuid4()

    async def verifier(token, pharmacy_id):
        return MCPIdentity(
            user_id=uuid4(),
            pharmacy_id=verified_pharmacy_id,
            role="admin",
        )

    security.configure_mcp_authenticator(verifier)

    with pytest.raises(
        PermissionError,
        match="Pharmacy membership verification failed",
    ):
        await security.authenticate_mcp_request(
            "Bearer valid-token",
            str(requested_pharmacy_id),
        )


@pytest.mark.asyncio
async def test_unknown_role_denied():
    pharmacy_id = uuid4()

    async def verifier(token, requested_pharmacy_id):
        return MCPIdentity(
            user_id=uuid4(),
            pharmacy_id=pharmacy_id,
            role="viewer",
        )

    security.configure_mcp_authenticator(verifier)

    with pytest.raises(
        PermissionError,
        match="Active pharmacy membership",
    ):
        await security.authenticate_mcp_request(
            "Bearer valid-token",
            str(pharmacy_id),
        )
