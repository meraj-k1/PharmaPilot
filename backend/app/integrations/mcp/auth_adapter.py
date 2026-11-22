from uuid import UUID

from app.core.exceptions.base import UnauthorizedException
from app.core.security import verify_access_token
from app.db.session import AsyncSessionLocal
from app.integrations.mcp.context import MCPIdentity
from app.modules.auth.repositories import AuthRepository


async def verify_existing_pharmacy_access(
    access_token: str,
    requested_pharmacy_id: str,
) -> MCPIdentity:
    """
    Authenticate MCP access using PharmaPilot's
    existing JWT and database-backed RBAC.

    Security:
    - Validates JWT signature and expiration.
    - Loads the active user from PostgreSQL.
    - Verifies pharmacy membership.
    - Uses the database role, not a client claim.
    - Rejects unauthorized tenant access.
    """

    try:
        pharmacy_id = UUID(requested_pharmacy_id)
    except (TypeError, ValueError) as exc:
        raise PermissionError("Invalid pharmacy identifier.") from exc

    try:
        user_id = verify_access_token(access_token)
    except UnauthorizedException as exc:
        raise PermissionError("Invalid or expired access token.") from exc

    async with AsyncSessionLocal() as db:
        repository = AuthRepository(db)

        user = await repository.get_user_by_id(user_id)

        if user is None or not user.is_active:
            raise PermissionError("Authentication credentials are invalid.")

        membership = await repository.get_membership_for_pharmacy(
            user_id=user.id,
            pharmacy_id=pharmacy_id,
        )

        if membership is None:
            raise PermissionError("Pharmacy access denied.")

        _, role = membership

        if role.code not in {"admin", "staff"}:
            raise PermissionError("Insufficient pharmacy permissions.")

        return MCPIdentity(
            user_id=user.id,
            pharmacy_id=pharmacy_id,
            role=role.code,
        )
