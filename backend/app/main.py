import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError
from starlette.exceptions import HTTPException

from app import admin, auth
from app.config import get_settings
from app.database import connect, initialize

logger = logging.getLogger("rahma")


def create_app(settings=None):
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app):
        client = connect(settings)
        app.state.db = client[settings.mongodb_database]
        await initialize(app.state.db)
        try:
            yield
        finally:
            await client.close()

    app = FastAPI(
        title="RAHMA Authentication API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.environment != "production" else None,
    )
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[]
        if "*" in settings.allowed_origins
        else settings.allowed_origins,
        allow_origin_regex=".*" if "*" in settings.allowed_origins else None,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )

    @app.middleware("http")
    async def policies(request: Request, call_next):
        request.state.request_id = str(uuid4())
        try:
            content_length = int(request.headers.get("content-length", "0"))
        except ValueError:
            content_length = -1
        if request.method not in {
            "GET",
            "HEAD",
            "OPTIONS",
        } and not settings.allows_origin(request.headers.get("origin")):
            response = JSONResponse(
                {"message": "Request origin is not allowed."}, status_code=403
            )
        elif content_length < 0:
            response = JSONResponse(
                {"message": "Invalid request length."}, status_code=400
            )
        elif content_length > 65536:
            response = JSONResponse(
                {"message": "Request is too large."}, status_code=413
            )
        else:
            response = await call_next(request)
        response.headers.update(
            {
                "X-Request-ID": request.state.request_id,
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
                "Referrer-Policy": "no-referrer",
                "X-Frame-Options": "DENY",
            }
        )
        if settings.cookie_secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        return JSONResponse(
            {"message": error.detail, "request_id": request.state.request_id},
            status_code=error.status_code,
            headers=error.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        # Pydantic's raw errors contain submitted passwords; never return those inputs.
        errors = [
            {"field": ".".join(map(str, item["loc"][1:])), "message": item["msg"]}
            for item in error.errors()
        ]
        return JSONResponse(
            {
                "message": "Please check the highlighted fields.",
                "errors": errors,
                "request_id": request.state.request_id,
            },
            status_code=422,
        )

    @app.exception_handler(PyMongoError)
    async def database_error(request, error):
        logger.error(
            "Database operation failed request_id=%s type=%s",
            request.state.request_id,
            type(error).__name__,
        )
        return JSONResponse(
            {
                "message": "The service is temporarily unavailable. Please try again.",
                "request_id": request.state.request_id,
            },
            status_code=503,
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request, error):
        logger.error(
            "Unhandled API failure request_id=%s type=%s",
            request.state.request_id,
            type(error).__name__,
        )
        return JSONResponse(
            {
                "message": "Something went wrong. Please try again.",
                "request_id": request.state.request_id,
            },
            status_code=500,
        )

    @app.get("/api/v1/health", tags=["Operations"])
    async def health(request: Request):
        await request.app.state.db.command("ping")
        return {"status": "ready"}

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(admin.router, prefix="/api/v1")
    return app
