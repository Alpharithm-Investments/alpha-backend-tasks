from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from typing import Optional

from app.models.briefing import Briefing, BriefingKeyPoint, BriefingMetric, BriefingRisk
from app.schemas.briefing import BriefingCreate


def create_briefing(db: Session, payload: BriefingCreate) -> Briefing:
    # create main briefing record
    briefing = Briefing(
        company_name=payload.company_name.strip(),
        ticker=payload.ticker,
        summary=payload.summary.strip(),
        recommendation=payload.recommendation.strip(),
    )
    db.add(briefing)
    db.flush()  # obtain id for children

    # add key points
    for point in payload.key_points:
        db.add(
            BriefingKeyPoint(briefing_id=briefing.id, text=point.strip())
        )

    # add risks
    for risk in payload.risks:
        db.add(BriefingRisk(briefing_id=briefing.id, text=risk.strip()))

    # add metrics
    for m in payload.metrics:
        db.add(
            BriefingMetric(
                briefing_id=briefing.id,
                name=m.name.strip(),
                value=m.value.strip(),
            )
        )

    db.commit()
    db.refresh(briefing)
    return briefing


def get_briefing(db: Session, briefing_id: int) -> Optional[Briefing]:
    stmt = select(Briefing).where(Briefing.id == briefing_id)
    stmt = stmt.options(
        selectinload(Briefing.key_points),
        selectinload(Briefing.risks),
        selectinload(Briefing.metrics),
    )
    result = db.scalar(stmt)
    return result

