"""Stock transfer domain helpers."""


def is_draft_status(status_value: str) -> bool:
    return status_value == "draft"
