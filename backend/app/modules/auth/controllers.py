from fastapi import APIRouter, status

from app.modules.auth.dependencies import (
    AdminPharmacy,
    CurrentUser,
    DBSession,
)
from app.modules.auth.repositories import AuthRepository
from app.modules.auth.schemas import (
    CurrentUserResponse,
    LoginRequest,
    MembershipResponse,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
)
from app.modules.auth.services import AuthService

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
    db: DBSession,
):

    service = AuthService(db)

    return await service.register(payload)


@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(
    payload: LoginRequest,
    db: DBSession,
):

    service = AuthService(db)

    return await service.login(payload)


@router.get(
    "/me",
    response_model=CurrentUserResponse,
)
async def get_my_profile(
    current_user: CurrentUser,
    db: DBSession,
):

    repository = AuthRepository(db)

    records = await repository.get_memberships(current_user.id)

    memberships = [
        MembershipResponse(
            pharmacy_id=pharmacy.id,
            pharmacy_name=pharmacy.name,
            role=role.code,
        )
        for _, pharmacy, role in records
    ]

    return CurrentUserResponse(
        user=UserResponse.model_validate(current_user),
        memberships=memberships,
    )


@router.get("/admin-check")
async def admin_check(
    pharmacy_id: AdminPharmacy,
):

    return {
        "authorized": True,
        "role": "admin",
        "pharmacy_id": str(pharmacy_id),
    }
