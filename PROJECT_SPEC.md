# Smart Secure Academic ERP System — Project Specification

> **Source of truth** for all architecture, requirements, and development decisions on this project.  
> Treat this document as authoritative unless explicitly overridden by the project owner.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [User Roles](#4-user-roles)
5. [Project Modules (Phases)](#5-project-modules-phases)
6. [Phase 1 — Attendance System](#6-phase-1--attendance-system)
7. [Face Verification](#7-face-verification)
8. [Attendance Security](#8-attendance-security)
9. [Phase 2 — Quiz System](#9-phase-2--quiz-system)
10. [Phase 3 — Grading System](#10-phase-3--grading-system)
11. [Phase 4 — Assignment System](#11-phase-4--assignment-system)
12. [Database](#12-database)
13. [Coding Standards](#13-coding-standards)
14. [Repository Structure](#14-repository-structure)
15. [Environment Configuration](#15-environment-configuration)
16. [Local Development Setup](#16-local-development-setup)
17. [API Surface (Current)](#17-api-surface-current)
18. [Implementation Status & Known Gaps](#18-implementation-status--known-gaps)
19. [Out of Scope (Do Not Implement Unless Asked)](#19-out-of-scope-do-not-implement-unless-asked)
20. [Engineering Principles](#20-engineering-principles)

---

## 1. Project Overview

**Project Name:** Smart Secure Academic ERP System  
**Repository folder:** `AcadTrack`

### Purpose

This project is developed as part of a **research internship in Cryptography and Network Security**. The Academic ERP itself is **not** the research contribution — it serves as the **base platform** on which various security mechanisms and cryptographic protocols will later be implemented and evaluated.

### Design Priorities

Every design decision should prioritize:

1. **Modularity** — independent, reusable modules
2. **Security** — role-based access, secure auth, minimal data retention
3. **Extensibility** — ready for future cryptographic/security layers

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js, React, Tailwind CSS |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL (hosted on Render) |
| **Authentication** | JWT, bcrypt |
| **Face Verification** | Python DeepFace microservice (separate process, REST only) |
| **Image Storage** | Cloudinary (reference face images only) |

### Development Style

- Modular architecture
- REST APIs
- Clean folder structure
- `async/await`
- Proper error handling
- Input validation

---

## 3. System Architecture

```
Next.js Frontend
        ↓  REST
Node.js Express Backend
        ↓  REST                    ↓
Python DeepFace Service      PostgreSQL (Render)
        ↓
Cloudinary (reference images)
```

### Data Flow Rules

| Data | Storage |
|------|---------|
| Student reference face images | Cloudinary |
| Facial embeddings | PostgreSQL (`students.face_embeddings`) |
| Attendance verification selfies | **Temporary only — never permanently stored** |
| Assignment files | Cloudflare R2 (current implementation extension) |

### Critical Constraint

**Node.js must NEVER execute DeepFace directly.** All face detection, embedding generation, and verification must go through the Python microservice over REST APIs.

---

## 4. User Roles

| Role | Access |
|------|--------|
| **Student** | Attendance, quizzes, grades, assignments |
| **Professor** | Lecture sessions, quiz/grade/assignment management, reports |

**Role-based access control (RBAC) is mandatory** on all protected routes.

---

## 5. Project Modules (Phases)

The project is divided into **four independent modules**. Each module should remain independent and reusable.

| Phase | Module | Status |
|-------|--------|--------|
| **Phase 1** | Attendance Management | Designed & largely implemented |
| **Phase 2** | Quiz System | Implemented |
| **Phase 3** | Grading System | Implemented |
| **Phase 4** | Assignment Management | Implemented |

### Supporting Infrastructure (beyond core spec)

The codebase also includes supporting modules not listed in the original four phases:

- Admin / semester management
- Course enrollment
- Class schedules & instances
- Semester registration

These are treated as **platform infrastructure** unless explicitly scoped out.

---

## 6. Phase 1 — Attendance System

### What Attendance Is NOT

- ❌ Single GPS check at start
- ❌ WiFi-based attendance

### What Attendance Uses

1. **GPS proximity** to professor (≤ 30 meters)
2. **Face verification** via DeepFace
3. **Continuous duration tracking** throughout the lecture

### Present Criteria

A student is marked **PRESENT** only if **all** of the following are true:

- Face verification succeeds at session start
- Student remains within **30 meters** of the professor
- Valid presence time ≥ **50%** of lecture duration

```
valid_time / lecture_duration >= 0.50  →  Present
otherwise                            →  Absent
```

### Attendance Workflow

```
Professor starts lecture
        ↓
Professor location continuously updates
        ↓
Student clicks "Start Attendance"
        ↓
Student location obtained (browser geolocation)
        ↓
GPS proximity checked (≤ 30 m)
        ↓
Live webcam opens
        ↓
Student captures live selfie
        ↓
Node backend forwards selfie to Python DeepFace service
        ↓
DeepFace verifies identity against stored embeddings
        ↓
If verified → Attendance session starts
        ↓
Student location updates every 10–15 seconds (spec)
        ↓
System accumulates valid presence time
        ↓
Student ends session → duration evaluated → Present / Absent
```

### Spec vs Current Implementation

| Requirement | Spec | Current Code |
|-------------|------|--------------|
| Student location ping | 10–15 s | **30 s** (`AttendanceTracker.js`) |
| Professor location ping | 10–15 s | **60 s** (`professor/dashboard/page.js`) |
| Proximity threshold | 30 m | ✅ 30 m |
| Duration threshold | 50% | ✅ 50% |

---

## 7. Face Verification

### Service

- **Independent Python microservice** (`python_service/app.py`)
- Runs on **port 5001**
- Model: **Facenet512** with cosine distance (threshold ~0.30)
- Legacy Keras forced via `TF_USE_LEGACY_KERAS=1`

### Registration Flow

```
Student captures 2–3 reference images
        ↓
Upload to Cloudinary
        ↓
Cloudinary URL returned to backend
        ↓
Backend calls Python /register-face with image URL
        ↓
DeepFace generates embedding
        ↓
Embedding appended to students.face_embeddings in PostgreSQL
```

### Attendance Verification Flow

```
Student captures live selfie (base64)
        ↓
Backend calls Python /verify-face
        ↓
DeepFace compares live embedding vs stored reference embeddings
        ↓
Returns: { verified, distance, confidence }
        ↓
Temporary selfie discarded — never stored
```

### Python API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/register-face` | Generate embedding from image URL or base64 |
| `POST` | `/verify-face` | Compare live selfie against reference embeddings |

### OpenCV Requirement

Use `opencv-python==4.11.0.86` (not 5.x). OpenCV 5.0+ omits Haar cascade files required by DeepFace on Python 3.13.

---

## 8. Attendance Security

### Current Implementation Focus

- Biometric verification (DeepFace)
- GPS validation (30 m radius)
- Continuous location tracking
- Session-based duration accumulation

### Future (Do NOT Implement Unless Explicitly Instructed)

- Campus WiFi validation
- Replay attack prevention
- Cryptographic packet authentication

---

## 9. Phase 2 — Quiz System

### Features

- Professor creates quizzes with questions
- Students attempt quizzes with timer
- Automatic evaluation on submission

### Anti-Cheat

| Mechanism | Behavior |
|-----------|----------|
| Fullscreen enforcement | Required before quiz starts |
| Tab-switch detection | Logged as violation |
| Fullscreen exit / window blur | Logged as violation |
| Violation tracking | Stored in `quiz_violations` |
| Auto-submit | After **3 violations** |

### Key Files

- Backend: `backend/src/controllers/quizController.js`, `backend/src/routes/quizRoutes.js`
- Frontend: `frontend/src/app/student/quiz/[id]/page.js`

---

## 10. Phase 3 — Grading System

### Features

- Professor uploads **Midsem** and **Endsem** marks
- Students view personal marks / gradesheets
- Professor dashboard analytics:
  - Class average
  - Highest / lowest
  - Top performers
  - Configurable grading schema & release workflow

### Key Files

- Backend: `backend/src/controllers/marksController.js`, `backend/src/utils/grading.js`
- Frontend: `frontend/src/app/student/gradesheets/page.js`

---

## 11. Phase 4 — Assignment System

### Features

- Professor creates assignments with deadlines
- Students upload **programming assignments** (file or pasted code)
- Late submission detection
- Code plagiarism detection

### Plagiarism Pipeline

```
Normalize code (strip comments, whitespace)
        ↓
Tokenize
        ↓
Generate k-grams
        ↓
Jaccard Similarity
        ↓
Similarity report (sorted by score)
```

### Constraints

- ❌ No handwritten OCR
- ❌ No AI plagiarism detection
- ✅ Programming code only

### Key Files

- Backend: `backend/src/controllers/assignmentController.js`, `backend/src/utils/plagiarism.js`
- Storage: Cloudflare R2 via `backend/src/config/s3.js`

---

## 12. Database

- **PostgreSQL** hosted on Render
- Normalized relational schema
- Foreign keys and referential integrity required
- Avoid redundant data

### Key Tables (Attendance)

| Table | Purpose |
|-------|---------|
| `students` | `face_embeddings` (JSONB), `profile_image_url`, `embedding_model` |
| `lecture_sessions` | Professor lecture start/end |
| `professor_location_pings` | Professor GPS during lecture |
| `attendance_sessions` | Student attendance session |
| `student_location_pings` | Student GPS during session |
| `attendance_records` | Final Present/Absent per date |
| `class_schedules` | Weekly schedule per subject |
| `class_instances` | Extra/cancelled class overrides |

### Schema Source

Canonical schema: `schema.sql`  
⚠️ **Note:** `schema.sql` currently has unresolved git merge conflicts and must be resolved before use.

---

## 13. Coding Standards

### Required Practices

- Production-quality code
- Business logic in **services** (target state)
- Controllers handle **request/response only** (target state)
- No duplicated code — use reusable utilities
- Proper input validation on all endpoints
- Scalable, maintainable code over clever shortcuts

### Current Architecture Gap

Controllers are currently thick (business logic + DB queries inline). The target state is to extract domain logic into `backend/src/services/` per module. Only `cloudinaryService.js` exists today; `grading.js` and `plagiarism.js` live in `utils/`.

### Rules for AI / Contributors

1. Do not deviate from this spec unless explicitly instructed
2. Do not rewrite existing architecture unless explicitly requested
3. Preserve compatibility with current project structure
4. Explain architectural changes and why they are beneficial
5. Ask clarifying questions before implementing ambiguous requirements

---

## 14. Repository Structure

```
AcadTrack/
├── PROJECT_SPEC.md          ← This file (source of truth)
├── README.md                ← Setup guide (has merge conflicts)
├── schema.sql               ← PostgreSQL schema (has merge conflicts)
│
├── frontend/                ← Next.js 14 App Router
│   └── src/
│       ├── app/
│       │   ├── login/       ← Auth pages
│       │   ├── register/
│       │   ├── student/     ← Student dashboard, courses, quiz, grades
│       │   ├── professor/   ← Professor dashboard, courses
│       │   └── admin/       ← Admin/semester management
│       ├── components/
│       │   ├── AttendanceTracker.js
│       │   ├── FaceRegistration.js
│       │   └── admin/
│       └── lib/
│           ├── api.js       ← Axios client
│           └── auth.js      ← Token helpers
│
├── backend/                 ← Express API
│   └── src/
│       ├── app.js           ← Route mounting
│       ├── config/          ← db.js, s3.js (R2)
│       ├── controllers/     ← Request handlers (9 controllers)
│       ├── middlewares/     ← auth.js, upload.js
│       ├── routes/          ← Route definitions (9 route files)
│       ├── services/        ← cloudinaryService.js
│       └── utils/           ← grading.js, plagiarism.js, uploadUtil.js
│
└── python_service/          ← DeepFace Flask microservice
    ├── app.py               ← Port 5001
    ├── requirements.txt
    └── .venv/               ← Python virtual environment
```

---

## 15. Environment Configuration

### Backend (`backend/.env`)

```env
PORT=5000
DATABASE_URL=postgres://user:password@host/dbname
JWT_SECRET=your_jwt_secret_key

# Cloudflare R2 (Assignment file storage)
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_BUCKET_NAME=acadtrack-bucket

# Cloudinary (Reference face images only)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Python DeepFace Microservice
PYTHON_SERVICE_URL=http://localhost:5001
```

⚠️ `backend/.env.example` has unresolved merge conflicts — use the block above as canonical.

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Python Service

- Python **3.10–3.12** recommended (3.13 works with pinned `opencv-python==4.11.0.86`)
- Virtual env: `python_service/.venv`
- Dependencies: `python_service/requirements.txt`

---

## 16. Local Development Setup

### Prerequisites

- Node.js v18+
- Python 3.10+ (3.13 supported with pinned OpenCV)
- PostgreSQL database (Render or local)
- Cloudinary account
- Cloudflare R2 bucket (for assignments)

### Startup Order

```bash
# 1. Database — apply schema.sql (after resolving conflicts)

# 2. Python microservice
cd python_service
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
python app.py                 # → http://localhost:5001

# 3. Backend
cd backend
npm install
npm run dev                   # → http://localhost:5000

# 4. Frontend
cd frontend
npm install
npm run dev                   # → http://localhost:3000
```

---

## 17. API Surface (Current)

### Authentication (`/auth`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register user `{ name, email, password, role, ... }` |
| `POST` | `/auth/login` | Login `{ email, password }` → `{ token, user }` |

### Attendance (`/attendance`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `POST` | `/attendance/register-face` | Student | Upload reference face, store embedding |
| `POST` | `/attendance/start` | Student | GPS + face verify, start session |
| `POST` | `/attendance/ping` | Student | Location heartbeat |
| `POST` | `/attendance/complete` | Student | End session, calculate Present/Absent |
| `POST` | `/attendance/professor/start` | Professor | Start lecture session |
| `POST` | `/attendance/professor/ping` | Professor | Professor location update |
| `POST` | `/attendance/professor/complete` | Professor | End lecture, auto-mark absents |
| `POST` | `/attendance/finalize` | Professor | Mark absent for non-attendees |
| `GET` | `/attendance/student/:id` | Student/Prof | Student attendance history |
| `GET` | `/attendance/subject/:id` | Professor | Subject attendance report |

### Quiz (`/quiz`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/quiz/create` | Create quiz |
| `GET` | `/quiz/:id` | Get quiz (answers hidden for students) |
| `POST` | `/quiz/submit` | Submit answers, auto-evaluate |
| `POST` | `/quiz/violation` | Record anti-cheat violation |

### Marks (`/marks`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/marks/upload` | Upload marks JSON array |
| `GET` | `/marks/student/:id` | Student marks |
| `GET` | `/marks/subject/:id` | Subject analytics |

### Assignment (`/assignment`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/assignment/create` | Create assignment |
| `POST` | `/assignment/submit` | Submit file (multipart), run plagiarism |
| `GET` | `/assignment/:id/submissions` | View submissions by similarity |

---

## 18. Implementation Status & Known Gaps

### ✅ Implemented

- JWT + bcrypt authentication with RBAC
- Attendance: GPS proximity, DeepFace verification, duration tracking
- Face registration with Cloudinary + embedding storage
- Quiz system with anti-cheat (fullscreen, tab-switch, auto-submit)
- Grading with analytics and release workflow
- Assignment upload with Jaccard plagiarism detection
- Python DeepFace microservice (Facenet512)
- Admin / semester / course / schedule infrastructure

### ⚠️ Known Gaps vs Spec

| Area | Gap |
|------|-----|
| Ping intervals | Student 30 s / Professor 60 s — spec requires 10–15 s |
| Service layer | Business logic in controllers; only `cloudinaryService.js` extracted |
| Session ownership | `pingSession` does not verify session belongs to requesting student |
| Embedding cap | UI limits 3 reference images; backend does not enforce server-side |
| Duration calc | First ping interval may not be counted in valid time |
| Merge conflicts | `schema.sql`, `README.md`, `backend/.env.example`, `backend/migrateNow.js` |
| Temp selfie cleanup | Relies on never persisting; no explicit deletion step documented in code |

### 🔧 Resolved Issues (Historical)

- OpenCV 5.0 missing Haar cascades → pinned to `opencv-python==4.11.0.86`
- Git merge conflicts in `package.json`, attendance routes/controllers (resolved)
- Node/Python not on system PATH on Windows (use full paths or add to PATH)

---

## 19. Out of Scope (Do Not Implement Unless Asked)

- Campus WiFi validation for attendance
- Replay attack prevention
- Cryptographic packet authentication
- Handwritten assignment OCR
- AI-based plagiarism detection
- Running DeepFace inside Node.js

---

## 20. Engineering Principles

When working on this project:

1. **Spec first** — every change must align with this document
2. **Modular** — keep the four phases independent
3. **Secure by default** — validate inputs, check ownership, minimize data retention
4. **Extend, don't rewrite** — preserve existing structure unless explicitly asked
5. **Explain tradeoffs** — when suggesting architectural changes, state why
6. **Ask before assuming** — clarify ambiguous requirements before coding

---

*Last updated: July 2026*
