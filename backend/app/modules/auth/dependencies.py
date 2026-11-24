from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.base import (
    ForbiddenException,
    UnauthorizedException,
)
from app.core.security import verify_access_token
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.auth.repositories import AuthRepository

bearer_scheme = HTTPBearer(auto_error=False)


DBSession = Annotated[
    AsyncSession,
    Depends(get_db),
]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DBSession) -> User:

    if credentials is None:
        raise UnauthorizedException("Authentication required.")

    user_id = verify_access_token(credentials.credentials)

    repository = AuthRepository(db)

    user = await repository.get_user_by_id(user_id)

    if user is None or not user.is_active:
        raise UnauthorizedException("Invalid authentication credentials.")

    return user


CurrentUser = Annotated[
    User,
    Depends(get_current_user),
]


async def require_admin(
    current_user: CurrentUser,
    db: DBSession,
    pharmacy_id: Annotated[
        UUID,
        Header(alias="X-Pharmacy-ID"),
    ],
) -> UUID:

    repository = AuthRepository(db)

    membership = await repository.get_membership_for_pharmacy(
        user_id=current_user.id,
        pharmacy_id=pharmacy_id,
    )

    if membership is None:
        raise ForbiddenException("You do not have access to this pharmacy.")

    _, role = membership

    if role.code != "admin":
        raise ForbiddenException("Administrator permission is required.")

    return pharmacy_id


AdminPharmacy = Annotated[
    UUID,
    Depends(require_admin),
]


async def require_staff_or_admin(
    current_user: CurrentUser,
    db: DBSession,
    pharmacy_id: Annotated[
        UUID,
        Header(alias="X-Pharmacy-ID"),
    ],
) -> UUID:

    repository = AuthRepository(db)

    membership = await repository.get_membership_for_pharmacy(
        user_id=current_user.id,
        pharmacy_id=pharmacy_id,
    )

    if membership is None:
        raise ForbiddenException("You do not have access to this pharmacy.")

    _, role = membership

    if role.code not in ("admin", "staff"):
        raise ForbiddenException("Staff or administrator permission is required.")

    return pharmacy_id


StaffOrAdminPharmacy = Annotated[
    UUID,
    Depends(require_staff_or_admin),
]
