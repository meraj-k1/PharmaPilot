import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal, engine
from app.modules.auth.models import Role

ROLES = {
    "admin": "Administrator",
    "staff": "Pharmacy Staff",
}


async def seed_roles():

    async with AsyncSessionLocal() as session:
        for code, name in ROLES.items():
            result = await session.execute(select(Role).where(Role.code == code))

            role = result.scalar_one_or_none()

            if role is None:
                session.add(
                    Role(
                        code=code,
                        name=name,
                    )
                )

            else:
                role.name = name

        await session.commit()

    print("PharmaPilot roles seeded successfully.")


async def main():

    try:
        await seed_roles()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
