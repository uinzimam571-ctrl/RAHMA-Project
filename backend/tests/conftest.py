import os
from uuid import uuid4

import httpx
import pytest
from app.config import Settings
from app.main import create_app


@pytest.fixture
async def context(tmp_path):
    uri = os.environ.get("MONGODB_TEST_URI", "mongodb://127.0.0.1:27017")
    settings = Settings(
        environment="test",
        jwt_secret="test-only-rahma-signing-key-with-more-than-32-characters",
        mongodb_uri=uri,
        mongodb_database=f"rahma_test_{uuid4().hex}",
        cookie_secure=False,
        public_url="http://testserver",
        allowed_origins=["http://testserver"],
        mail_backend="file",
        email_directory=tmp_path,
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
            headers={"Origin": "http://testserver"},
        ) as client:
            yield app, client
        await app.state.db.client.drop_database(settings.mongodb_database)
