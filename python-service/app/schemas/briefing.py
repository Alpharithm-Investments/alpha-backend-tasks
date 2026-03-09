from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


class MetricInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    value: str = Field(..., min_length=1, max_length=100)


class BriefingCreate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255, alias="companyName")
    ticker: str = Field(..., min_length=1, max_length=20, alias="ticker")
    sector: Optional[str] = Field(None, max_length=100)
    analyst_name: str = Field(..., min_length=1, max_length=255, alias="analystName")
    summary: str = Field(..., min_length=1)
    recommendation: str = Field(..., min_length=1)
    key_points: List[str] = Field(..., min_length=2, alias="keyPoints")
    risks: List[str] = Field(..., min_length=1)
    metrics: Optional[List[MetricInput]] = Field(default=None)
    
    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        return v.upper().strip()
    
    @field_validator("key_points")
    @classmethod
    def validate_key_points(cls, v: List[str]) -> List[str]:
        if len(v) < 2:
            raise ValueError("At least 2 key points are required")
        # Strip and validate each point
        cleaned = [p.strip() for p in v if p.strip()]
        if len(cleaned) < 2:
            raise ValueError("At least 2 non-empty key points are required")
        return cleaned
    
    @field_validator("risks")
    @classmethod
    def validate_risks(cls, v: List[str]) -> List[str]:
        if len(v) < 1:
            raise ValueError("At least 1 risk is required")
        cleaned = [r.strip() for r in v if r.strip()]
        if len(cleaned) < 1:
            raise ValueError("At least 1 non-empty risk is required")
        return cleaned
    
    @field_validator("metrics")
    @classmethod
    def validate_unique_metric_names(cls, v: Optional[List[MetricInput]]) -> Optional[List[MetricInput]]:
        if v is None:
            return v
        names = [m.name.lower().strip() for m in v]
        if len(names) != len(set(names)):
            raise ValueError("Metric names must be unique within the same briefing")
        return v
    
    model_config = ConfigDict(populate_by_name=True)


class MetricResponse(BaseModel):
    name: str
    value: str
    
    model_config = ConfigDict(from_attributes=True)


class BriefingPointResponse(BaseModel):
    id: str
    point_type: str
    content: str
    display_order: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class BriefingResponse(BaseModel):
    id: str
    company_name: str
    ticker: str
    sector: Optional[str]
    analyst_name: str
    summary: str
    recommendation: str
    key_points: List[BriefingPointResponse]
    risks: List[BriefingPointResponse]
    metrics: List[MetricResponse]
    generated: bool
    generated_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ReportViewModel(BaseModel):
    """View model for HTML report rendering"""
    report_title: str
    company_name: str
    ticker: str
    sector: Optional[str]
    analyst_name: str
    generated_date: str
    generated_timestamp: str
    summary: str
    recommendation: str
    key_points: List[str]
    risks: List[str]
    metrics: List[MetricResponse]
    has_metrics: bool