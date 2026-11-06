import secrets
from datetime import timedelta
from uuid import uuid4

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pymongo.errors import DuplicateKeyError

from app.database import now
from app.mail import send_account_email
from app.schemas import (
    ChangePassword,
    EmailInput,
    Login,
    Profile,
    Register,
    ResetPassword,
    TokenInput,
)
from app.security import (
    CSRF_COOKIE,
    DUMMY_HASH,
    SESSION_COOKIE,
    current_user,
    digest,
    hash_password,
    password_matches,
    public_user,
    rate_limit,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
GENERIC_EMAIL = "If this email is eligible, a message will arrive shortly. Please check your inbox and spam folder."


async def audit(request, action: str, actor: str):
    await request.app.state.db.auth_events.insert_one(
        {
            "actor_id": actor,
            "action": action,
            "occurred_at": now(),
            "request_id": request.state.request_id,
        }
    )


async def email_challenge(request, user, kind):
    token = secrets.token_urlsafe(32)
    field = "verification" if kind == "verify" else "reset"
    duration = timedelta(hours=24) if kind == "verify" else timedelta(minutes=10)
    await request.app.state.db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                f"{field}_hash": digest(token),
                f"{field}_expires_at": now() + duration,
            },
        },
    )
    # Fragments keep secrets out of HTTP access logs and Referer headers.
    link = f"{request.app.state.settings.public_url}/{kind}#token={token}"
    await send_account_email(request.app.state.settings, user["email"], kind, link)


async def public_limit(request, scope, email=None):
    await rate_limit(
        request, scope, request.client.host if request.client else "unknown", 30
    )
    if email:
        await rate_limit(request, scope + "-email", str(email).casefold(), 5)


@router.post("/register", status_code=202)
async def register(body: Register, request: Request):
    await public_limit(request, "register", body.email)
    email = str(body.email).casefold()
    encoded = await hash_password(body.password)
    user = {
        "_id": str(uuid4()),
        "email": email,
        "name": body.name,
        "phone": body.phone,
        "district": body.district,
        "password_hash": encoded,
        "role": body.role,
        "status": "pending_verification",
        "email_verified": False,
        "organization_id": None,
        "auth_version": 1,
        "created_at": now(),
        "updated_at": now(),
    }
    try:
        await request.app.state.db.users.insert_one(user)
    except DuplicateKeyError:
        return {"message": GENERIC_EMAIL}
    await email_challenge(request, user, "verify")
    await audit(request, "account_registered", user["_id"])
    return {"message": GENERIC_EMAIL}


@router.post("/verify")
async def verify(body: TokenInput, request: Request):
    await public_limit(request, "verify")
    query = {
        "verification_hash": digest(body.token),
        "verification_expires_at": {"$gt": now()},
        "status": "pending_verification",
        "email_verified": False,
    }
    candidate = await request.app.state.db.users.find_one(query)
    if not candidate:
        raise HTTPException(
            400, "This verification link is invalid, expired, or already used."
        )
    needs_approval = candidate["role"] == "NGO"
    user = await request.app.state.db.users.find_one_and_update(
        query,
        {
            "$set": {
                "email_verified": True,
                "status": "pending_approval" if needs_approval else "active",
                "updated_at": now(),
            },
            "$unset": {"verification_hash": "", "verification_expires_at": ""},
        },
        return_document=True,
    )
    if not user:
        raise HTTPException(
            400, "This verification link is invalid, expired, or already used."
        )
    await audit(request, "email_verified", user["_id"])
    return {
        "message": "Your email is verified. An administrator must approve your NGO account before you can sign in."
        if needs_approval
        else "Your email is verified. You can now sign in.",
        "requires_approval": needs_approval,
    }


@router.post("/resend-verification", status_code=202)
async def resend(body: EmailInput, request: Request):
    await public_limit(request, "resend", body.email)
    user = await request.app.state.db.users.find_one(
        {"email": str(body.email).casefold(), "status": "pending_verification"}
    )
    if user:
        await email_challenge(request, user, "verify")
    return {"message": GENERIC_EMAIL}


