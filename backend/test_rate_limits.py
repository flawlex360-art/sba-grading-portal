import unittest
from fastapi.testclient import TestClient
from backend.main import app

class TestRateLimits(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_metadata_endpoint_rate_limit(self):
        payload = {
            "schoolName": "Test School",
            "district": "Test District",
            "classLevel": "JHS 1",
            "term": "Term 1",
            "academicYear": "2023/2024",
            "date": "2024-01-01",
            "nextTermBegins": "2024-05-01",
            "timesOpen": 90
        }

        rate_limited = False
        # Limit is 20/minute
        for i in range(25):
            response = self.client.post("/api/metadata", json=payload)
            if response.status_code == 429:
                rate_limited = True
                break

        self.assertTrue(rate_limited, "Expected HTTP 429 Rate Limit Exceeded after multiple requests")

if __name__ == "__main__":
    unittest.main()
