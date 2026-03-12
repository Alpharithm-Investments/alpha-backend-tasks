from app.models.briefing import Briefing, BriefingKeyPoint, BriefingMetric, BriefingRisk
from app.services.report_formatter import ReportFormatter


def make_briefing() -> Briefing:
    b = Briefing(
        company_name="Zeta Inc",
        ticker="ZETA",
        summary="Summary text",
        recommendation="review",
    )
    # manually assign relationships for test
    b.key_points = [BriefingKeyPoint(text="b point"), BriefingKeyPoint(text="a point")]
    b.risks = [BriefingRisk(text="z risk"), BriefingRisk(text="y risk")]
    b.metrics = [BriefingMetric(name="m2", value="2"), BriefingMetric(name="m1", value="1")]
    return b


def test_formatter_orders_and_titles():
    formatter = ReportFormatter()
    b = make_briefing()
    view = formatter.briefing_to_view_model(b)
    assert view["title"] == "Briefing: Zeta Inc (ZETA)"
    # key points sorted alphabetically
    assert view["key_points"] == ["a point", "b point"]
    # risks sorted
    assert view["risks"] == ["y risk", "z risk"]
    # metrics sorted by name
    assert [m["name"] for m in view["metrics"]] == ["m1", "m2"]

    html = formatter.render_briefing(view)
    assert "Briefing: Zeta Inc" in html
    assert "a point" in html
    assert "m1" in html
