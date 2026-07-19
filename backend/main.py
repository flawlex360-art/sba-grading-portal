import os
import json
import io
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import pandas as pd
from backend.db import load_db, save_db

app = FastAPI()

# Enable CORS for frontend proxy
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173", 
        "https://websba.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# API Data Models
class MetadataModel(BaseModel):
    schoolName: str
    district: str
    classLevel: str
    term: str
    academicYear: str
    date: str
    nextTermBegins: str
    timesOpen: int

class StudentModel(BaseModel):
    sn: int
    name: str
    attendance: int = 0
    conduct: str = ""
    interest: str = ""
    remarks: str = ""
    promotedTo: str = ""

class GradeRecord(BaseModel):
    gw1: float = 0
    test: float = 0
    gw2: float = 0
    proj: float = 0
    exams: float = 0

class GradebookModel(BaseModel):
    subject: str
    grades: dict  # studentSn -> GradeRecord

class ChatRequest(BaseModel):
    message: str
    history: list = []
    apiKey: str = ""

# API Endpoints
@app.get("/api/data")
def get_all_data():
    return load_db()

@app.post("/api/metadata")
def update_metadata(meta: MetadataModel):
    db = load_db()
    db["metadata"] = meta.model_dump()
    save_db(db)
    return {"status": "success", "metadata": db["metadata"]}

@app.post("/api/roster")
def update_roster(students: list[StudentModel]):
    db = load_db()
    # Merge existing student records (to keep their comments/attendance)
    existing_map = {s["sn"]: s for s in db.get("students", [])}
    
    updated_students = []
    for s in students:
        s_dict = s.model_dump()
        # Preserve existing comments/attendance if available
        if s.sn in existing_map:
            for field in ["attendance", "conduct", "interest", "remarks", "promotedTo"]:
                if not s_dict[field] and existing_map[s.sn].get(field):
                    s_dict[field] = existing_map[s.sn][field]
        updated_students.append(s_dict)
        
    db["students"] = updated_students
    save_db(db)
    return {"status": "success", "students": db["students"]}

