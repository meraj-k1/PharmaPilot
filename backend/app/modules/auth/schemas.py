from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class RegisterRequest(BaseModel):
    full_name: str = Field(
        min_length=2,
        max_length=150,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    pharmacy_name: str = Field(
        min_length=2,
        max_length=200,
    )

    @field_validator("full_name", "pharmacy_name")
    @classmethod
    def validate_text(cls, value: str) -> str:

        value = value.strip()

        if not value:
            raise ValueError("Field cannot be empty.")

        return value


class LoginRequest(BaseModel):
    email: EmailStr

    password: str = Field(
        min_length=1,
        max_length=128,
    )


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: EmailStr
    is_active: bool


class PharmacyResponse(BaseModel):
    id: UUID
    name: str
    slug: str


class MembershipResponse(BaseModel):
    pharmacy_id: UUID
    pharmacy_name: str
    role: str


class RegisterResponse(BaseModel):
    user: UserResponse
    pharmacy: PharmacyResponse
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class CurrentUserResponse(BaseModel):
    user: UserResponse
    memberships: list[MembershipResponse]
