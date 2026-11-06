from enum import StrEnum
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


class Role(StrEnum):
    ADMIN = "Admin"
    NGO = "NGO"
    VOLUNTEER = "Volunteer"
    DONOR = "Donor"
    HOUSEHOLD = "Household"


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class Profile(Input):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(default="", max_length=25, pattern=r"^[+\d ()-]*$")
    district: str = Field(default="", max_length=100)

    @field_validator("name", "district")
    @classmethod
    def trim(cls, value):
        return value.strip()

    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value):
        if len(value) < 2:
            raise ValueError("Enter your full name.")
        return value


class EmailInput(Input):
    email: EmailStr


class Register(Profile, EmailInput):
    password: str = Field(min_length=12, max_length=128)
    role: Literal["Household", "Donor", "Volunteer", "NGO"]


class Login(EmailInput):
    password: str = Field(min_length=1, max_length=128)


class TokenInput(Input):
    token: str = Field(min_length=32, max_length=200, pattern=r"^[A-Za-z0-9_-]+$")


class ResetPassword(TokenInput):
    password: str = Field(min_length=12, max_length=128)


class ChangePassword(Input):
    current_password: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=12, max_length=128)


class UserAccess(Input):
    role: Role
    status: Literal["active", "suspended"]
    organization_id: str | None = Field(
        default=None, min_length=2, max_length=100, pattern=r"^[A-Za-z0-9_-]+$"
    )

    @model_validator(mode="after")
    def ngo_scope(self):
        if self.role == Role.NGO and not self.organization_id:
            raise ValueError(
                "NGO access requires an administrator-approved organization ID."
            )
        return self
