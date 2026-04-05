from __future__ import annotations

import json
from typing import Any

from opensandbox_server.db import SessionLocal
from opensandbox_server.models.admin import SandboxActionLog


def write_action_log(
    sandbox_id: str,
    action: str,
    status: str,
    request_payload: Any = None,
    response_payload: Any = None,
) -> None:
    db = SessionLocal()
    try:
        row = SandboxActionLog(
            sandbox_id=sandbox_id,
            action=action,
            status=status,
            request_payload=json.dumps(request_payload, ensure_ascii=False, default=str) if request_payload is not None else None,
            response_payload=json.dumps(response_payload, ensure_ascii=False, default=str) if response_payload is not None else None,
        )
        db.add(row)
        db.commit()
    finally:
        db.close()