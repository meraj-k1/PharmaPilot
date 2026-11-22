from collections.abc import Awaitable, Callable
from uuid import UUID

from app.integrations.mcp.context import MCPIdentity

MCPAuthenticator = Callable[
    [str, str],
    Awaitable[MCPIdentity],
]

_authenticator: MCPAuthenticator | None = None


def configure_mcp_authenticator(
    authenticator: MCPAuthenticator,
) -> None:
    global _authenticator
    _authenticator = authenticator


async def authenticate_mcp_request(
    authorization: str | None,
    pharmacy_header: str | None,
) -> MCPIdentity:
    if not authorization:
        raise PermissionError("Bearer authentication is required.")

    scheme, separator, token = authorization.partition(" ")

    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise PermissionError("Invalid bearer authorization.")

    if not pharmacy_header:
        raise PermissionError("X-Pharmacy-ID header is required.")

    try:
        requested_pharmacy_id = UUID(pharmacy_header)
    except (ValueError, AttributeError) as exc:
        raise PermissionError("Invalid pharmacy ID.") from exc

    if _authenticator is None:
        raise RuntimeError("MCP authentication adapter is not configured.")

    identity = await _authenticator(
        token.strip(),
        str(requested_pharmacy_id),
    )

    if not isinstance(identity, MCPIdentity):
        raise PermissionError("Authentication returned an invalid identity.")

    if identity.pharmacy_id != requested_pharmacy_id:
        raise PermissionError("Pharmacy membership verification failed.")

    if identity.role not in {"admin", "staff"}:
        raise PermissionError("Active pharmacy membership is required.")

    return identity
