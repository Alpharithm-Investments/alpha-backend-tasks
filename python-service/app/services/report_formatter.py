from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

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
        # transform ORM briefing into primitive dict; sorting/formatting may expand
        return {
            "id": briefing.id,
            "company_name": briefing.company_name,
            "ticker": briefing.ticker,
            "summary": briefing.summary,
            "recommendation": briefing.recommendation,
            "key_points": [kp.text for kp in briefing.key_points],
            "risks": [r.text for r in briefing.risks],
            "metrics": [{"name": m.name, "value": m.value} for m in briefing.metrics],
            "generated_at": self.generated_timestamp(),
        }

    def render_briefing(self, view: Dict[str, Any]) -> str:
        template = self._env.get_template("briefing.html")
        return template.render(**view)
