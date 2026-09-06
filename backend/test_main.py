import pytest
import io
import pandas as pd
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from backend.main import app

client = TestClient(app)

def test_import_roster_error_sanitization():
    """Test that errors in import_roster return generic sanitized message without stack traces or exception details."""
    # Send invalid bytes (e.g. non-excel data) with filename
    files = {'file': ('test.xlsx', b'invalid excel file content', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
    response = client.post("/api/roster/import", files=files)
    assert response.status_code == 400
    assert response.json()["detail"] == "Failed to read Excel file."

    # Create a dummy Excel file in memory with a NAMES sheet
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame({'col': [1, 2]}).to_excel(writer, sheet_name='NAMES', index=False)
    excel_bytes = output.getvalue()

    files = {'file': ('test.xlsx', excel_bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}

    # Mock xl.parse to raise an exception containing sensitive info
    with patch("pandas.ExcelFile.parse") as mock_parse:
        mock_parse.side_effect = Exception("Internal DB Connection String: secret_database_password_123")
        response = client.post("/api/roster/import", files=files)
        assert response.status_code == 500
        detail = response.json()["detail"]
        assert "secret_database_password_123" not in detail
        assert detail == "Failed parsing NAMES sheet due to an internal server error."

def test_chat_endpoint_error_sanitization():
    """Test that errors in /api/chat return sanitized error message in SSE stream without leaking str(e)."""
    with patch("google.genai.Client") as mock_client:
        mock_client.side_effect = Exception("Sensitive internal API key: secret_key_456")

        payload = {
            "message": "Hello",
            "history": [],
            "apiKey": "fake_api_key",
            "contextData": {}
        }
        response = client.post("/api/chat", json=payload)
        assert response.status_code == 200
        content = response.text
        assert "secret_key_456" not in content
        assert "An unexpected error occurred while processing your request." in content
