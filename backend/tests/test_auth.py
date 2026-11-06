import asyncio
import re
from datetime import timedelta
from email import policy
from email.parser import BytesParser

import pytest
from app.database import now
from app.security import require_owner_or_organization
from fastapi import HTTPException

PASSWORD = "Test-only long passphrase 2026!"
NEW_PASSWORD = "Another strong test passphrase!"


def latest_email(app, email, subject):
    messages = []
    for file in app.state.settings.email_directory.glob("*.txt"):
        message = BytesParser(policy=policy.default).parsebytes(file.read_bytes())
        if message["To"] == email and message["Subject"] == subject:
            messages.append((file.stat().st_mtime_ns, message))
    return max(messages, key=lambda item: item[0])[1].get_content()


async def register(
    app, client, email="household@example.com", role="Household", verified=True
):
    response = await client.post(
        "/api/v1/auth/register",
        json={"name": "Amina Khan", "email": email, "password": PASSWORD, "role": role},
    )
    assert response.status_code == 202, response.text
    user = await app.state.db.users.find_one({"email": email})
    message = latest_email(app, email, "Verify your RAHMA email")
    token = re.search(r"#token=([A-Za-z0-9_-]+)", message)[1]
    if verified:
        assert (
            await client.post("/api/v1/auth/verify", json={"token": token})
        ).status_code == 200
    return user, token


async def login(client, email="household@example.com", password=PASSWORD):
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"X-CSRF-Token": client.cookies.get("rahma_csrf")}


async def test_registration_verification_session_and_privacy(context):
    app, client = context
    user, token = await register(app, client, verified=False)
    assert (
        user["password_hash"].startswith("$argon2")
        and PASSWORD not in user["password_hash"]
    )
    assert (
        await client.post(
            "/api/v1/auth/login", json={"email": user["email"], "password": PASSWORD}
        )
    ).status_code == 403
    assert (
        await client.post("/api/v1/auth/verify", json={"token": token})
    ).status_code == 200
    assert (
        await client.post("/api/v1/auth/verify", json={"token": token})
    ).status_code == 400
    await login(client)
    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200 and me.json()["user"]["role"] == "Household"
    assert "password" not in me.text and "verification_hash" not in me.text
    assert me.headers["cache-control"] == "no-store"
    assert (await app.state.db.sessions.count_documents({"user_id": user["_id"]})) == 1


async def test_public_registration_cannot_create_privileged_roles(context):
    _, client = context
    for role in ("Admin",):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "name": "Attacker",
                "email": "user@example.com",
                "password": PASSWORD,
                "role": role,
            },
        )
        assert response.status_code == 422
        assert PASSWORD not in response.text


async def test_csrf_and_origin_are_enforced(context):
    app, client = context
    await register(app, client)
    headers = await login(client)
    profile = {"name": "Amina Updated", "phone": "+92 300 1234567", "district": "Dadu"}
    assert (await client.patch("/api/v1/auth/profile", json=profile)).status_code == 403
    assert (
        await client.patch(
            "/api/v1/auth/profile",
            json=profile,
            headers=headers | {"Origin": "https://evil.example"},
        )
    ).status_code == 403
    assert (
        await client.patch("/api/v1/auth/profile", json=profile, headers=headers)
    ).status_code == 200
    assert (
        await client.patch(
            "/api/v1/auth/profile", json=profile | {"role": "Admin"}, headers=headers
        )
    ).status_code == 422
    assert (await client.get("/api/v1/admin/users")).status_code == 403


async def test_logout_revokes_captured_jwt(context):
    app, client = context
    await register(app, client)
    headers = await login(client)
    captured = client.cookies.get("rahma_session")
    assert (
        await client.post("/api/v1/auth/logout", headers=headers)
    ).status_code == 204
    client.cookies.set("rahma_session", captured)
    assert (await client.get("/api/v1/auth/me")).status_code == 401


async def test_password_reset_is_single_use_and_revokes_existing_sessions(context):
    app, client = context
    await register(app, client)
    await login(client)
    known = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "household@example.com"}
    )
    unknown = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "missing@example.com"}
    )
    assert known.json() == unknown.json() and known.status_code == 202
    mail = latest_email(app, "household@example.com", "Reset your RAHMA password")
    token = re.search(r"#token=([A-Za-z0-9_-]+)", mail)[1]
    body = {"token": token, "password": NEW_PASSWORD}
    results = await asyncio.gather(
        client.post("/api/v1/auth/reset-password", json=body),
        client.post("/api/v1/auth/reset-password", json=body),
    )
    assert sorted(result.status_code for result in results) == [200, 400]
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "household@example.com", "password": PASSWORD},
        )
    ).status_code == 401
    await login(client, password=NEW_PASSWORD)


async def test_expired_verification_is_rejected(context):
    app, client = context
    user, token = await register(app, client, verified=False)
    await app.state.db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"verification_expires_at": now() - timedelta(seconds=1)}},
    )
    assert (
        await client.post("/api/v1/auth/verify", json={"token": token})
    ).status_code == 400


