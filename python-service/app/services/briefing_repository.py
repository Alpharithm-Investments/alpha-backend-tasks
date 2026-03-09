from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.briefing import Briefing, BriefingPoint, BriefingMetric


class BriefingRepository:
    """Repository layer for briefing database operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create(
        self, 
        company_name: str,
        ticker: str,
        sector: Optional[str],
        analyst_name: str,
        summary: str,
        recommendation: str,
        points: list[BriefingPoint],
        metrics: list[BriefingMetric]
    ) -> Briefing:
        """Create a new briefing with all related data"""
        briefing = Briefing(
            company_name=company_name,
            ticker=ticker,
            sector=sector,
            analyst_name=analyst_name,
            summary=summary,
            recommendation=recommendation
        )
        
        # Associate points and metrics
        for point in points:
            point.briefing = briefing
        for metric in metrics:
            metric.briefing = briefing
        
        self.db.add(briefing)
        self.db.commit()
        self.db.refresh(briefing)
        return briefing
    
    def get_by_id(self, briefing_id: str) -> Optional[Briefing]:
        """Retrieve a briefing by ID with all relationships loaded"""
        stmt = select(Briefing).where(Briefing.id == briefing_id)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    def mark_as_generated(self, briefing: Briefing) -> Briefing:
        """Mark a briefing as generated with timestamp"""
        from datetime import datetime
        briefing.generated = True
        briefing.generated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(briefing)
        return briefing