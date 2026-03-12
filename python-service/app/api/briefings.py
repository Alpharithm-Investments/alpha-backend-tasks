from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.briefing import (
    BriefingCreate,
    BriefingRead,
)
from app.services.briefing_service import create_briefing, get_briefing
from app.services.report_formatter import ReportFormatter

router = APIRouter(prefix="/briefings", tags=["briefings"])
_formatter = ReportFormatter()


@router.post("", response_model=BriefingRead, status_code=status.HTTP_201_CREATED)
def post_briefing(
    payload: BriefingCreate, db: Annotated[Session, Depends(get_db)]
) -> BriefingRead:
    briefing = create_briefing(db, payload)
    return BriefingRead.model_validate(briefing)


@router.get("/{briefing_id}", response_model=BriefingRead)
def get_briefing_endpoint(
    briefing_id: int, db: Annotated[Session, Depends(get_db)]
) -> BriefingRead:
    briefing = get_briefing(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return BriefingRead.model_validate(briefing)


@router.post("/{briefing_id}/generate")
def generate_briefing(
    briefing_id: int, db: Annotated[Session, Depends(get_db)]
):
    briefing = get_briefing(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    # convert to view model; actual formatting implemented later
    view = _formatter.briefing_to_view_model(briefing)  # placeholder method might not exist yet
    return view


@router.get("/{briefing_id}/html", response_class=HTMLResponse)
def briefing_html(
    briefing_id: int, db: Annotated[Session, Depends(get_db)]
) -> HTMLResponse:
    briefing = get_briefing(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    view = _formatter.briefing_to_view_model(briefing)
    # render template using jinja2
    html_body = _formatter.render_briefing(view)
    return HTMLResponse(content=html_body)
