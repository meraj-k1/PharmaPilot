import pytest

from fastapi.testclient import TestClient

from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client

def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_health_response_structure(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()

    assert data["service"] == "PharmaPilot API"
    assert data["version"] == "1.1.0"


def test_request_id_header():
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert "X-Request-ID" in response.headers


def test_missing_route():
    with TestClient(app) as client:
        response = client.get("/api/v1/unknown-endpoint")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "HTTP_ERROR"
