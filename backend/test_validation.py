from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_invalid_grade_record():
    payload = {
        "subject": "Mathematics",
        "grades": {
            "1": {
                "gw1": -10.0,
                "test": 50.0,
                "gw2": 0.0,
                "proj": 0.0,
                "exams": 0.0
            }
        }
    }
    response = client.post("/api/grades", json=payload)
    assert response.status_code == 422

def test_invalid_student_model():
    payload = {
        "sn": 0,
        "name": "",
        "attendance": -5
    }
    response = client.post("/api/reports", json=payload)
    assert response.status_code == 422
