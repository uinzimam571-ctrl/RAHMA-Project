from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.auth import audit
from app.database import now
from app.schemas import Role, UserAccess
from app.security import administrator, public_user

router = APIRouter(prefix="/admin", tags=["Account administration"])


@router.get("/users")
async def users(
    request: Request,
    page: int = Query(1, ge=1, le=10000),
    page_size: int = Query(10, ge=1, le=100),
    search: str = Query("", max_length=100),
    role: Role | None = None,
    status: Literal["active", "suspended", "pending_verification", "pending_approval"]
    | None = None,
    actor=Depends(administrator),
):
    import re

    query = {}
    if search.strip():
        expression = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [{"name": expression}, {"email": expression}]
    if role:
        query["role"] = role.value
    if status:
        query["status"] = status
    collection = request.app.state.db.users
    rows = (
        await collection.find(query)
        .sort([("created_at", -1), ("_id", 1)])
        .skip((page - 1) * page_size)
        .limit(page_size)
        .to_list()
    )
    return {
        "items": [public_user(row) for row in rows],
        "total": await collection.count_documents(query),
        "page": page,
        "page_size": page_size,
    }


@router.patch("/users/{user_id}/access")
async def access(
    user_id: str, body: UserAccess, request: Request, actor=Depends(administrator)
):
    db = request.app.state.db
    target = await db.users.find_one({"_id": user_id})
    if not target:
        raise HTTPException(404, "Account not found.")
    # Existing administrators cannot be suspended/demoted through the web console.
    # This avoids last-admin races without requiring MongoDB multi-document transactions.
    if target["role"] == "Admin":
        raise HTTPException(
            409,
            "Existing administrator access must be changed through the operator process.",
        )
    if not target["email_verified"]:
        raise HTTPException(
            409, "This user must verify their own email before access is activated."
        )
    update = {
        "role": body.role.value,
        "status": body.status,
        "organization_id": body.organization_id
        if body.role in {Role.NGO, Role.VOLUNTEER}
        else None,
        "updated_at": now(),
    }
    updated = await db.users.find_one_and_update(
        {
            "_id": user_id,
            "auth_version": target["auth_version"],
            "role": {"$ne": "Admin"},
        },
        {"$set": update, "$inc": {"auth_version": 1}},
        return_document=True,
    )
    if not updated:
        raise HTTPException(409, "This account changed. Refresh and try again.")
    await db.sessions.delete_many({"user_id": user_id})
    await audit(request, f"access_updated:{user_id}", actor["_id"])
    return {"user": public_user(updated)}
