from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def _build_error(
    *,
    request: Request,
    status_code: int,
    code: str,
    message: str,
    details=None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message,
            "request_id": request_id,
            "details": details,
        },
        headers={"X-Request-ID": request_id},
    )


def register_exception_handlers(app: FastAPI) -> None:
    if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT"):
        unprocessable = status.HTTP_422_UNPROCESSABLE_CONTENT
    else:
        unprocessable = status.HTTP_422_UNPROCESSABLE_ENTITY

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        code_map = {
            status.HTTP_401_UNAUTHORIZED: "unauthenticated",
            status.HTTP_403_FORBIDDEN: "unauthorized",
            status.HTTP_404_NOT_FOUND: "not_found",
            status.HTTP_409_CONFLICT: "conflict",
            unprocessable: "validation_error",
        }
        code = code_map.get(exc.status_code, "http_error")
        return _build_error(
            request=request,
            status_code=exc.status_code,
            code=code,
            message=str(exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return _build_error(
            request=request,
            status_code=unprocessable,
            code="validation_error",
            message="Request validation failed",
            details=exc.errors(),
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        return _build_error(
            request=request,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="internal_error",
            message="Internal server error",
            details=str(exc),
        )
