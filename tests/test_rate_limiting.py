from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_get_data_rate_limit():
    # /api/data limit is 10/minute
    responses = []
    for _ in range(15):
        res = client.get("/api/data")
        responses.append(res.status_code)

    assert 200 in responses
    assert 429 in responses

def test_metadata_rate_limit():
    # /api/metadata limit is 20/minute
    payload = {
        "schoolName": "Test School",
        "district": "Test District",
        "classLevel": "BS. 7",
        "term": "ONE",
        "academicYear": "2024",
        "date": "2024-01-01",
        "nextTermBegins": "2024-05-01",
        "timesOpen": 60
    }
    responses = []
    for _ in range(25):
        res = client.post("/api/metadata", json=payload)
        responses.append(res.status_code)

    assert 200 in responses
    assert 429 in responses
