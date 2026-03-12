from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app

# import models so they are registered with Base.metadata
from app.models import sample_item  # noqa: F401
from app.models import briefing  # noqa: F401


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

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


def make_payload():
    return {
        "company_name": "TestCo",
        "ticker": "tc",
        "summary": "A brief summary",
        "recommendation": "hold",
        "key_points": ["kp1", "kp2"],
        "risks": ["risk1"],
        "metrics": [{"name": "m1", "value": "v1"}],
    }


def test_crud_and_generate(client: TestClient) -> None:
    # create briefing
    res = client.post("/briefings", json=make_payload())
    assert res.status_code == 201
    data = res.json()
    assert data["company_name"] == "TestCo"
    bid = data["id"]

    # get briefing
    res2 = client.get(f"/briefings/{bid}")
    assert res2.status_code == 200
    assert res2.json()["id"] == bid

    # generate view model
    res3 = client.post(f"/briefings/{bid}/generate")
    assert res3.status_code == 200
    assert "key_points" in res3.json()

    # html
    res4 = client.get(f"/briefings/{bid}/html")
    assert res4.status_code == 200
    assert "<html" in res4.text
