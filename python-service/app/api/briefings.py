from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.briefing import BriefingCreate, BriefingRead, GenerateResponse
from app.services.briefing_service import (
    create_briefing,
    generate_briefing,
    get_briefing,
    get_briefing_html,
)

router = APIRouter(prefix="/briefings", tags=["briefings"])


@router.post("", response_model=BriefingRead, status_code=status.HTTP_201_CREATED)
def create(payload: BriefingCreate, db: Annotated[Session, Depends(get_db)]) -> BriefingRead:
    briefing = create_briefing(db, payload)
    return BriefingRead.model_validate(briefing)


@router.get("/{briefing_id}", response_model=BriefingRead)
def retrieve(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> BriefingRead:
    briefing = get_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(status_code=404, detail="Briefing not found")
    return BriefingRead.model_validate(briefing)


@router.post("/{briefing_id}/generate", response_model=GenerateResponse)
def generate(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> GenerateResponse:
    briefing = generate_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(status_code=404, detail="Briefing not found")
    return GenerateResponse(
        id=briefing.id,
        is_generated=briefing.is_generated,
        generated_at=briefing.generated_at,
    )


@router.get("/{briefing_id}/html")
def get_html(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> Response:
    briefing = get_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(status_code=404, detail="Briefing not found")
    if not briefing.is_generated:
        raise HTTPException(
            status_code=409,
            detail="Report not yet generated. Call POST /briefings/{id}/generate first.",
        )
    return Response(content=briefing.rendered_html, media_type="text/html")