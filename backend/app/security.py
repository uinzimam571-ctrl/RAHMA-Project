import hashlib
import secrets
from datetime import timedelta

import jwt
from fastapi import Depends, HTTPException, Request
from pwdlib import PasswordHash
from pymongo.errors import DuplicateKeyError
from starlette.concurrency import run_in_threadpool

from app.database import now

password_hasher = PasswordHash.recommended()
DUMMY_HASH = password_hasher.hash(secrets.token_urlsafe(32))
SESSION_COOKIE = "rahma_session"
CSRF_COOKIE = "rahma_csrf"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


async def hash_password(password: str):
    return await run_in_threadpool(password_hasher.hash, password)


async def password_matches(password: str, encoded: str):
    return await run_in_threadpool(password_hasher.verify, password, encoded)


def public_user(user):
    return {
        key: user.get(key)
        for key in (
            "name",
            "email",
            "role",
            "status",
            "phone",
            "district",
            "organization_id",
            "email_verified",
            "created_at",
        )
    } | {"id": user["_id"]}


async def rate_limit(
    request: Request, scope: str, identity: str, limit: int, seconds=900
):
    timestamp = now()
    bucket = int(timestamp.timestamp()) // seconds
    key = digest(f"{scope}:{identity}:{bucket}")
    collection = request.app.state.db.rate_limits
    try:
        result = await collection.find_one_and_update(
            {"_id": key},
            {
                "$inc": {"count": 1},
                "$setOnInsert": {
                    "expires_at": timestamp + timedelta(seconds=seconds * 2)
                },
            },
            upsert=True,
            return_document=True,
        )
    except DuplicateKeyError:
        result = await collection.find_one_and_update(
            {"_id": key}, {"$inc": {"count": 1}}, return_document=True
        )
    if result["count"] > limit:
        raise HTTPException(
            429,
            "Too many attempts. Please try again later.",
            headers={"Retry-After": str(seconds)},
        )


async def require_origin(request: Request):
    if not request.app.state.settings.allows_origin(request.headers.get("origin")):
        raise HTTPException(403, "Request origin is not allowed.")


async def current_user(request: Request):
    settings = request.app.state.settings
    token = request.cookies.get(SESSION_COOKIE, "")
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            audience="rahma-web",
            issuer="rahma-api",
            options={"require": ["exp", "iat", "sub", "jti", "ver"]},
        )
        if not isinstance(payload["sub"], str) or not isinstance(payload["ver"], int):
            raise jwt.InvalidTokenError()
    except jwt.InvalidTokenError:
        raise HTTPException(
            401, "Your session has expired. Please sign in again."
        ) from None
    db = request.app.state.db
    session = await db.sessions.find_one(
        {"_id": payload["jti"], "user_id": payload["sub"], "expires_at": {"$gt": now()}}
    )
    user = await db.users.find_one({"_id": payload["sub"]})
    if (
        not session
        or not user
        or user["status"] != "active"
        or not user["email_verified"]
        or user["auth_version"] != payload["ver"]
    ):
        raise HTTPException(
            401, "Your session is no longer active. Please sign in again."
        )
    if request.method not in SAFE_METHODS:
        await require_origin(request)
        csrf = request.headers.get("x-csrf-token", "")
        if (
            not csrf
            or not secrets.compare_digest(csrf, request.cookies.get(CSRF_COOKIE, ""))
            or not secrets.compare_digest(digest(csrf), session["csrf_hash"])
        ):
            raise HTTPException(
                403, "Security check failed. Reload the page and try again."
            )
    request.state.session_id = session["_id"]
    return user


async def administrator(user=Depends(current_user)):
    if user["role"] != "Admin":
        raise HTTPException(403, "Administrator access is required.")
    return user


def require_owner_or_organization(
    actor, owner_id: str, organization_id: str | None = None
):
    """Shared guard for later modules; organization identifiers always come from stored records."""
    if actor["role"] == "Admin" or actor["_id"] == owner_id:
        return
    if (
        actor["role"] == "NGO"
        and organization_id
        and actor.get("organization_id") == organization_id
    ):
        return
    raise HTTPException(403, "You cannot access this record.")
