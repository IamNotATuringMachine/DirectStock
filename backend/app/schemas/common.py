from pydantic import BaseModel


class ApiError(BaseModel):
    code: str
    message: str
    request_id: str
    details: dict | list | str | None = None
