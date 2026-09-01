import requests
import time

url = 'http://127.0.0.1:8000/api/data'
print(f'Testing rate limits on {url} (Limit is 10/minute)...')

for i in range(1, 13):
    response = requests.get(url)
    print(f'Request {i:02d}: Status Code {response.status_code}')
    if response.status_code == 429:
        print(f'-> Rate Limit Hit! Response: {response.json()}')
    time.sleep(0.1)
