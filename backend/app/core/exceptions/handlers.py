import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.core.exceptions.base import AppException
from app.core.exceptions.schemas import ErrorDetail, ErrorResponse

logger = logging.getLogger(__name__)


def error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorDetail(
            code=code,
            message=message,
        ),
        request_id=getattr(request.state, "request_id", None),
    )

    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(),
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def handle_app_exception(
        request: Request,
        exc: AppException,
    ):
        return error_response(
            request,
            exc.status_code,
            exc.error_code,
            exc.message,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(
        request: Request,
        exc: RequestValidationError,
    ):
        return error_response(
            request,
            422,
            "VALIDATION_ERROR",
            "Invalid request data.",
        )

    @app.exception_handler(HTTPException)
    async def handle_http(
        request: Request,
        exc: HTTPException,
    ):
        return error_response(
            request,
            exc.status_code,
            "HTTP_ERROR",
            str(exc.detail),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(
        request: Request,
        exc: Exception,
    ):
        logger.exception("Unhandled application exception")

        return error_response(
            request,
            500,
            "INTERNAL_SERVER_ERROR",
            "An unexpected error occurred.",
        )
