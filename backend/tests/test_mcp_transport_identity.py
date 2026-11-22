
from uuid import uuid4

import pytest

from app.integrations.mcp import auth_adapter
from app.integrations.mcp.context import (
    MCPIdentity,
    enable_stdio_mode,
    reset_identity,
    reset_stdio_mode,
    resolve_mcp_identity,
    set_identity,
)


@pytest.mark.asyncio
async def test_http_identity_is_reused():
    identity = MCPIdentity(
        user_id=uuid4(),
        pharmacy_id=uuid4(),
        role="admin",
    )

    token = set_identity(identity)

    try:
        resolved = await resolve_mcp_identity()
        assert resolved == identity
    finally:
        reset_identity(token)


@pytest.mark.asyncio
async def test_missing_identity_rejected():
    with pytest.raises(PermissionError):
        await resolve_mcp_identity()


@pytest.mark.asyncio
async def test_stdio_reauthenticates_each_call(
    monkeypatch,
):
    expected = MCPIdentity(
        user_id=uuid4(),
        pharmacy_id=uuid4(),
        role="staff",
    )

    calls = []

    async def fake_verifier(token, pharmacy_id):
        calls.append((token, pharmacy_id))
        return expected

    monkeypatch.setattr(
        auth_adapter,
        "verify_existing_pharmacy_access",
        fake_verifier,
    )

    monkeypatch.setenv(
        "PHARMAPILOT_MCP_ACCESS_TOKEN",
        "test-token",
    )

    monkeypatch.setenv(
        "PHARMAPILOT_MCP_PHARMACY_ID",
        str(expected.pharmacy_id),
    )

    mode_token = enable_stdio_mode()

    try:
        first = await resolve_mcp_identity()
        second = await resolve_mcp_identity()
    finally:
        reset_stdio_mode(mode_token)

    assert first == expected
    assert second == expected
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_stdio_missing_credentials_rejected(
    monkeypatch,
):
    monkeypatch.delenv(
        "PHARMAPILOT_MCP_ACCESS_TOKEN",
        raising=False,
    )

    monkeypatch.delenv(
        "PHARMAPILOT_MCP_PHARMACY_ID",
        raising=False,
    )

    mode_token = enable_stdio_mode()

    try:
        with pytest.raises(PermissionError):
            await resolve_mcp_identity()
    finally:
        reset_stdio_mode(mode_token)
