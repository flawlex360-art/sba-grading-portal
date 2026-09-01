# Madifor WebSBA: Master System Documentation

**Brand:** Madifor Technologies  
**Project:** WebSBA School-Based Assessment & Grading Portal  
**Contact:** `system@flawlex.com` | `(0592664865)`  
**Deployment Platform:** Vercel (Frontend) & FastAPI (Backend Analytics/AI Engine)  
**Database Infrastructure:** Google Cloud Firestore (Primary) & Supabase PostgreSQL (Disaster Recovery)

---

## 1. Executive Summary & Vision

The **Madifor WebSBA** is an enterprise-grade, multi-tenant School-Based Assessment (SBA) and terminal reporting ecosystem engineered to digitize, automate, and elevate academic grading workflows for educational institutions.

Rather than relying on fragile desktop spreadsheets or tedious manual mark-sheets, WebSBA provides:
1. **Real-time cloud grade synchronization** across all class and subject teachers.
2. **Standardized Ghanaian / West African Curriculum grading logic** (converting raw continuous assessment scores, homework, projects, and end-of-term exams into automated 9-point scale grades and standard remarks).
3. **Multi-tenant institutional isolation** (allowing hundreds of independent schools to operate on a single secure infrastructure with unique crests, terms, and branding).
4. **Intelligent automated broadsheets & printable terminal reports** that eliminate arithmetic errors and cross-referencing delays.
5. **AI-driven conversational analytics & visual diagnostic charts** powered by Google Gemini to analyze student progress and spot learning deficiencies.
6. **Hardened enterprise security** featuring zero plaintext credential exposure, API rate limiting, brute-force UI lockouts, and secondary database disaster recovery backups.

---

## 2. Technical Stack & Architectural Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          USER CLIENT (React + Vite)                    │
│  - Tailwind CSS Responsive Design (Mobile / Tablet / Desktop)          │
│  - Role-Based Dynamic Dashboards                                       │
│  - Offline-resilient local calculations & client-side ExcelJS exports  │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ HTTPS                           │ REST / SSE
┌──────────────────▼──────────────────┐   ┌──────────▼───────────────────┐
│     Google Firebase Platform        │   │    Python FastAPI Backend    │
│  - Firebase Authentication          │   │  - Google Gemini 3.5 Flash   │
│  - Cloud Firestore (Real-time DB)   │   │  - SlowAPI Rate Limiter      │
│  - Granular Security Rules          │   │  - Data Science Calculations │
└──────────────────┬──────────────────┘   └──────────────────────────────┘
                   │ Automated Cron / Service
