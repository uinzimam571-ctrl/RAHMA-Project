import httpx
import pytest
from app.config import Settings
from app.main import create_app


@pytest.mark.parametrize("origins", ["*", ["*"]])
async def test_wildcard_supports_cookie_requests_from_any_origin(origins):
    settings = Settings(
        jwt_secret="test-only-secret-with-at-least-32-characters",
        allowed_origins=origins,
    )
    app = create_app(settings)
    origin = "http://localhost:4321"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        preflight = await client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert preflight.status_code == 200
        assert preflight.headers["access-control-allow-origin"] == origin
        assert preflight.headers["access-control-allow-credentials"] == "true"
        response = await client.post(
            "/api/v1/auth/login", json={}, headers={"Origin": origin}
        )
        assert response.status_code == 422
        assert response.headers["access-control-allow-origin"] == origin
        assert response.headers["access-control-allow-credentials"] == "true"


def test_specific_allowlist_still_limits_origins():
    settings = Settings(
        jwt_secret="test-only-secret-with-at-least-32-characters",
        allowed_origins=["http://localhost:5173"],
    )
    assert settings.allows_origin("http://localhost:5173")
    assert not settings.allows_origin("http://other.example")
