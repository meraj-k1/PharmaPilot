from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions.handlers import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware.request_id import RequestIDMiddleware
from app.db.session import engine
from app.integrations.mcp.gateway import MCPAuthenticationGateway
from app.integrations.mcp.server import mcp
from app.integrations.mcp.auth_adapter import (
    verify_existing_pharmacy_access,
)
from app.integrations.mcp.security import (
    configure_mcp_authenticator,
)

settings = get_settings()

configure_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_mcp_authenticator(
        verify_existing_pharmacy_access
    )

    logger.info("PharmaPilot starting")

    try:
        async with mcp.session_manager.run():
            yield
    finally:
        await engine.dispose()
        logger.info("PharmaPilot shutting down")


mcp_http_app = mcp.streamable_http_app()

secured_mcp_app = MCPAuthenticationGateway(
    mcp_http_app
)

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description="AI-powered pharmacy operations platform",
        version="1.1.0",
        debug=settings.APP_DEBUG,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=[
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Request-ID",
            "X-Pharmacy-ID",
        ],
    )

    app.add_middleware(RequestIDMiddleware)

    register_exception_handlers(app)

    app.include_router(
        api_router,
        prefix=settings.API_V1_PREFIX,
    )

    app.mount("/mcp", secured_mcp_app)

    return app




app = create_app()

