from datetime import datetime
from typing import List
from app.models.briefing import Briefing, BriefingPoint, BriefingMetric
from app.schemas.briefing import ReportViewModel, MetricResponse


class BriefingFormatter:
    """Transforms database models into report-friendly view models"""
    
    @staticmethod
    def to_report_view_model(briefing: Briefing) -> ReportViewModel:
        """Convert a Briefing ORM model to a ReportViewModel for template rendering"""
        
        # Sort points by display order
        sorted_key_points = sorted(
            [p for p in briefing.points if p.point_type == "key_point"],
            key=lambda x: x.display_order
        )
        sorted_risks = sorted(
            [p for p in briefing.points if p.point_type == "risk"],
            key=lambda x: x.display_order
        )
        
        # Format timestamps
        now = datetime.utcnow()
        generated_date = now.strftime("%B %d, %Y")
        generated_timestamp = now.strftime("%Y-%m-%d %H:%M:%S UTC")
        
        # Build report title
        report_title = f"Investment Briefing: {briefing.company_name} ({briefing.ticker})"
        
        return ReportViewModel(
            report_title=report_title,
            company_name=briefing.company_name,
            ticker=briefing.ticker,
            sector=briefing.sector,
            analyst_name=briefing.analyst_name,
            generated_date=generated_date,
            generated_timestamp=generated_timestamp,
            summary=briefing.summary,
            recommendation=briefing.recommendation,
            key_points=[p.content for p in sorted_key_points],
            risks=[p.content for p in sorted_risks],
            metrics=[
                MetricResponse(name=m.name, value=m.value) 
                for m in briefing.metrics
            ],
            has_metrics=len(briefing.metrics) > 0
        )
    
    @staticmethod
    def create_points_from_input(
        key_points_data: List[str], 
        risks_data: List[str]
    ) -> List[BriefingPoint]:
        """Create BriefingPoint ORM objects from input strings with proper ordering"""
        points = []
        
        # Add key points with ordering
        for idx, content in enumerate(key_points_data):
            points.append(BriefingPoint(
                point_type="key_point",
                content=content.strip(),
                display_order=idx
            ))
        
        # Add risks with ordering
        for idx, content in enumerate(risks_data):
            points.append(BriefingPoint(
                point_type="risk",
                content=content.strip(),
                display_order=idx
            ))
        
        return points
    
    @staticmethod
    def create_metrics_from_input(metrics_data: List[dict]) -> List[BriefingMetric]:
        """Create BriefingMetric ORM objects from input data"""
        if not metrics_data:
            return []
        
        return [
            BriefingMetric(
                name=m["name"].strip(),
                value=m["value"].strip()
            )
            for m in metrics_data
        ]