import re
import sys

def main():
    print("Running Security Vulnerability Scanner on backend/main.py...")
    with open("backend/main.py", "r", encoding="utf-8") as f:
        content = f.read()

    errors = []

    # 1. Verify standard logging setup exists
    if "logger = logging.getLogger(" not in content:
        errors.append("Standard python logger setup not found.")

    # 2. Check /api/roster/import secure exception handling
    # We want to make sure raw traceback `str(e)` is not leaked to the HTTP response detail
    import_matches = re.findall(r'async def import_roster.*?detail=.*?(?:\n|.*?)*', content, re.DOTALL)
    for match in import_matches:
        if "str(e)" in match:
            errors.append("Potential raw exception string leak 'str(e)' found in import_roster endpoint.")

    # 3. Check file size constraints inside import_roster
    if "5 * 1024 * 1024" not in content and "5MB" not in content:
        errors.append("File size limits constraint not found in import_roster.")

    # 4. Check file extension restriction
    if ".xlsx" not in content or ".xls" not in content:
        errors.append("File extension validation not found in import_roster.")

    # 5. Check chat endpoint message length limits
    if "len(request.message) > 4000" not in content:
        errors.append("Message length constraint (4000) not found in chat_endpoint.")

    # 6. Check chat endpoint history count limits
    if "len(request.history) > 30" not in content:
        errors.append("History count constraint (30) not found in chat_endpoint.")

    # 7. Check chat error secure exception handling
    chat_matches = re.findall(r'async def sse_generator.*?except Exception as e.*?str\(e\)', content, re.DOTALL)
    if chat_matches:
        errors.append("Potential raw exception string leak 'str(e)' found inside sse_generator of chat_endpoint.")

    if errors:
        print("\n❌ SECURITY SCAN FAILED:")
        for err in errors:
            print(f"- {err}")
        sys.exit(1)
    else:
        print("\n✅ SECURITY SCAN PASSED: No information disclosure or input constraint issues detected in main endpoints!")
        sys.exit(0)

if __name__ == "__main__":
    main()
