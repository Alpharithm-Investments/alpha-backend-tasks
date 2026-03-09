from datetime import datetime
from typing import List, Optional
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Integer, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
import uuid

from app.db.session import Base


class Briefing(Base):
    __tablename__ = "briefings"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    sector: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    analyst_name: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    generated: Mapped[bool] = mapped_column(Boolean, default=False)
    generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow
    )
    
    # Relationships
    points: Mapped[List["BriefingPoint"]] = relationship(
        "BriefingPoint", 
        back_populates="briefing", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    metrics: Mapped[List["BriefingMetric"]] = relationship(
        "BriefingMetric", 
        back_populates="briefing", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    @property
    def key_points(self) -> List["BriefingPoint"]:
        return [p for p in self.points if p.point_type == "key_point"]
    
    @property
    def risks(self) -> List["BriefingPoint"]:
        return [p for p in self.points if p.point_type == "risk"]


class BriefingPoint(Base):
    __tablename__ = "briefing_points"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    briefing_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("briefings.id", ondelete="CASCADE"), 
        nullable=False
    )
    point_type: Mapped[str] = mapped_column(
        String(20), 
        CheckConstraint("point_type IN ('key_point', 'risk')"),
        nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    
    briefing: Mapped["Briefing"] = relationship("Briefing", back_populates="points")


class BriefingMetric(Base):
    __tablename__ = "briefing_metrics"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    briefing_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("briefings.id", ondelete="CASCADE"), 
        nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    
    briefing: Mapped["Briefing"] = relationship("Briefing", back_populates="metrics")
    
    __table_args__ = (
        # Unique constraint to ensure metric names are unique within a briefing
        {"sqlite_autoincrement": True},
    )