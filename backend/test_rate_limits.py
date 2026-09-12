from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_rate_limits_get_data():
    # Attempt requests up to limit
    responses = []
    for _ in range(12):
        res = client.get("/api/data")
        responses.append(res.status_code)

    # Check that at least one request returns 429 Too Many Requests
    assert 429 in responses

def test_rate_limits_post_metadata():
    payload = {
        "schoolName": "Test School",
        "district": "Test District",
        "classLevel": "BS. 1",
        "term": "ONE",
        "academicYear": "2024",
        "date": "2024-01-01",
        "nextTermBegins": "2024-05-01",
        "timesOpen": 60
    }
    responses = []
    for _ in range(12):
        res = client.post("/api/metadata", json=payload)
        responses.append(res.status_code)

    assert 429 in responses
