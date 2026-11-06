import argparse
import asyncio
import getpass
from uuid import uuid4

from app.config import get_settings
from app.database import connect, initialize, now
from app.security import hash_password


async def bootstrap(email, name):
    from pydantic import EmailStr, TypeAdapter

    email = str(TypeAdapter(EmailStr).validate_python(email)).casefold()
    password = getpass.getpass("Administrator password (at least 12 characters): ")
    if (
        len(password) < 12
        or len(password) > 128
        or password != getpass.getpass("Confirm password: ")
    ):
        raise ValueError("Passwords must match and be between 12 and 128 characters.")
    settings = get_settings()
    client = connect(settings)
    try:
        db = client[settings.mongodb_database]
        await initialize(db)
        if await db.users.find_one({"email": email}):
            raise ValueError(
                "Account exists. Use the existing administrator to manage access."
            )
        await db.users.insert_one(
            {
                "_id": str(uuid4()),
                "email": email,
                "name": name,
                "phone": "",
                "district": "",
                "role": "Admin",
                "status": "active",
                "email_verified": True,
                "organization_id": None,
                "auth_version": 1,
                "password_hash": await hash_password(password),
                "created_at": now(),
                "updated_at": now(),
            }
        )
        print("Administrator created. No default or shared password was installed.")
    finally:
        await client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Create a trusted RAHMA administrator from the operator terminal."
    )
    parser.add_argument("email")
    parser.add_argument("--name", required=True)
    args = parser.parse_args()
    asyncio.run(bootstrap(args.email, args.name))
