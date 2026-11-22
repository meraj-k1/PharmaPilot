
import os
from contextvars import ContextVar
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class MCPIdentity:
    user_id: UUID
    pharmacy_id: UUID
    role: str


_identity: ContextVar[MCPIdentity | None] = ContextVar(
    "pharmapilot_mcp_identity",
    default=None,
)

_stdio_mode: ContextVar[bool] = ContextVar(
    "pharmapilot_mcp_stdio_mode",
    default=False,
)


def current_identity() -> MCPIdentity:
    identity = _identity.get()

    if identity is None:
        raise PermissionError(
            "Authenticated MCP context is required."
        )

    return identity


def set_identity(identity: MCPIdentity):
    return _identity.set(identity)


def reset_identity(token) -> None:
    _identity.reset(token)


def enable_stdio_mode():
    return _stdio_mode.set(True)


def reset_stdio_mode(token) -> None:
    _stdio_mode.reset(token)


async def resolve_mcp_identity() -> MCPIdentity:
    """
    HTTP:
        Use the identity verified by the ASGI gateway.

    stdio:
        Verify JWT and pharmacy membership on each
        tool invocation.

    Never accept an unverified pharmacy ID.
    """

    identity = _identity.get()

    if identity is not None:
        return identity

    if not _stdio_mode.get():
        raise PermissionError(
            "Authenticated MCP context is required."
        )

    access_token = os.environ.get(
        "PHARMAPILOT_MCP_ACCESS_TOKEN",
        "",
    ).strip()

    pharmacy_id = os.environ.get(
        "PHARMAPILOT_MCP_PHARMACY_ID",
        "",
    ).strip()

    if not access_token or not pharmacy_id:
        raise PermissionError(
            "MCP stdio credentials are required."
        )

    from app.integrations.mcp.auth_adapter import (
        verify_existing_pharmacy_access,
    )

    return await verify_existing_pharmacy_access(
        access_token,
        pharmacy_id,
    )
