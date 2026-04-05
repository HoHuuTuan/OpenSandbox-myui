from __future__ import annotations

from sqlalchemy import Column, DateTime, Integer, String, Text, func

from opensandbox_server.db import Base


class SandboxNote(Base):
    __tablename__ = "sandbox_notes"

    id = Column(Integer, primary_key=True, index=True)
    sandbox_id = Column(String(255), nullable=False, index=True, unique=True)
    note = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SandboxTag(Base):
    __tablename__ = "sandbox_tags"

    id = Column(Integer, primary_key=True, index=True)
    sandbox_id = Column(String(255), nullable=False, index=True)
    tag = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SandboxActionLog(Base):
    __tablename__ = "sandbox_action_logs"

    id = Column(Integer, primary_key=True, index=True)
    sandbox_id = Column(String(255), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)
    request_payload = Column(Text, nullable=True)
    response_payload = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)