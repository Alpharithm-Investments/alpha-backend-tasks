from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Briefing(Base):
    __tablename__ = "briefings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    ticker: Mapped[str] = mapped_column(String(10), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    key_points: Mapped[list["BriefingKeyPoint"]] = relationship(
        "BriefingKeyPoint", back_populates="briefing", cascade="all, delete-orphan"
    )
    risks: Mapped[list["BriefingRisk"]] = relationship(
        "BriefingRisk", back_populates="briefing", cascade="all, delete-orphan"
    )
    metrics: Mapped[list["BriefingMetric"]] = relationship(
        "BriefingMetric", back_populates="briefing", cascade="all, delete-orphan"
    )


class BriefingKeyPoint(Base):
    __tablename__ = "briefing_key_points"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(
        ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    briefing: Mapped[Briefing] = relationship("Briefing", back_populates="key_points")


class BriefingRisk(Base):
    __tablename__ = "briefing_risks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(
        ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    briefing: Mapped[Briefing] = relationship("Briefing", back_populates="risks")


class BriefingMetric(Base):
    __tablename__ = "briefing_metrics"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(
        ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    briefing: Mapped[Briefing] = relationship("Briefing", back_populates="metrics")
