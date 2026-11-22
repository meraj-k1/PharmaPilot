import secrets

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions.base import (
    AppException,
    ConflictException,
    UnauthorizedException,
)
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.modules.auth.models import (
    PharmacyMembership,
    User,
)
from app.modules.auth.repositories import AuthRepository
from app.modules.auth.schemas import (
    LoginRequest,
    PharmacyResponse,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
)
from app.modules.pharmacies.models import Pharmacy

DUMMY_PASSWORD_HASH = hash_password("pharmapilot-dummy-password")


class AuthService:
    def __init__(self, db: AsyncSession):

        self.db = db
        self.repository = AuthRepository(db)

    async def register(
        self,
        data: RegisterRequest,
    ) -> RegisterResponse:

        normalized_email = str(data.email).lower()

        existing_user = await self.repository.get_user_by_email(normalized_email)

        if existing_user:
            raise ConflictException("An account with this email already exists.")

        admin_role = await self.repository.get_role("admin")

        if admin_role is None:
            raise AppException(
                message="System roles are not initialized.",
                status_code=503,
                error_code="SYSTEM_NOT_READY",
            )

        user = User(
            full_name=data.full_name,
            email=normalized_email,
            password_hash=hash_password(data.password),
        )

        pharmacy = Pharmacy(
            name=data.pharmacy_name,
            slug=f"pharmacy-{secrets.token_hex(8)}",
        )

        try:
            self.db.add(user)
            self.db.add(pharmacy)

            await self.db.flush()

            membership = PharmacyMembership(
                user_id=user.id,
                pharmacy_id=pharmacy.id,
                role_id=admin_role.id,
            )

            self.db.add(membership)

            await self.db.commit()

        except IntegrityError as exc:
            await self.db.rollback()

            raise ConflictException(
                "Registration conflicts with an existing record."
            ) from exc

        except Exception:
            await self.db.rollback()
            raise

        return RegisterResponse(
            user=UserResponse.model_validate(user),
            pharmacy=PharmacyResponse(
                id=pharmacy.id,
                name=pharmacy.name,
                slug=pharmacy.slug,
            ),
            role="admin",
        )

    async def login(
        self,
        data: LoginRequest,
    ) -> TokenResponse:

        email = str(data.email).lower()

        user = await self.repository.get_user_by_email(email)

        if user is None:
            verify_password(
                data.password,
                DUMMY_PASSWORD_HASH,
            )

            raise UnauthorizedException("Invalid email or password.")

        if not verify_password(
            data.password,
            user.password_hash,
        ):
            raise UnauthorizedException("Invalid email or password.")

        if not user.is_active:
            raise UnauthorizedException("Invalid email or password.")

        settings = get_settings()

        token = create_access_token(user.id)

        return TokenResponse(
            access_token=token,
            expires_in=(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
        )
