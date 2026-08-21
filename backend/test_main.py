import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_chat_endpoint_message_length_validation():
    # Test message exceeding 4000 characters limit
    oversized_message = "A" * 4001
    response = client.post("/api/chat", json={"message": oversized_message})
    assert response.status_code == 422
    errors = response.json().get("detail", [])
    assert any("message" in str(err) for err in errors)

def test_chat_endpoint_history_length_validation():
    # Test history exceeding 50 items limit
    oversized_history = [{"role": "user", "content": "hello"}] * 51
    response = client.post("/api/chat", json={"message": "Valid message", "history": oversized_history})
    assert response.status_code == 422

def test_import_roster_sanitized_error_response():
    # Test sending invalid file contents to import_roster endpoint
    response = client.post("/api/roster/import", files={"file": ("test.xlsx", b"not an excel file", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert response.status_code == 400
    data = response.json()
    assert data["detail"] == "Failed to read Excel file due to invalid format."
