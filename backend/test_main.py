import io
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_import_roster_invalid_file_sanitized_error():
    # Send invalid/corrupted file content to /api/roster/import
    response = client.post(
        "/api/roster/import",
        files={"file": ("invalid.xlsx", io.BytesIO(b"not an excel file"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    # Ensure error message is generic and does not leak internal traceback/exception details
    assert data["detail"] == "Failed to read Excel file. Please ensure it is a valid Excel document."
