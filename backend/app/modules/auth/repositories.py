from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import (
    PharmacyMembership,
    Role,
    User,
)
from app.modules.pharmacies.models import Pharmacy


class AuthRepository:
    def __init__(self, db: AsyncSession):

        self.db = db

    async def get_user_by_email(
        self,
        email: str,
    ) -> User | None:

        statement = select(User).where(User.email == email)

        result = await self.db.execute(statement)

        return result.scalar_one_or_none()

    async def get_user_by_id(
        self,
        user_id: UUID,
    ) -> User | None:

        return await self.db.get(User, user_id)

    async def get_role(
        self,
        code: str,
    ) -> Role | None:

        statement = select(Role).where(Role.code == code)

        result = await self.db.execute(statement)

        return result.scalar_one_or_none()

    async def get_memberships(
        self,
        user_id: UUID,
    ):

        statement = (
            select(
                PharmacyMembership,
                Pharmacy,
                Role,
            )
            .join(
                Pharmacy,
                PharmacyMembership.pharmacy_id == Pharmacy.id,
            )
            .join(
                Role,
                PharmacyMembership.role_id == Role.id,
            )
            .where(PharmacyMembership.user_id == user_id)
        )

        result = await self.db.execute(statement)

        return list(result.all())

    async def get_membership_for_pharmacy(
        self,
        user_id: UUID,
        pharmacy_id: UUID,
    ):

        statement = (
            select(
                PharmacyMembership,
                Role,
            )
            .join(
                Role,
                PharmacyMembership.role_id == Role.id,
            )
            .where(
                PharmacyMembership.user_id == user_id,
                PharmacyMembership.pharmacy_id == pharmacy_id,
            )
        )

        result = await self.db.execute(statement)

        return result.one_or_none()
