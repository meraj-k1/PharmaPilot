import logging

from starlette.responses import JSONResponse

from app.integrations.mcp.context import (
    reset_identity,
    set_identity,
)
from app.integrations.mcp.security import (
    authenticate_mcp_request,
)

logger = logging.getLogger(__name__)


class MCPAuthenticationGateway:
    def __init__(self, app):
        self.app = app

    async def __call__(
        self,
        scope,
        receive,
        send,
    ):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }

        authorization = headers.get("authorization")
        pharmacy_header = headers.get("x-pharmacy-id")

        try:
            identity = await authenticate_mcp_request(
                authorization,
                pharmacy_header,
            )

        except PermissionError:
            response = JSONResponse(
                {
                    "error": {
                        "code": "MCP_UNAUTHORIZED",
                        "message": ("Authentication or pharmacy access failed."),
                    }
                },
                status_code=401,
                headers={
                    "WWW-Authenticate": "Bearer",
                    "Cache-Control": "no-store",
                },
            )
            await response(scope, receive, send)
            return

        except Exception:
            logger.exception("MCP authentication service failed")

            response = JSONResponse(
                {
                    "error": {
                        "code": "MCP_AUTH_UNAVAILABLE",
                        "message": ("Authentication is temporarily unavailable."),
                    }
                },
                status_code=503,
                headers={"Cache-Control": "no-store"},
            )
            await response(scope, receive, send)
            return

        token = set_identity(identity)

        try:
            await self.app(scope, receive, send)
        finally:
            reset_identity(token)
