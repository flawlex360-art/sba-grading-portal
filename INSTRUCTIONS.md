# Madifor WebSBA — Setup & Operating Instructions

Welcome to the **Madifor WebSBA** School-Based Assessment and Grading Portal codebase!
This document provides complete, step-by-step instructions on how to install, configure, run, and maintain this project on any machine.

---

## 1. System Requirements & Prerequisites

Ensure the following tools are installed on your system:
- **Node.js**: v18.0.0 or higher (v20+ recommended) -> [Download Node.js](https://nodejs.org/)
- **Python**: v3.10, v3.11, or v3.12 -> [Download Python](https://python.org/)
- **Git**: [Download Git](https://git-scm.com/)
- **Web Browser**: Chrome, Edge, Firefox, or Safari (Modern browser with ES6 support)

---

## 2. Project Directory Overview

```text
Madifor_WebSBA/
├── backend/                  # Python FastAPI backend (AI streaming chat, rate limiting, calc)
│   ├── calculations_py.py   # Python grading & ranking engine
│   ├── db.py                # Local JSON persistence handler
│   └── main.py              # Main FastAPI application with SlowAPI rate limiting
├── data/                     # Local test/offline database JSON
├── public/                   # Public assets (Madifor icon, coats of arms, crests)
│   ├── anglican-crest.png
│   ├── ghana-coa.svg
│   └── icon.png
├── scripts/                  # Automated maintenance & disaster recovery scripts
│   ├── backup.js            # Firestore -> Supabase & JSON backup worker
│   ├── install-backup-task.ps1
│   └── purge_data.js
├── src/                      # Frontend source code (React + Vite + Tailwind CSS)
│   ├── components/          # UI Components (AdminPanel, Gradebook, Login, ReportCard, etc.)
│   ├── constants/           # Preset phrase dictionaries (conduct, remarks, interests)
│   ├── utils/               # Helper modules (calculations, excelExport, firebase, etc.)
│   ├── App.jsx              # Core application router & authentication controller
│   ├── index.css            # Tailwind & print media CSS styles
│   └── main.jsx             # React DOM entry point
├── .env                      # Environment variables (Firebase & AI API credentials)
├── .firebaserc               # Firebase project aliases
├── .gitignore                # Git exclusions
├── FILE_DIRECTORY_AND_PURPOSE.md # Exhaustive file-by-file map & description
├── firebase.json             # Firebase configuration
├── firestore.rules           # Cloud Firestore security & multi-tenant isolation rules
├── index.html                # Single Page Application root HTML
├── package.json              # Frontend npm dependencies & scripts
├── PROJECT_DOCUMENTATION.md  # Comprehensive system architecture & grading algorithms
├── requirements.txt          # Python backend dependencies
├── tailwind.config.js        # Tailwind design system configuration
├── vercel.json               # Vercel deployment & routing configuration
└── vite.config.js            # Vite build configuration
```

---

## 3. Step-by-Step Installation & Local Setup

### Step 3.1: Frontend Setup (React + Vite)
1. Open a terminal (PowerShell, Command Prompt, or Bash) in this project folder:
   ```bash
   cd path/to/Madifor_WebSBA
   ```
2. Install all Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   ```text
   http://localhost:5173
   ```

---

### Step 3.2: Backend Setup (Python FastAPI Server)
The backend handles AI streaming analysis (via Google Gemini) and rate-limited calculation services.

1. Open a second terminal window in the project folder:
   ```bash
   cd path/to/Madifor_WebSBA
   ```
2. (Recommended) Create and activate a Python virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   python -m uvicorn backend.main:app --port 8000 --reload
   ```
   The API will be live at `http://127.0.0.1:8000`. You can test interactive API docs at `http://127.0.0.1:8000/docs`.

---

## 4. Environment Variables Configuration (`.env`)

A working `.env` file is included in this root directory. It contains configuration keys for:
- `VITE_FIREBASE_API_KEY`: Firebase web API key
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET`: Storage bucket URI
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Messaging sender ID
- `VITE_FIREBASE_APP_ID`: Firebase application ID
- `GEMINI_API_KEY`: Google Gemini AI key (for conversational analytics)
- `VITE_SUPABASE_URL` & `VITE_SUPABASE_SERVICE_KEY`: Optional Supabase backup credentials

> [!IMPORTANT]
> Never commit `.env` containing live secrets to public version control (GitHub). It is already included in `.gitignore`.

---

## 5. User Roles & Account Login Guide

The platform supports 4 user tiers:

1. **Senior Super User (System Admin)**:
   - Default login: `system@flawlex.com`
   - Role: Register new school institutions, generate demo schools with bell-curve mock data, manage system-wide settings, and delete institutions.
2. **School Super Admin (Headmaster / Principal)**:
   - Created by the Senior Super User during school registration.
   - Role: Add and manage teachers, assign classes and subjects, set term dates and reopening metadata, and view consolidated school broadsheets in read-only mode.
3. **Class / Subject Teacher**:
   - Created by the Headmaster.
   - Role: Enter student marks in the Gradebook (Group Work, Class Tests, Projects, Exams), manage Rosters, edit qualitative terminal remarks (Conduct, Interest, Promotion), and print student report cards.
4. **Regional / Unit Director (Supervisory)**:
   - Multi-school oversight and compliance dashboard.

---

## 6. Building for Production & Deployment

### 6.1 Frontend Production Build
To create an optimized, minified production build:
```bash
npm run build
```
This generates the output inside the `dist/` directory.

### 6.2 Deployment on Vercel
The repository is configured for zero-configuration continuous deployment on Vercel:
1. Push changes to GitHub:
   ```bash
   git add .
   git commit -m "Your update message"
   git push origin main
   ```
2. Vercel automatically detects the push, runs `npm run build`, and deploys live.
3. Ensure the environment variables from `.env` are added under **Vercel Project Settings -> Environment Variables**.

---

## 7. Security Features Included in This Codebase

1. **Zero Plaintext Password Exposure**:
   - Passwords are never saved in database documents; authentication is fully managed by Firebase Auth secure hashing.
2. **Frontend Brute-Force Lockout (`Login.jsx`)**:
   - 5 failed login attempts trigger an automatic 60-second lockout timer with visual countdown.
3. **Backend Rate Limiting (`SlowAPI`)**:
   - Endpoints like `/api/data` (10 req/min) and `/api/chat` (5 req/min) automatically reject spam with HTTP 429.
4. **Tenant Isolation**:
   - Firestore security rules (`firestore.rules`) enforce strict institution boundaries so schools cannot see or modify each other's data.

---

## 8. Where to Find More Details

- For full architecture, grading formulas, and system specifications: see **`PROJECT_DOCUMENTATION.md`**.
- For an exhaustive breakdown of every single file in the project: see **`FILE_DIRECTORY_AND_PURPOSE.md`**.

---
*Maintained by Madifor Technologies • Support: system@flawlex.com*
