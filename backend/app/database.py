from datetime import UTC, datetime

from pymongo import ASCENDING, AsyncMongoClient


def now():
    return datetime.now(UTC)


def connect(settings):
    return AsyncMongoClient(
        settings.mongodb_uri.get_secret_value(),
        tz_aware=True,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
    )


async def initialize(db):
    await db.command("ping")
    await db.users.create_index("email", unique=True)
    await db.users.create_index([("created_at", -1), ("_id", ASCENDING)])
    for field in ("verification_hash", "reset_hash"):
        await db.users.create_index(field, unique=True, sparse=True)
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.sessions.create_index("user_id")
    await db.rate_limits.create_index("expires_at", expireAfterSeconds=0)
