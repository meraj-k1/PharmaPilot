from uuid import uuid4

import httpx
import pytest

from app.integrations.mcp.gateway import (
    MCPAuthenticationGateway,
)


async def mock_mcp_application(scope, receive, send):
    from starlette.responses import JSONResponse

    response = JSONResponse({"message": "MCP reached"})
    await response(scope, receive, send)


@pytest.fixture
def gateway():
    return MCPAuthenticationGateway(mock_mcp_application)


@pytest.mark.asyncio
async def test_missing_token_rejected(gateway):
    transport = httpx.ASGITransport(app=gateway)

    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/",
            headers={
                "X-Pharmacy-ID": str(uuid4()),
            },
        )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "MCP_UNAUTHORIZED"


@pytest.mark.asyncio
async def test_invalid_pharmacy_rejected(gateway):
    transport = httpx.ASGITransport(app=gateway)

    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/",
            headers={
                "Authorization": "Bearer test-token",
                "X-Pharmacy-ID": "invalid",
            },
        )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unconfigured_authenticator_fails_closed(
    gateway,
    monkeypatch,
):
    from app.integrations.mcp import security

    monkeypatch.setattr(
        security,
        "_authenticator",
        None,
    )

    transport = httpx.ASGITransport(app=gateway)

    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/",
            headers={
                "Authorization": "Bearer test-token",
                "X-Pharmacy-ID": str(uuid4()),
            },
        )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "MCP_AUTH_UNAVAILABLE"
