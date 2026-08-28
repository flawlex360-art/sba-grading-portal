import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_metadata_validation_success():
    payload = {
        "schoolName": "Test School",
        "district": "Test District",
        "classLevel": "BS 7",
        "term": "ONE",
        "academicYear": "2024",
        "date": "2024-01-01",
        "nextTermBegins": "2024-05-01",
        "timesOpen": 60
    }
    response = client.post("/api/metadata", json=payload)
    assert response.status_code == 200

def test_metadata_validation_invalid_times_open():
    payload = {
        "schoolName": "Test School",
        "district": "Test District",
        "classLevel": "BS 7",
        "term": "ONE",
        "academicYear": "2024",
        "date": "2024-01-01",
        "nextTermBegins": "2024-05-01",
        "timesOpen": -10  # Negative timesOpen should fail validation
    }
    response = client.post("/api/metadata", json=payload)
    assert response.status_code == 422

def test_roster_validation_negative_attendance():
    payload = [
        {
            "sn": 1,
            "name": "John Doe",
            "attendance": -5  # Invalid attendance
        }
    ]
    response = client.post("/api/roster", json=payload)
    assert response.status_code == 422

def test_roster_validation_invalid_sn():
    payload = [
        {
            "sn": 0,  # Invalid student number (< 1)
            "name": "John Doe",
            "attendance": 10
        }
    ]
    response = client.post("/api/roster", json=payload)
    assert response.status_code == 422

def test_grades_validation_out_of_bounds_exam_score():
    payload = {
        "subject": "MATHS",
        "grades": {
            "1": {
                "gw1": 10,
                "test": 15,
                "gw2": 10,
                "proj": 15,
                "exams": 150  # Out of bounds (> 100)
            }
        }
    }
    response = client.post("/api/grades", json=payload)
    assert response.status_code == 422