┌──────────────────▼──────────────────┐
│   Disaster Recovery & Redundancy    │
│  - Supabase PostgreSQL Dual Sync    │
│  - Automated JSON Snapshot Engine   │
└─────────────────────────────────────┘
```

### Core Technologies
* **Frontend Framework:** React 18+ with Vite for sub-second hot reloading and optimized production bundles.
* **Styling & Design System:** Tailwind CSS with full Dark Mode and Light Mode support, custom emerald ink themes, and print-specific CSS media queries.
* **Icons & Visuals:** Lucide React icons, Chart.js, Lucide SVG assets.
* **Primary Database:** Google Cloud Firestore (NoSQL Document Store with real-time listeners).
* **Authentication:** Google Firebase Auth with secure token exchange, automated password reset flows, and brute-force throttling.
* **AI Engine:** Google Gemini API (`gemini-3.5-flash`) streaming reasoning and structured insights via Server-Sent Events (SSE).
* **Excel & Office Engine:** `exceljs` and `docx` for generating formatted broadsheets with embedded crests, cell borders, and custom typography.
* **API Security & Rate Limiting:** `slowapi` with IP-based token buckets protecting backend computation and AI endpoints.

---

## 3. User Roles & Hierarchical Access Model

The system enforces strict 4-tier role-based access control (RBAC):

```
┌────────────────────────────────────────────────────────┐
│     Level 1: Senior Super User (Madifor Admin)         │  <- Platform Owner
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Level 2: Regional / Unit Director (Supervisory)        │  <- Monitors multiple schools
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Level 3: School Super Admin (Headmaster / Principal)   │  <- Manages single institution
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Level 4: Class & Subject Teachers                      │  <- Input & manage marks
└────────────────────────────────────────────────────────┘
```

### Tier 1: Senior Super User (Platform Administration)
* **Account:** Dedicated system account (`system@flawlex.com`).
* **Capabilities:**
  * Register new institutional tenants with custom School Names, Admin Super User emails, and Crest URLs.
  * Configure academic years and initial active terms.
  * Instant **Demo School Generator** (provisions synthetic schools with bell-curve grade distributions for onboarding).
  * Institution-level cascading purge and deletion.
  * System-wide status monitoring.

### Tier 2: Regional / Unit Director (Supervisory Analytics)
* **Scope:** Educational Directorates (e.g. *Volta Region*, *Ho Municipal*, *Anglican Educational Unit*).
* **Capabilities:**
  * Multi-school comparative performance league tables.
  * Submission compliance tracking (identifying schools with pending vs. finalized submissions).
  * Regional subject diagnostic heatmaps.
  * Read-only drill-downs into school performance metrics without credential access.

### Tier 3: School Super Admin (Headmaster / Administrator)
* **Scope:** Dedicated to a single school tenant (`institutionId` sandbox).
* **Capabilities:**
  * Create, edit, and manage teacher accounts and assign specific classes (e.g. *Basic 7*, *Basic 8*, *Basic 9*).
  * Configure active academic terms, next term start dates, and school reopening metadata.
  * **Consolidated Master Broadsheet View:** Inspect full-school performance across every teacher in read-only mode.
  * Print consolidated class reports and student report cards.
  * Export yearly class data to styled Excel workbooks.

### Tier 4: Class & Subject Teachers
* **Scope:** Restricted to assigned class level and subjects.
* **Capabilities:**
  * **Roster Management:** Register learners with serial numbers, names, and gender (or import via Excel/Word).
  * **Gradebook Entry:** Enter raw scores across Group Work (20%), Class Tests (30%), Homework/Projects (30%), and End-of-Term Exams (100%).
  * **Consolidated Records:** View real-time calculated totals, class averages, and overall student ranks.
  * **Report Editor:** Customize qualitative evaluation (Attendance, Conduct, Interest, Remarks, Next Class Promotion).
  * **Single & Bulk Report Card Printing:** Generate ready-to-print official terminal report cards.
  * **AI Teaching Assistant:** Engage in context-aware conversations with Gemini AI regarding class statistics.

---

## 4. Academic Grading & Assessment Engine

The core calculation module (`src/utils/calculations.js` and `backend/calculations_py.py`) implements the standardized 50/50 Continuous Assessment model:

### Score Normalization Formula
$$\text{Class SBA (50\%)} = \left( \frac{\text{Test 1 (20)} + \text{Group Work (30)} + \text{Test 2 (20)} + \text{Project (30)}}{100} \right) \times 50$$

$$\text{Exams Score (50\%)} = \left( \frac{\text{Raw Exam Score}}{100} \right) \times 50$$

$$\text{Overall Total Score (100\%)} = \text{Class SBA (50\%)} + \text{Exams Score (50\%)}$$

### Standard 9-Point Scale & Descriptors
| Score Range (%) | Grade Number | Proficiency Level | Standard Descriptor |
| :--- | :---: | :--- | :--- |
| **80 – 100%** | **1** | Highest / Superior | Advanced |
| **70 – 79%** | **2** | Higher | Proficient |
| **65 – 69%** | **3** | High | Approaching Proficiency |
| **60 – 64%** | **4** | High Average | Developing |
| **55 – 59%** | **5** | Average | Developing |
| **50 – 54%** | **6** | Low Average | Emerging |
| **45 – 49%** | **7** | Lower | Emerging |
| **40 – 44%** | **8** | Low | Emerging |
| **0 – 39%** | **9** | Lowest | Needs Support |

### Position & Ranking Determination
* Evaluates total scores per subject and overall grand totals across all enrolled subjects.
* Implements standard dense fractional tie-breaking (e.g. ties share identical ranks: 1st, 2nd, 2nd, 4th).

---

## 5. Security Architecture & Threat Mitigation

1. **Zero Plaintext Credentials:**
   * Passwords are never written to Firestore documents or visible in admin tables. All authentication is strictly delegated to Firebase Auth salted hashes.
2. **API Rate Limiting (SlowAPI):**
   * Sensitive backend routes (`/api/data`, `/api/chat`) enforce IP-based rate limiting (10 req/min for general data, 5 req/min for LLM chat) returning HTTP 429 upon abuse.
3. **Frontend Brute-Force Lockout:**
   * 5 failed login attempts trigger an immediate 60-second UI lockout with live countdown and disabled button states.
4. **Tenant Isolation Rules (Firestore):**
   * Firestore security rules enforce strict tenancy boundaries where teachers can only read/write documents bearing their matching `institutionId`.

---

## 6. Disaster Recovery & Backup System

* **Daily Automated Sync:** A background Node.js task (`scripts/backup.js`) snapshots the entire Firestore database and uploads structured JSON dumps and PostgreSQL table syncs to Supabase.
* **Self-Healing Schemas:** If a document structure is missing non-critical fields, the frontend dynamically polyfills default data structures to prevent application crashes.

---

*Documentation maintained by Madifor Technologies.*
