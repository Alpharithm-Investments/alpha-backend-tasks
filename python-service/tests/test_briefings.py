import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import get_db, Base
from app.models.briefing import Briefing, BriefingPoint, BriefingMetric


# Setup test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_create_briefing_success():
    response = client.post("/briefings", json={
        "companyName": "Acme Holdings",
        "ticker": "ACME",
        "sector": "Industrial Technology",
        "analystName": "Jane Doe",
        "summary": "Strong enterprise demand and improving operating leverage.",
        "recommendation": "Monitor for margin expansion.",
        "keyPoints": [
            "Revenue grew 18% year-over-year.",
            "Management raised guidance.",
            "Enterprise subscriptions at 62%."
        ],
        "risks": [
            "Top two customers account for 41% of revenue.",
            "International expansion may pressure margins."
        ],
        "metrics": [
            {"name": "Revenue Growth", "value": "18%"},
            {"name": "Operating Margin", "value": "22.4%"}
        ]
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["company_name"] == "Acme Holdings"
    assert data["ticker"] == "ACME"  # Should be uppercase
    assert len(data["key_points"]) == 3
    assert len(data["risks"]) == 2
    assert len(data["metrics"]) == 2
    assert data["generated"] is False


def test_create_briefing_validation_errors():
    # Test less than 2 key points
    response = client.post("/briefings", json={
        "companyName": "Test Co",
        "ticker": "TEST",
        "analystName": "Analyst",
        "summary": "Summary here",
        "recommendation": "Buy",
        "keyPoints": ["Only one point"],
        "risks": ["Risk 1"]
    })
    assert response.status_code == 422
    
    # Test no risks
    response = client.post("/briefings", json={
        "companyName": "Test Co",
        "ticker": "TEST",
        "analystName": "Analyst",
        "summary": "Summary here",
        "recommendation": "Buy",
        "keyPoints": ["Point 1", "Point 2"],
        "risks": []
    })
    assert response.status_code == 422
    
    # Test duplicate metric names
    response = client.post("/briefings", json={
        "companyName": "Test Co",
        "ticker": "TEST",
        "analystName": "Analyst",
        "summary": "Summary here",
        "recommendation": "Buy",
        "keyPoints": ["Point 1", "Point 2"],
        "risks": ["Risk 1"],
        "metrics": [
            {"name": "Revenue", "value": "10%"},
            {"name": "revenue", "value": "15%"}  # Duplicate (case insensitive)
        ]
    })
    assert response.status_code == 422


def test_get_briefing():
    # Create first
    create_resp = client.post("/briefings", json={
        "companyName": "Test Co",
        "ticker": "TEST",
        "analystName": "Analyst",
        "summary": "Summary",
        "recommendation": "Hold",
        "keyPoints": ["Point 1", "Point 2"],
        "risks": ["Risk 1"]
    })
    briefing_id = create_resp.json()["id"]
    
    # Get
    response = client.get(f"/briefings/{briefing_id}")
    assert response.status_code == 200
    assert response.json()["id"] == briefing_id


def test_generate_and_get_html():
    # Create briefing
    create_resp = client.post("/briefings", json={
        "companyName": "Acme Corp",
        "ticker": "ACME",
        "analystName": "John Smith",
        "summary": "Strong performance expected.",
        "recommendation": "Buy recommendation here.",
        "keyPoints": ["Growth is strong", "Margins improving", "Market expanding"],
        "risks": ["Competition increasing"],
        "metrics": [{"name": "P/E", "value": "25x"}]
    })
    briefing_id = create_resp.json()["id"]
    assert create_resp.json()["generated"] is False
    
    # Generate report
    gen_resp = client.post(f"/briefings/{briefing_id}/generate")
    assert gen_resp.status_code == 200
    assert gen_resp.json()["generated"] is True
    assert gen_resp.json()["generated_at"] is not None
    
    # Get HTML
    html_resp = client.get(f"/briefings/{briefing_id}/html")
    assert html_resp.status_code == 200
    assert "text/html" in html_resp.headers["content-type"]
    assert "Acme Corp" in html_resp.text
    assert "ACME" in html_resp.text
    assert "John Smith" in html_resp.text
    assert "Strong performance expected." in html_resp.text
    assert "Buy recommendation here." in html_resp.text
    assert "Growth is strong" in html_resp.text
    assert "Competition increasing" in html_resp.text
    assert "25x" in html_resp.text
    # Check for escaped content (security)
    assert "&lt;" not in html_resp.text  # Should be properly escaped if present


def test_not_found_errors():
    fake_id = "123e4567-e89b-12d3-a456-426614174000"
    
    response = client.get(f"/briefings/{fake_id}")
    assert response.status_code == 404
    
    response = client.post(f"/briefings/{fake_id}/generate")
    assert response.status_code == 404
    
    response = client.get(f"/briefings/{fake_id}/html")
    assert response.status_code == 404