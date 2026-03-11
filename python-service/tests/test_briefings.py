from collections.abc import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Briefing, BriefingMetric, BriefingPoint  


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
        engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        testing_session_local = sessionmaker(
            bind=engine, autoflush=False, autocommit=False, future=True
        )
        Base.metadata.create_all(bind=engine)

        def override_get_db() -> Generator[Session, None, None]:
            db = testing_session_local()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db

        with TestClient(app) as test_client:
            yield test_client

        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)


VALID_PAYLOAD = {
        "companyName": "Acme Holdings",
        "ticker": "acme",
        "sector": "Industrial Technology",
        "analystName": "Jane Doe",
        "summary": "Acme is benefiting from strong enterprise demand.",
        "recommendation": "Monitor for margin expansion before increasing exposure.",
        "keyPoints": [
            "Revenue grew 18% year-over-year.",
            "Management raised full-year guidance.",
        ],
        "risks": ["Top two customers account for 41% of total revenue."],
        "metrics": [
            {"name": "Revenue Growth", "value": "18%"},
            {"name": "Operating Margin", "value": "22.4%"},
        ],
}


def test_create_briefing(client: TestClient) -> None:
        resp = client.post("/briefings", json=VALID_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["ticker"] == "ACME"
        assert data["company_name"] == "Acme Holdings"
        assert data["is_generated"] is False
        assert len([p for p in data["points"] if p["point_type"] == "key"]) == 2
        assert len([p for p in data["points"] if p["point_type"] == "risk"]) == 1
        assert len(data["metrics"]) == 2


def test_retrieve_briefing(client: TestClient) -> None:
        briefing_id = client.post("/briefings", json=VALID_PAYLOAD).json()["id"]
        resp = client.get(f"/briefings/{briefing_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == briefing_id


def test_retrieve_briefing_not_found(client: TestClient) -> None:
        resp = client.get("/briefings/9999")
        assert resp.status_code == 404


def test_generate_briefing(client: TestClient) -> None:
        briefing_id = client.post("/briefings", json=VALID_PAYLOAD).json()["id"]
        resp = client.post(f"/briefings/{briefing_id}/generate")
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_generated"] is True
        assert data["generated_at"] is not None


def test_get_html(client: TestClient) -> None:
        briefing_id = client.post("/briefings", json=VALID_PAYLOAD).json()["id"]
        client.post(f"/briefings/{briefing_id}/generate")
        resp = client.get(f"/briefings/{briefing_id}/html")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert "Acme Holdings" in resp.text
        assert "Revenue Growth" in resp.text


def test_get_html_before_generate(client: TestClient) -> None:
        briefing_id = client.post("/briefings", json=VALID_PAYLOAD).json()["id"]
        resp = client.get(f"/briefings/{briefing_id}/html")
        assert resp.status_code == 409


def test_validation_requires_two_key_points(client: TestClient) -> None:
        payload = {**VALID_PAYLOAD, "keyPoints": ["Only one point"]}
        resp = client.post("/briefings", json=payload)
        assert resp.status_code == 422


def test_validation_requires_one_risk(client: TestClient) -> None:
        payload = {**VALID_PAYLOAD, "risks": []}
        resp = client.post("/briefings", json=payload)
        assert resp.status_code == 422


def test_validation_duplicate_metric_names(client: TestClient) -> None:
        payload = {
            **VALID_PAYLOAD,
            "metrics": [
                {"name": "Revenue Growth", "value": "18%"},
                {"name": "revenue growth", "value": "20%"},
            ],
        }
        resp = client.post("/briefings", json=payload)
        assert resp.status_code == 422


def test_briefing_without_metrics(client: TestClient) -> None:
        payload = {**VALID_PAYLOAD, "metrics": []}
        briefing_id = client.post("/briefings", json=payload).json()["id"]
        client.post(f"/briefings/{briefing_id}/generate")
        html_resp = client.get(f"/briefings/{briefing_id}/html")
        assert html_resp.status_code == 200
        assert "Key Metrics" not in html_resp.text


def test_ticker_normalized_to_uppercase(client: TestClient) -> None:
        payload = {**VALID_PAYLOAD, "ticker": "  acme  "}
        resp = client.post("/briefings", json=payload)
        assert resp.status_code == 201
        assert resp.json()["ticker"] == "ACME"