@app.post("/api/roster/import")
async def import_roster(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        xl = pd.ExcelFile(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")
        
    sheet_name = None
    for name in xl.sheet_names:
        if name.upper() == "NAMES":
            sheet_name = name
            break
            
    if not sheet_name:
        raise HTTPException(status_code=400, detail="NAMES sheet not found in Excel file")
        
    try:
        df = xl.parse(sheet_name, header=None)
        names = []
        for idx, row in df.iterrows():
            if idx >= 7:  # Row 8 is index 7
                if len(row) > 4 and pd.notna(row[4]):
                    name_val = str(row[4]).strip()
                    if name_val and name_val != "Name (Surname First)":
                        names.append(name_val)
        
        # Build new student roster
        students = []
        for i, name in enumerate(names, 1):
            students.append({
                "sn": i,
                "name": name,
                "attendance": 0,
                "conduct": "",
                "interest": "",
                "remarks": "",
                "promotedTo": ""
            })
            
        db = load_db()
        db["students"] = students
        save_db(db)
        return {"status": "success", "students": students}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed parsing NAMES sheet: {str(e)}")

@app.post("/api/grades")
def update_grades(gradebook: GradebookModel):
    db = load_db()
    if "grades" not in db:
        db["grades"] = {}
    
    subject = gradebook.subject
    db["grades"][subject] = gradebook.grades
    save_db(db)
    return {"status": "success"}

@app.post("/api/reports")
def update_student_report(report: StudentModel):
    db = load_db()
    students = db.get("students", [])
    found = False
    for s in students:
        if s["sn"] == report.sn:
            s["attendance"] = report.attendance
            s["conduct"] = report.conduct
            s["interest"] = report.interest
            s["remarks"] = report.remarks
            s["promotedTo"] = report.promotedTo
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Student not found")
    save_db(db)
    return {"status": "success", "students": db["students"]}

@app.post("/api/dropLists")
def update_drop_lists(drop_lists: dict):
    db = load_db()
    db["dropLists"] = drop_lists
    save_db(db)
    return {"status": "success", "dropLists": db["dropLists"]}

# Gemini Streaming Chat Endpoint
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    api_key = request.apiKey or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        # Yield an error event and exit
        async def err_generator():
            err_msg = "⚠️ Gemini API key is missing. Please add it in the settings or set GEMINI_API_KEY in your environment."
            yield f"data: {json.dumps({'type': 'FINAL_RESPONSE', 'content': err_msg})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err_generator(), media_type="text/event-stream")

    db = load_db()
    
    # Construct a concise context of the class database
    context_data = {
        "metadata": db["metadata"],
        "students_count": len(db["students"]),
        "students": [{"sn": s["sn"], "name": s["name"]} for s in db["students"]],
        "grades": {}
    }
    
    # Include calculated total scores for context to save tokens and logic
    from backend.calculations_py import compute_positions_and_ranks
    computed = compute_positions_and_ranks(db)
    context_data["overall_results"] = computed

    system_instruction = (
        "You are an expert school grading and data analyst assistant.\n"
        "You are helping teachers analyze their School Based Assessment (SBA) and Exam grades.\n"
        "Here is the current school data in JSON format:\n"
        f"{json.dumps(context_data, indent=2)}\n\n"
        "CRITICAL REQUIREMENT:\n"
        "To provide a sleek reasoning experience, you MUST output your internal thoughts or reasoning "
        "step-by-step inside <thought>...</thought> tags first, and then output your final markdown response.\n"
        "Example:\n"
        "<thought>\nThe user is asking for the top student in Maths. I will look at the math_totals or ranks...\n</thought>\n"
        "The top student in Maths is..."
    )

    # Build conversation messages
    contents = []
    for msg in request.history:
        contents.append(f"{'User' if msg.get('role') == 'user' else 'Assistant'}: {msg.get('content')}")
    contents.append(f"User: {request.message}")
    prompt = "\n".join(contents)

    async def sse_generator():
        try:
            # We initialize Client in a thread-safe way
            from google import genai
            from google.genai import types
            
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content_stream(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2
                )
            )
            
            # Simple state machine to parse thoughts vs final response
            buffer = ""
            in_thought = False
            
            for chunk in response:
                text = chunk.text
                if not text:
                    continue
                
                buffer += text
                
                # Check for thought tags
                while True:
                    if not in_thought:
                        start_idx = buffer.find("<thought>")
                        if start_idx != -1:
                            # Send any text before <thought> as final response
                            pre_text = buffer[:start_idx]
                            if pre_text:
                                yield f"data: {json.dumps({'type': 'FINAL_RESPONSE', 'content': pre_text})}\n\n"
                            
                            in_thought = True
                            buffer = buffer[start_idx + len("<thought>"):]
                        else:
                            # Yield what we can of final response, leaving a small buffer at end to avoid slicing tags
                            if len(buffer) > 15:
                                send_text = buffer[:-15]
                                yield f"data: {json.dumps({'type': 'FINAL_RESPONSE', 'content': send_text})}\n\n"
                                buffer = buffer[-15:]
                            break
                    else:
                        end_idx = buffer.find("</thought>")
                        if end_idx != -1:
                            thought_text = buffer[:end_idx]
                            yield f"data: {json.dumps({'type': 'THOUGHT', 'content': thought_text})}\n\n"
                            in_thought = False
                            buffer = buffer[end_idx + len("</thought>"):]
                        else:
                            if len(buffer) > 15:
                                send_thought = buffer[:-15]
                                yield f"data: {json.dumps({'type': 'THOUGHT', 'content': send_thought})}\n\n"
                                buffer = buffer[-15:]
                            break
                # Yield to let event loop run
                await asyncio.sleep(0.01)
                
            # Yield remaining buffer
            if buffer:
                evt_type = "THOUGHT" if in_thought else "FINAL_RESPONSE"
                # Strip clean-up tags
                clean_buffer = buffer.replace("</thought>", "").replace("<thought>", "")
                if clean_buffer:
                    yield f"data: {json.dumps({'type': evt_type, 'content': clean_buffer})}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'FINAL_RESPONSE', 'content': f'⚠️ Chat Error: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
