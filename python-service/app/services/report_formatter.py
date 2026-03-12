from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.models.briefing import Briefing

_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"


class ReportFormatter:
    """Starter formatter utility for future report-generation work."""

    def __init__(self) -> None:
        self._env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(enabled_extensions=("html", "xml"), default_for_string=True),
        )

    def render_base(self, title: str, body: str) -> str:
        template = self._env.get_template("base.html")
        return template.render(title=title, body=body, generated_at=self.generated_timestamp())

    @staticmethod
    def generated_timestamp() -> str:
        return datetime.now(timezone.utc).isoformat()

    # --- briefing-specific helpers ---
    def briefing_to_view_model(self, briefing: Briefing) -> Dict[str, Any]:
        """Convert a Briefing to a clean view model for templates.

        - Sorts key points & risks alphabetically for consistent presentation.
        - Ensures metric list is ordered by name.
        - Generates a human-friendly title and timestamp.
        """
        points: List[str] = sorted((kp.text for kp in briefing.key_points))
        risks: List[str] = sorted((r.text for r in briefing.risks))
        metrics = sorted(
            ({"name": m.name, "value": m.value} for m in briefing.metrics),
            key=lambda x: x["name"],
        )
        return {
            "id": briefing.id,
            "title": f"Briefing: {briefing.company_name} ({briefing.ticker})",
            "company_name": briefing.company_name,
            "ticker": briefing.ticker,
            "summary": briefing.summary,
            "recommendation": briefing.recommendation,
            "key_points": points,
            "risks": risks,
            "metrics": metrics,
            "generated_at": self.generated_timestamp(),
        }

    def render_briefing(self, view: Dict[str, Any]) -> str:
        # render the raw briefing page; we expect view to contain a title
        template = self._env.get_template("briefing.html")
        body = template.render(**view)
        # optionally wrap with base template for consistent layout
        return self.render_base(view.get("title", "Briefing"), body)
