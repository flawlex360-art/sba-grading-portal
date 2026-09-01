# Madifor WebSBA: Complete Codebase Map & File Purpose Directory

**Project:** Madifor WebSBA (School Based Assessment & Grading Portal)  
**Maintained by:** Madifor Technologies  
**Root Directory:** `C:\Users\kpand\.gemini\antigravity\scratch\school-grading-app`

This document outlines the exact purpose, architectural role, dependencies, and functionality of every file and directory across the entire WebSBA codebase.

---

## Table of Contents
1. [Project Root & Configuration Files](#1-project-root--configuration-files)
2. [Backend Engine (`backend/`)](#2-backend-engine-backend)
3. [Static Assets (`public/`)](#3-static-assets-public)
4. [Automation & Maintenance Scripts (`scripts/`)](#4-automation--maintenance-scripts-scripts)
5. [Core Frontend Application (`src/`)](#5-core-frontend-application-src)
6. [UI Components (`src/components/`)](#6-ui-components-srccomponents)
7. [Constants & Presets (`src/constants/`)](#7-constants--presets-srcconstants)
8. [Utilities & Helper Modules (`src/utils/`)](#8-utilities--helper-modules-srcutils)

---

## 1. Project Root & Configuration Files

| File Name | Purpose & Functionality |
| :--- | :--- |
| **`package.json`** | Defines Node.js project metadata, npm scripts (`dev`, `build`, `lint`, `preview`), and all production dependencies (React 18, Vite, Tailwind CSS, Firebase 10+, ExcelJS, Lucide React, Chart.js). |
| **`package-lock.json`** | Exact dependency tree lockfile ensuring reproducible builds across all development and production environments. |
| **`vite.config.js`** | Configures the Vite bundler, React plugin integration, local development server port, and build chunking optimization settings. |
| **`tailwind.config.js`** | Configures Tailwind CSS design tokens, custom font families, color palettes (including the signature `emerald-ink` theme), and class-based Dark Mode. |
| **`postcss.config.js`** | Configures the PostCSS pipeline for Tailwind CSS and Autoprefixer to ensure cross-browser CSS compatibility. |
| **`firestore.rules`** | Cloud Firestore Security Rules enforcing multi-tenant data isolation. Ensures teachers can only read/write documents associated with their assigned `institutionId`. |
| **`firebase.json`** | Firebase CLI configuration specifying target project settings, Firestore rules path, and deployment options. |
| **`.firebaserc`** | Stores Firebase project alias mappings (`default` project pointing to `school-grading-app`). |
| **`.env`** | Environment variables containing Firebase API keys, project IDs, storage bucket URIs, and backend endpoint URLs. |
| **`index.html`** | Single Page Application (SPA) HTML entry point. Configures mobile viewport meta tags, web fonts, favicon (`/icon.png`), and mounts the React root DOM element (`#root`). |
| **`vercel.json`** | Vercel platform deployment configuration containing URL rewrites (`"source": "/(.*)", "destination": "/index.html"`) to support client-side React routing. |
| **`requirements.txt`** | Python backend dependency manifest listing `fastapi`, `uvicorn`, `slowapi`, `google-genai`, `pandas`, and `openpyxl`. |
| **`run-backup.bat`** | Windows Batch script designed to trigger the automated database backup script via Task Scheduler or manual execution. |
| **`register_admin.js`** | Standalone Node.js CLI script for bootstrapping and provisioning initial Senior Super User / Admin accounts in Firebase. |
| **`list_models.js`** | Node.js diagnostic script to query and list available Google Gemini models via `@google/genai`. |

---

## 2. Backend Engine (`backend/`)

The Python backend provides computational horsepower for AI reasoning and high-throughput data operations.

| File Name | Purpose & Functionality |
| :--- | :--- |
| **`backend/main.py`** | Primary FastAPI server application. Hosts the `/api/chat` streaming AI endpoint, `/api/data` sync endpoints, `/api/roster/import` Excel parser, and enforces IP-based rate limiting via SlowAPI. |
| **`backend/calculations_py.py`** | Python implementation of the standardized Ghanaian grading logic. Computes class scores, exam normalizations, 9-point scale grades, and rank vectors for the backend AI context. |
| **`backend/db.py`** | Lightweight JSON-based file persistence layer used for standalone local development and caching. |
| **`backend/test_rate_limit.py`** | Automated testing script that pings `/api/data` in rapid bursts to verify that SlowAPI correctly enforces HTTP 429 rate limits. |
| **`backend/update_main.py`** | Automation helper script used to patch and maintain rate-limiting decorators and middleware in `main.py`. |

---

## 3. Static Assets (`public/`)

Public files served directly by the web server at the root URL.

| File Name | Purpose & Functionality |
| :--- | :--- |
| **`public/icon.png`** | The official compressed **Madifor Technologies** logo asset used in navigation bars, browser favicons, and loading screens. |
| **`public/anglican-crest.png`** | High-resolution Anglican Educational Unit crest used as the default crest for Anglican school report cards. |
| **`public/ghana-coa.svg`** | Vector Ghana Coat of Arms used in official report card headers and broadsheets. |

---

## 4. Automation & Maintenance Scripts (`scripts/`)

| File Name | Purpose & Functionality |
| :--- | :--- |
| **`scripts/backup.js`** | Automated disaster recovery engine. Queries all Firestore collections (`institutions`, `teachers`, `schools`) and mirrors them into Supabase PostgreSQL and local JSON archives. |
| **`scripts/install-backup-task.ps1`** | PowerShell script that automatically registers `scripts/backup.js` as a daily background task in Windows Task Scheduler. |
| **`scripts/purge_data.js`** | Administrative data-hygiene script for cleaning up corrupted records, test institutions, or orphaned teacher documents in Firestore. |

---

## 5. Core Frontend Application (`src/`)

| File Name | Purpose & Functionality |
| :--- | :--- |
| **`src/main.jsx`** | React 18 client entry point. Mounts the `<App />` component into the DOM inside `React.StrictMode`. |
| **`src/App.jsx`** | Master application controller. Listens to Firebase Authentication state (`onAuthStateChanged`), handles multi-role routing (Teacher vs. Super Admin vs. Senior Super User), manages active terms, and handles global theme state. |
| **`src/index.css`** | Global Tailwind styles, custom dark-mode scrollbars, glassmorphism utilities (`.glass-card`), and `@media print` CSS rules for clean paper report card printing. |

---

## 6. UI Components (`src/components/`)

Modular, reusable React UI views and panels.

| Component | Purpose & Features |
| :--- | :--- |
| **`Login.jsx`** | Multi-role login screen. Features email/password authentication, password reset modal flow, 5-strike brute-force lockout with live countdown, and Senior Super User onboarding. |
| **`SeniorSuperUserPanel.jsx`** | System owner dashboard (Madifor Admin). Allows registering new schools, generating synthetic demo schools with bell-curve marks, cascading school deletions, and system health monitoring. |
| **`AdminPanel.jsx`** | Headmaster / Principal portal. Manages teacher accounts, assigns classes/subjects, sets active terms and reopening dates, and provides read-only broadsheet inspection across all classes. |
| **`Dashboard.jsx`** | Main teacher workspace hub. Displays KPI cards, class quick stats, and provides tabbed navigation between Roster, Gradebook, Records, Reports, and Overview. |
| **`Gradebook.jsx`** | Interactive spreadsheet-like mark entry grid. Calculates 50% Class SBA and 50% Exam conversions in real-time as teachers type. Supports keyboard navigation and auto-saving. |
| **`Roster.jsx`** | Student enrollment register. Manages student names, sequential numbers (SN), and gender. Supports bulk import from Excel/Word and student removal. |
| **`ConsolidatedView.jsx`** | Master Broadsheet view merging all class subjects into a single panoramic table with Grand Totals, Class Averages, and dense position rankings. |
| **`ConsolidatedRecords.jsx`** | Alternative lightweight consolidated records view for quick reference and printing. |
| **`ReportEditor.jsx`** | Qualitative assessment editor. Enables teachers to assign Attendance, Conduct, Interest, Class Teacher Remarks, and Promotion recommendations using quick-select dropdowns. |
| **`ReportCard.jsx`** | Printable student terminal report card component. Formats single or bulk report cards with dynamic school crests, attendance summaries, subject grades, and headmaster signatures. |
| **`TrendAnalysis.jsx`** | Analytical view displaying visual charts (Radar and Bar) to compare subject performance across terms and identify student learning gaps. |
| **`AnalyticsCharts.jsx`** | Chart.js wrapper rendering interactive performance curves, pass-rate gauges, and subject distribution bars. |
| **`AnalyticsReportPrintLayout.jsx`** | High-density print template for printing complete class analytics summaries for staff meetings and PTA conferences. |
| **`ChatPanel.jsx`** | Embedded AI Teaching Assistant powered by Google Gemini. Supports conversational analytics on class data with streaming text and expandable thought tags. |
| **`DropLists.jsx`** | Configuration modal allowing teachers and administrators to customize their remark and conduct dropdown phrase libraries. |

---

## 7. Constants & Presets (`src/constants/`)

| File Name | Purpose & Functionality |
| :--- | :--- |
| **`src/constants/dropList.js`** | Standardized phrase libraries for Conduct (e.g., *"Hardworking and obedient"*), Interest (e.g., *"Reading and Sports"*), and Headmaster / Teacher Remarks. |

---

## 8. Utilities & Helper Modules (`src/utils/`)

| File Name | Purpose & Functionality |
| :--- | :--- |
| **`src/utils/calculations.js`** | Core client-side mathematical engine. Implements standard 50/50 SBA/Exam weightings, 9-point scale grade conversions, subject remarks, and dense class rank algorithms. |
| **`src/utils/firebase.js`** | Initializes Firebase SDK, exports Firestore database references (`db`), auth instances (`auth`), and provides secondary app factories (`createTeacherUser`, `deleteTeacherAccount`). |
| **`src/utils/excelExport.js`** | Generates professional `.xlsx` workbooks using `exceljs`. Applies custom brand colors, borders, formulas, and embeds school crests for download. |
| **`src/utils/aiTranscriber.js`** | Audio and speech-to-text integration module enabling teachers to dictate student grades by voice. |
| **`src/utils/aiSummary.js`** | Prepares and serializes structured class gradebooks into optimized JSON payloads for Gemini AI prompt ingestion. |
| **`src/utils/docxGenerator.js`** | Generates Microsoft Word (`.docx`) report card and broadsheet documents. |
| **`src/utils/docxParser.js`** | Parses uploaded `.docx` student lists and extracts student names and numbers for instant roster population. |

---

*Compiled and verified for the Madifor WebSBA project.*
