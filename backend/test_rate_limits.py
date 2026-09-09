from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_rate_limit_get_data():
    responses = [client.get("/api/data") for _ in range(12)]
    # First 10 requests should succeed (200), subsequent requests within 1 minute should be rate limited (429)
    statuses = [r.status_code for r in responses]
    assert 429 in statuses

def test_rate_limit_update_metadata():
    payload = {
        "schoolName": "Test School",
        "district": "Test District",
        "classLevel": "BS. 1",
        "term": "ONE",
        "academicYear": "2024",
        "date": "2024-01-01",
        "nextTermBegins": "2024-05-01",
        "timesOpen": 50
    }
    responses = [client.post("/api/metadata", json=payload) for _ in range(25)]
    statuses = [r.status_code for r in responses]
    assert 429 in statuses
