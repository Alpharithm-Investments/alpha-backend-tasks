from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from jinja2 import Environment, FileSystemLoader, select_autoescape

if TYPE_CHECKING:
    from app.models.briefing import Briefing

_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"


@dataclass
class MetricViewModel:
    label: str
    value: str


@dataclass
class BriefingViewModel:
    report_title: str
    company_name: str
    ticker: str
    sector: str
    analyst_name: str
    summary: str
    recommendation: str
    key_points: list[str]
    risks: list[str]
    metrics: list[MetricViewModel]
    generated_at_display: str
    generated_at_iso: str


class BriefingReportFormatter:
    """Transforms stored Briefing records into a view model and renders an HTML report."""

    def __init__(self) -> None:
        self._env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(
                enabled_extensions=("html", "xml"), default_for_string=True
            ),
        )

    def build_view_model(self, briefing: "Briefing") -> BriefingViewModel:
        now = datetime.now(timezone.utc)

        key_points = sorted(
            [p for p in briefing.points if p.point_type == "key"],
            key=lambda p: p.display_order,
        )
        risks = sorted(
            [p for p in briefing.points if p.point_type == "risk"],
            key=lambda p: p.display_order,
        )
        metrics = [
            MetricViewModel(label=self._normalize_label(m.name), value=m.value)
            for m in briefing.metrics
        ]

        return BriefingViewModel(
            report_title=f"{briefing.company_name} ({briefing.ticker}) — Analyst Briefing",
            company_name=briefing.company_name,
            ticker=briefing.ticker,
            sector=briefing.sector,
            analyst_name=briefing.analyst_name,
            summary=briefing.summary,
            recommendation=briefing.recommendation,
            key_points=[p.content for p in key_points],
            risks=[r.content for r in risks],
            metrics=metrics,
            generated_at_display=now.strftime("%B %d, %Y at %H:%M UTC"),
            generated_at_iso=now.isoformat(),
        )

    def render_report(self, view_model: BriefingViewModel) -> str:
        template = self._env.get_template("briefing_report.html")
        return template.render(report=view_model)

    @staticmethod
    def _normalize_label(name: str) -> str:
        """Title-case metric labels for consistent display."""
        return name.strip().title()
