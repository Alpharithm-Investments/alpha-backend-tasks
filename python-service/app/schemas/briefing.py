from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field, root_validator, validator


class Metric(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=200)


class BriefingCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    ticker: str = Field(min_length=1, max_length=10)
    summary: str = Field(min_length=1)
    recommendation: str = Field(min_length=1, max_length=50)
    key_points: List[str] = Field(min_length=2)
    risks: List[str] = Field(min_length=1)
    metrics: List[Metric] = Field(default_factory=list)

    @validator("ticker")
    def normalize_ticker(cls, v: str) -> str:
        return v.strip().upper()

    from pydantic import model_validator

    @model_validator(mode="after")
    def check_metric_names_unique(cls, values):
        metrics = values.metrics or []
        names = [m.name for m in metrics]
        if len(names) != len(set(names)):
            raise ValueError("metric names must be unique within a briefing")
        return values


class BriefingKeyPointRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    text: str


class BriefingRiskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    text: str


class MetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    value: str


class BriefingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_name: str
    ticker: str
    summary: str
    recommendation: str
    created_at: datetime
    key_points: List[BriefingKeyPointRead]
    risks: List[BriefingRiskRead]
    metrics: List[MetricRead]