async def test_password_change_requires_current_password_and_revokes_session(context):
    app, client = context
    await register(app, client)
    headers = await login(client)
    route = "/api/v1/auth/change-password"
    assert (
        await client.post(
            route,
            headers=headers,
            json={"current_password": "incorrect", "password": NEW_PASSWORD},
        )
    ).status_code == 400
    assert (
        await client.post(
            route,
            headers=headers,
            json={"current_password": PASSWORD, "password": NEW_PASSWORD},
        )
    ).status_code == 200
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    await login(client, password=NEW_PASSWORD)


async def test_session_expiry_is_checked_before_ttl_cleanup(context):
    app, client = context
    user, _ = await register(app, client)
    await login(client)
    await app.state.db.sessions.update_many(
        {"user_id": user["_id"]}, {"$set": {"expires_at": now() - timedelta(seconds=1)}}
    )
    assert (await client.get("/api/v1/auth/me")).status_code == 401


async def test_admin_access_changes_and_suspension_revoke_sessions(context):
    app, client = context
    admin, _ = await register(app, client, email="admin@example.com")
    await app.state.db.users.update_one(
        {"_id": admin["_id"]}, {"$set": {"role": "Admin"}}
    )
    user, _ = await register(app, client)
    headers = await login(client, email="admin@example.com")
    listing = await client.get(
        "/api/v1/admin/users?search=Amina&role=Household&page_size=1"
    )
    assert listing.status_code == 200 and len(listing.json()["items"]) == 1
    assert "password_hash" not in listing.text
    path = f"/api/v1/admin/users/{user['_id']}/access"
    assert (
        await client.patch(
            path, headers=headers, json={"role": "NGO", "status": "active"}
        )
    ).status_code == 422
    assert (
        await client.patch(
            path,
            headers=headers,
            json={
                "role": "NGO",
                "status": "active",
                "organization_id": "ngo-approved-1",
            },
        )
    ).status_code == 200
    await login(client)
    assert (await client.get("/api/v1/auth/me")).json()["user"][
        "organization_id"
    ] == "ngo-approved-1"
    headers = await login(client, email="admin@example.com")
    assert (
        await client.patch(
            path,
            headers=headers,
            json={
                "role": "NGO",
                "status": "suspended",
                "organization_id": "ngo-approved-1",
            },
        )
    ).status_code == 200
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "household@example.com", "password": PASSWORD},
        )
    ).status_code == 403
    assert (
        await client.patch(
            f"/api/v1/admin/users/{admin['_id']}/access",
            headers=headers,
            json={"role": "Household", "status": "suspended"},
        )
    ).status_code == 409


async def test_login_rate_limit_is_shared_in_database(context):
    _, client = context
    for _ in range(5):
        assert (
            await client.post(
                "/api/v1/auth/login",
                json={"email": "nobody@example.com", "password": PASSWORD},
            )
        ).status_code == 401
    response = await client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "password": PASSWORD}
    )
    assert response.status_code == 429 and "retry-after" in response.headers


def test_ownership_and_organization_scope():
    user = {"_id": "u1", "role": "NGO", "organization_id": "org-1"}
    require_owner_or_organization(user, "u1")
    require_owner_or_organization(user, "other", "org-1")
    with pytest.raises(HTTPException):
        require_owner_or_organization(user, "other", "org-2")
    with pytest.raises(HTTPException):
        require_owner_or_organization(user | {"role": "Volunteer"}, "other", "org-1")


async def test_ngo_registration_needs_email_verification_and_admin_approval(context):
    app, client = context
    ngo, token = await register(
        app, client, email="ngo@example.com", role="NGO", verified=False
    )
    response = await client.post("/api/v1/auth/verify", json={"token": token})
    assert response.status_code == 200 and response.json()["requires_approval"] is True
    record = await app.state.db.users.find_one({"_id": ngo["_id"]})
    assert record["status"] == "pending_approval" and record["organization_id"] is None
    denied = await client.post(
        "/api/v1/auth/login", json={"email": "ngo@example.com", "password": PASSWORD}
    )
    assert denied.status_code == 403 and "approval" in denied.json()["message"]
    admin, _ = await register(app, client, email="admin@example.com")
    await app.state.db.users.update_one(
        {"_id": admin["_id"]}, {"$set": {"role": "Admin"}}
    )
    headers = await login(client, email="admin@example.com")
    listing = await client.get("/api/v1/admin/users?status=pending_approval")
    assert listing.status_code == 200 and listing.json()["total"] == 1
    approved = await client.patch(
        f"/api/v1/admin/users/{ngo['_id']}/access",
        headers=headers,
        json={"role": "NGO", "status": "active", "organization_id": "approved-ngo"},
    )
    assert approved.status_code == 200
    await login(client, email="ngo@example.com")
    me = (await client.get("/api/v1/auth/me")).json()["user"]
    assert me["role"] == "NGO" and me["organization_id"] == "approved-ngo"
