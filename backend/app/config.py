import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: Literal["development", "test", "production"] = "development"
    mongodb_uri: SecretStr = SecretStr("mongodb://127.0.0.1:27017")
    mongodb_database: str = Field(
        default="rahma", min_length=1, max_length=63, pattern=r"^[A-Za-z0-9_-]+$"
    )
    jwt_secret: SecretStr
    public_url: str = "http://localhost:5173"
    allowed_origins: Annotated[list[str], NoDecode] = ["*"]
    cookie_secure: bool = False
    session_hours: int = Field(default=8, ge=1, le=24)
    mail_backend: Literal["file", "smtp"] = "file"
    email_directory: Path = Path("dev-emails")
    smtp_host: str = "127.0.0.1"
    smtp_port: int = Field(default=1025, ge=1, le=65535)
    smtp_starttls: bool = False
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    mail_from: str = "RAHMA <noreply@rahma.local>"

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, value):
        if isinstance(value, str):
            return ["*"] if value.strip() == "*" else json.loads(value)
        return value

    def allows_origin(self, origin):
        return "*" in self.allowed_origins or origin in self.allowed_origins

    @model_validator(mode="after")
    def secure_configuration(self):
        secret = self.jwt_secret.get_secret_value()
        if len(secret) < 32 or secret.startswith("replace-"):
            raise ValueError(
                "Set JWT_SECRET to a randomly generated secret of at least 32 characters."
            )
        for origin in [
            self.public_url,
            *(item for item in self.allowed_origins if item != "*"),
        ]:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.path
                or parsed.query
                or parsed.fragment
                or parsed.username
            ):
                raise ValueError(
                    "PUBLIC_URL and ALLOWED_ORIGINS must be exact HTTP(S) origins without paths."
                )
        if not self.allowed_origins or not self.allows_origin(self.public_url):
            raise ValueError(
                "The frontend PUBLIC_URL must be included in ALLOWED_ORIGINS."
            )
        if self.environment == "production":
            if self.mail_backend != "smtp":
                raise ValueError(
                    "Use SMTP for email delivery outside local development."
                )
            if not self.cookie_secure or not self.public_url.startswith("https://"):
                raise ValueError("Production requires HTTPS and secure cookies.")
            if (
                not self.smtp_starttls
                or not self.smtp_username
                or not self.smtp_password.get_secret_value()
            ):
                raise ValueError(
                    "Production requires authenticated SMTP with STARTTLS."
                )
            if any(
                not origin.startswith("https://") for origin in self.allowed_origins
            ):
                raise ValueError("Production origins must use HTTPS.")
        return self


@lru_cache
def get_settings():
    return Settings()
