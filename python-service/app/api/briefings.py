from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.db.session import get_db
from app.schemas.briefing import (
    BriefingCreate, 
    BriefingResponse, 
    ReportViewModel,
    MetricResponse,
    BriefingPointResponse
)
from app.services.briefing_formatter import BriefingFormatter
from app.services.briefing_repository import BriefingRepository
from app.models.briefing import Briefing

# Jinja2 template setup
from fastapi.templating import Jinja2Templates
import os

templates = Jinja2Templates(directory="app/templates")

router = APIRouter(prefix="/briefings", tags=["briefings"])


def get_repository(db: Session = Depends(get_db)) -> BriefingRepository:
    return BriefingRepository(db)


@router.post("", response_model=BriefingResponse, status_code=201)
def create_briefing(
    data: BriefingCreate,
    repo: BriefingRepository = Depends(get_repository)
):
    """
    Create a new briefing report with all related data.
    Validates that at least 2 key points and 1 risk are provided,
    and that metric names are unique within the briefing.
    """
    # Transform input data to ORM objects
    formatter = BriefingFormatter()
    
    points = formatter.create_points_from_input(
        data.key_points, 
        data.risks
    )
    metrics = formatter.create_metrics_from_input(
        [m.model_dump() for m in data.metrics] if data.metrics else []
    )
    
    # Create briefing
    briefing = repo.create(
        company_name=data.company_name,
        ticker=data.ticker,
        sector=data.sector,
        analyst_name=data.analyst_name,
        summary=data.summary,
        recommendation=data.recommendation,
        points=points,
        metrics=metrics
    )
    
    return _briefing_to_response(briefing)


@router.get("/{briefing_id}", response_model=BriefingResponse)
def get_briefing(
    briefing_id: str,
    repo: BriefingRepository = Depends(get_repository)
):
    """
    Retrieve a single briefing by ID with all related data.
    """
    # Validate UUID format
    try:
        uuid.UUID(briefing_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid briefing ID format")
    
    briefing = repo.get_by_id(briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    
    return _briefing_to_response(briefing)


@router.post("/{briefing_id}/generate", response_model=BriefingResponse)
def generate_report(
    briefing_id: str,
    repo: BriefingRepository = Depends(get_repository)
):
    """
    Generate a report for an existing briefing.
    Marks the briefing as generated and returns updated briefing data.
    """
    try:
        uuid.UUID(briefing_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid briefing ID format")
    
    briefing = repo.get_by_id(briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    
    # Mark as generated
    briefing = repo.mark_as_generated(briefing)
    
    return _briefing_to_response(briefing)


@router.get("/{briefing_id}/html", response_class=HTMLResponse)
def get_briefing_html(
    briefing_id: str,
    repo: BriefingRepository = Depends(get_repository)
):
    """
    Retrieve the rendered HTML report for a briefing.
    Transforms data into a view model and renders using Jinja2 template.
    """
    try:
        uuid.UUID(briefing_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid briefing ID format")
    
    briefing = repo.get_by_id(briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    
    # Transform to view model
    formatter = BriefingFormatter()
    view_model = formatter.to_report_view_model(briefing)
    
    # Render template
    template = templates.get_template("briefing_report.html")
    html_content = template.render(**view_model.model_dump())
    
    return HTMLResponse(content=html_content, status_code=200)


def _briefing_to_response(briefing: Briefing) -> BriefingResponse:
    """Helper to convert ORM model to Pydantic response"""
    return BriefingResponse(
        id=str(briefing.id),
        company_name=briefing.company_name,
        ticker=briefing.ticker,
        sector=briefing.sector,
        analyst_name=briefing.analyst_name,
        summary=briefing.summary,
        recommendation=briefing.recommendation,
        key_points=[
            BriefingPointResponse(
                id=str(p.id),
                point_type=p.point_type,
                content=p.content,
                display_order=p.display_order,
                created_at=p.created_at
            )
            for p in briefing.points if p.point_type == "key_point"
        ],
        risks=[
            BriefingPointResponse(
                id=str(p.id),
                point_type=p.point_type,
                content=p.content,
                display_order=p.display_order,
                created_at=p.created_at
            )
            for p in briefing.points if p.point_type == "risk"
        ],
        metrics=[
            MetricResponse(name=m.name, value=m.value)
            for m in briefing.metrics
        ],
        generated=briefing.generated,
        generated_at=briefing.generated_at,
        created_at=briefing.created_at,
        updated_at=briefing.updated_at
    )