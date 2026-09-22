import unittest
from fastapi.testclient import TestClient
from backend.main import app

class TestBackendAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        app.state.limiter.reset()

    def test_get_data(self):
        response = self.client.get("/api/data")
        self.assertEqual(response.status_code, 200)

    def test_update_metadata(self):
        payload = {
            "schoolName": "Test School",
            "district": "Test District",
            "classLevel": "BS. 1",
            "term": "ONE",
            "academicYear": "2024",
            "date": "2024-01-01",
            "nextTermBegins": "2024-02-01",
            "timesOpen": 50
        }
        response = self.client.post("/api/metadata", json=payload)
        self.assertEqual(response.status_code, 200)

    def test_rate_limiting_exceeded(self):
        payload = {
            "schoolName": "Test School",
            "district": "Test District",
            "classLevel": "BS. 1",
            "term": "ONE",
            "academicYear": "2024",
            "date": "2024-01-01",
            "nextTermBegins": "2024-02-01",
            "timesOpen": 50
        }
        # Metadata endpoint limit is 20/minute.
        # Fire requests until limit is hit or loop finishes.
        hit_rate_limit = False
        for _ in range(25):
            res = self.client.post("/api/metadata", json=payload)
            if res.status_code == 429:
                hit_rate_limit = True
                break
        self.assertTrue(hit_rate_limit, "Rate limiting should return HTTP 429 after exceeding quota")

if __name__ == "__main__":
    unittest.main()
