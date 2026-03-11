from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.briefing import Briefing, BriefingMetric, BriefingPoint
from app.schemas.briefing import BriefingCreate
from app.services.report_formatter import BriefingReportFormatter


def create_briefing(db: Session, payload: BriefingCreate) -> Briefing:
    briefing = Briefing(
        company_name=payload.companyName.strip(),
        ticker=payload.ticker,
        sector=payload.sector.strip(),
        analyst_name=payload.analystName.strip(),
        summary=payload.summary.strip(),
        recommendation=payload.recommendation.strip(),
    )

    for idx, content in enumerate(payload.keyPoints):
        briefing.points.append(
            BriefingPoint(point_type="key", content=content, display_order=idx)
        )

    for idx, content in enumerate(payload.risks):
        briefing.points.append(
            BriefingPoint(point_type="risk", content=content, display_order=idx)
        )

    for metric in payload.metrics:
        briefing.metrics.append(
            BriefingMetric(name=metric.name.strip(), value=metric.value.strip())
        )

    db.add(briefing)
    db.commit()
    db.refresh(briefing)
    return _load_briefing(db, briefing.id)  


def get_briefing(db: Session, briefing_id: int) -> Briefing | None:
    return _load_briefing(db, briefing_id)


def generate_briefing(db: Session, briefing_id: int) -> Briefing | None:
    briefing = _load_briefing(db, briefing_id)
    if briefing is None:
        return None

    formatter = BriefingReportFormatter()
    view_model = formatter.build_view_model(briefing)
    rendered_html = formatter.render_report(view_model)

    briefing.rendered_html = rendered_html
    briefing.is_generated = True
    briefing.generated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(briefing)
    return briefing


def get_briefing_html(db: Session, briefing_id: int) -> str | None:
    briefing = _load_briefing(db, briefing_id)
    if briefing is None or not briefing.is_generated:
        return None
    return briefing.rendered_html


def _load_briefing(db: Session, briefing_id: int) -> Briefing | None:
    query = (
        select(Briefing)
        .options(
            selectinload(Briefing.points),
            selectinload(Briefing.metrics),
        )
        .where(Briefing.id == briefing_id)
    )
    return db.scalar(query)
