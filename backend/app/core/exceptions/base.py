from fastapi import status


class AppException(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        error_code: str = "APPLICATION_ERROR",
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(
            message,
            status.HTTP_404_NOT_FOUND,
            "NOT_FOUND",
        )


class ConflictException(AppException):
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(
            message,
            status.HTTP_409_CONFLICT,
            "CONFLICT",
        )


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(
            message,
            status.HTTP_401_UNAUTHORIZED,
            "UNAUTHORIZED",
        )


class ForbiddenException(AppException):
    def __init__(self, message: str = "Access forbidden"):
        super().__init__(
            message,
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
        )
