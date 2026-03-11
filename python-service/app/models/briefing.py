from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Boolean, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base


class Briefing(Base):
    __tablename__ = "briefings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(255), nullable=True)
    analyst_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str] = mapped_column(String, nullable=False)
    recommendation: Mapped[str] = mapped_column(String, nullable=False)
    is_generated: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        onupdate=func.now(),
    )

    points: Mapped[list["BriefingPoint"]] = relationship(
        back_populates="briefing",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    risks: Mapped[list["BriefingRisk"]] = relationship(
        back_populates="briefing",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    metrics: Mapped[list["BriefingMetric"]] = relationship(
        back_populates="briefing",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @validates("ticker")
    def _normalize_ticker(self, key: str, value: str) -> str:  # noqa: ARG002
        if value is None:
            return value
        return value.upper()


class BriefingPoint(Base):
    __tablename__ = "briefing_points"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(
        ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    point_text: Mapped[str] = mapped_column(String, nullable=False)

    briefing: Mapped["Briefing"] = relationship(back_populates="points")


class BriefingRisk(Base):
    __tablename__ = "briefing_risks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(
        ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    risk_text: Mapped[str] = mapped_column(String, nullable=False)

    briefing: Mapped["Briefing"] = relationship(back_populates="risks")


class BriefingMetric(Base):
    __tablename__ = "briefing_metrics"
    __table_args__ = (
        UniqueConstraint(
            "briefing_id",
            "name",
            name="uq_briefing_metrics_briefing_id_name",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(
        ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)

    briefing: Mapped["Briefing"] = relationship(back_populates="metrics")

