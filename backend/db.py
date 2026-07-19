import json
import os

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_FILE = os.path.join(DB_DIR, "db.json")

DEFAULT_DB = {
    "metadata": {
        "schoolName": "VE-GOLOKUATI R.C. JHS",
        "district": "AFADZATO SOUTH DISTRICT",
        "classLevel": "BS. 7",
        "term": "ONE",
        "academicYear": "2023",
        "date": "2023-12-22",
        "nextTermBegins": "2024-01-09",
        "timesOpen": 57
    },
    "students": [],
    "grades": {},
    "dropLists": {
        "classes": ["KG 1", "KG 2", "BS. 1", "BS. 2", "BS. 3", "BS. 4", "BS. 5", "BS. 6", "BS. 7", "BS. 8", "BS. 9"],
        "terms": ["ONE", "TWO", "THREE"],
        "conduct": [
            "Good social skills",
            "Always attentive in class",
            "Exhibits good teamwork",
            "Always in class on time",
            "Asks questions in class",
            "Dull in class",
            "Makes noise in class",
            "Enjoys conversation with friends during free periods",
            "Remains an active learner throughout the school day",
            "Reads extensively for enjoyment",
            "Welcomes leadership roles in groups",
            "Shows enthusiasm for classroom activities",
            "Exhibits a positive outlook and attitude in the classroom",
            "Responds appropriately when corrected",
            "Is a model citizen in our classroom",
            "Asks for clarification when needed",
            "Completes assignments in the time allotted",
            "Displays self-discipline",
            "Uses free minutes of class time constructively"
        ],
        "interest": [
            "Singing songs",
            "Reading books",
            "Dancing",
            "Poetry reciting",
            "Playing Games",
            "Sports activities",
            "Acting drama",
            "Playing drums",
            "Drawing",
            "Writing",
            "Bike riding",
            "Swimming",
            "Cooking food",
            "Operating computer",
            "Composing songs",
            "Rapping",
            "Spelling of words"
        ],
        "remarks": [
            "Well done, keep it up",
            "Poor performance, work hard",
            "Can do better",
            "More room for improvement",
            "Learn hard to improve",
            "Needs more time to study at home",
            "Needs necessary learning materials",
            "Making steady progress",
            "Needs counseling",
            "Performance was good",
            "Strive for excellence",
            "Take your studies seriously",
            "Improve on your spelling",
            "Read through your work before submitting"
        ]
    }
}

def load_db():
    if not os.path.exists(DB_DIR):
        os.makedirs(DB_DIR)
    if not os.path.exists(DB_FILE):
        save_db(DEFAULT_DB)
        return DEFAULT_DB
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_DB

def save_db(data):
    if not os.path.exists(DB_DIR):
        os.makedirs(DB_DIR)
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