@router.post("/login")
async def login(body: Login, request: Request, response: Response):
    await public_limit(request, "login", body.email)
    db, settings = request.app.state.db, request.app.state.settings
    user = await db.users.find_one({"email": str(body.email).casefold()})
    valid = await password_matches(
        body.password, user["password_hash"] if user else DUMMY_HASH
    )
    if not valid or not user:
        raise HTTPException(401, "Email or password is incorrect.")
    if not user["email_verified"]:
        raise HTTPException(403, "Verify your email before signing in.")
    if user["status"] == "pending_approval":
        raise HTTPException(403, "Your NGO account is awaiting administrator approval.")
    if user["status"] != "active":
        raise HTTPException(
            403, "This account is suspended. Contact your administrator."
        )
    session_id, csrf = str(uuid4()), secrets.token_urlsafe(32)
    timestamp = now()
    expiry = timestamp + timedelta(hours=settings.session_hours)
    await db.sessions.insert_one(
        {
            "_id": session_id,
            "user_id": user["_id"],
            "csrf_hash": digest(csrf),
            "expires_at": expiry,
        }
    )
    token = jwt.encode(
        {
            "sub": user["_id"],
            "jti": session_id,
            "ver": user["auth_version"],
            "iat": timestamp,
            "exp": expiry,
            "iss": "rahma-api",
            "aud": "rahma-web",
        },
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )
    options = {
        "secure": settings.cookie_secure,
        "samesite": "lax",
        "path": "/",
        "max_age": settings.session_hours * 3600,
    }
    response.set_cookie(SESSION_COOKIE, token, httponly=True, **options)
    response.set_cookie(CSRF_COOKIE, csrf, httponly=False, **options)
    await audit(request, "signed_in", user["_id"])
    return {"user": public_user(user), "expires_at": expiry}


@router.get("/me")
async def me(user=Depends(current_user)):
    return {"user": public_user(user)}


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, user=Depends(current_user)):
    await request.app.state.db.sessions.delete_one({"_id": request.state.session_id})
    for cookie in (SESSION_COOKIE, CSRF_COOKIE):
        response.delete_cookie(
            cookie,
            path="/",
            secure=request.app.state.settings.cookie_secure,
            samesite="lax",
        )
    await audit(request, "signed_out", user["_id"])


@router.post("/forgot-password", status_code=202)
async def forgot(body: EmailInput, request: Request):
    await public_limit(request, "forgot", body.email)
    user = await request.app.state.db.users.find_one(
        {"email": str(body.email).casefold(), "email_verified": True}
    )
    if user:
        await email_challenge(request, user, "reset")
    return {"message": GENERIC_EMAIL}


@router.post("/reset-password")
async def reset(body: ResetPassword, request: Request):
    await public_limit(request, "reset")
    encoded = await hash_password(body.password)
    user = await request.app.state.db.users.find_one_and_update(
        {
            "reset_hash": digest(body.token),
            "reset_expires_at": {"$gt": now()},
        },
        {
            "$set": {"password_hash": encoded, "updated_at": now()},
            "$inc": {"auth_version": 1},
            "$unset": {"reset_hash": "", "reset_expires_at": ""},
        },
        return_document=True,
    )
    if not user:
        raise HTTPException(
            400, "This reset link is invalid, expired, or already used."
        )
    await request.app.state.db.sessions.delete_many({"user_id": user["_id"]})
    await audit(request, "password_reset", user["_id"])
    return {"message": "Password updated. Sign in with your new password."}


@router.patch("/profile")
async def profile(body: Profile, request: Request, user=Depends(current_user)):
    updated = await request.app.state.db.users.find_one_and_update(
        {"_id": user["_id"]},
        {
            "$set": body.model_dump() | {"updated_at": now()},
        },
        return_document=True,
    )
    return {"user": public_user(updated)}


@router.post("/change-password")
async def change_password(
    body: ChangePassword, request: Request, user=Depends(current_user)
):
    await public_limit(request, "change-password")
    if not await password_matches(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Your current password is incorrect.")
    result = await request.app.state.db.users.update_one(
        {"_id": user["_id"], "auth_version": user["auth_version"]},
        {
            "$set": {
                "password_hash": await hash_password(body.password),
                "updated_at": now(),
            },
            "$inc": {"auth_version": 1},
            "$unset": {"reset_hash": "", "reset_expires_at": ""},
        },
    )
    if not result.modified_count:
        raise HTTPException(409, "Your account changed. Please sign in and try again.")
    await request.app.state.db.sessions.delete_many({"user_id": user["_id"]})
    await audit(request, "password_changed", user["_id"])
    return {"message": "Password changed. Sign in again on your devices."}
