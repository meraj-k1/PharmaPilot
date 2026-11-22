
import asyncio
import logging
import os
import sys

from app.integrations.mcp.auth_adapter import (
    verify_existing_pharmacy_access,
)
from app.integrations.mcp.context import (
    enable_stdio_mode,
    reset_stdio_mode,
)
from app.integrations.mcp.server import mcp


logger = logging.getLogger(__name__)


async def run_stdio_server() -> None:
    access_token = os.environ.get(
        "PHARMAPILOT_MCP_ACCESS_TOKEN",
        "",
    ).strip()

    pharmacy_id = os.environ.get(
        "PHARMAPILOT_MCP_PHARMACY_ID",
        "",
    ).strip()

    if not access_token or not pharmacy_id:
        raise PermissionError(
            "MCP stdio credentials are missing."
        )

    # Validate credentials before launching the server.
    # Individual tools will revalidate on every call.
    await verify_existing_pharmacy_access(
        access_token,
        pharmacy_id,
    )

    mode_token = enable_stdio_mode()

    try:
        logger.info("PharmaPilot MCP stdio starting")
        await mcp.run_stdio_async()
    finally:
        reset_stdio_mode(mode_token)
        logger.info("PharmaPilot MCP stdio stopping")


def main() -> None:
    # stdout must remain available exclusively
    # for the MCP JSON-RPC protocol.
    logging.basicConfig(
        level=logging.INFO,
        stream=sys.stderr,
    )

    try:
        asyncio.run(run_stdio_server())
    except (PermissionError, RuntimeError):
        logger.exception(
            "PharmaPilot MCP stdio startup rejected"
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
