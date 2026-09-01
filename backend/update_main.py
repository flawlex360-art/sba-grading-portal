import re

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add slowapi imports
imports = '''from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
'''
content = content.replace('from fastapi import FastAPI', imports + 'from fastapi import FastAPI')

# 2. Add limiter config right after app = FastAPI()
limiter_setup = '''
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
'''
content = content.replace('app = FastAPI()', 'app = FastAPI()' + limiter_setup)

# 3. Add rate limit to /api/data endpoint
content = content.replace(
    '@app.get("/api/data")\ndef get_all_data():',
    '@app.get("/api/data")\n@limiter.limit("10/minute")\ndef get_all_data(request: Request):'
)

# 4. Add rate limit to /api/chat endpoint
content = content.replace(
    '@app.post("/api/chat")\nasync def chat_endpoint(request: ChatRequest):',
    '@app.post("/api/chat")\n@limiter.limit("5/minute")\nasync def chat_endpoint(request: ChatRequest, fastapi_req: Request):'
)

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated main.py successfully')
