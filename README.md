# AI-Based Personalized Learning Platform (NEET, JEE, CET)

Full-stack personalized exam preparation platform with AI-assisted doubt resolution, adaptive learning features, and a dedicated admin portal.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite + React Router v6 + Recharts |
| **Backend** | Node.js + Express + MongoDB + Mongoose + JWT + PDFKit |
| **AI Tutor** | Google Gemini API (`@google/genai`) — streaming, server-side only |
| **ML Service** | Python + Flask + scikit-learn + NumPy |
| **Testing** | Jest + Supertest + mongodb-memory-server (backend) · Vitest + Testing Library (frontend) |
| **Security** | Helmet · express-rate-limit · express-mongo-sanitize · bcryptjs |

---

## Features

### Student-Facing
1. **User Authentication** — Register, login, profile via JWT (Bearer token)
2. **Question Bank** — Exam-wise (NEET/JEE/CET), subject-topic hierarchical question sets
3. **Practice Quiz Flow** — Per-question attempt submission with correctness and explanation feedback
4. **Ask with AI (AI Tutor)** — Streaming Gemini-powered doubt-resolution sidebar on the Practice Page; multi-turn conversation scoped to the currently attempted question
5. **Performance Tracking** — Accuracy, attempt count, and time-per-topic persistence
6. **Weak Topic Detection** — Threshold-based identification of underperforming topics
7. **Personalized Recommendations** — ML-driven suggestions with rule-based fallback
8. **Analytics Dashboard** — Charts (Recharts) for per-subject and per-topic performance
9. **Exam Simulation** — Full-length and section-wise mock tests with real-time answer saving
10. **Exam Scoring** — NEET/JEE marking scheme (+4/−1/0), percentile estimate, rank range
11. **Post-Exam Intelligence** — Adaptive follow-up study plan generated from exam results
12. **Exam Report & Certificate Download** — PDF export of exam results and completion certificate
13. **Mistake Bank** — Persistent log of incorrect answers with spaced-repetition scheduling (3 stages)
14. **Weak Topics Page** — Dedicated view of low-accuracy topics with drill-down
15. **Study Plan Page** — AI-generated prioritised study schedule
16. **Achievements Page** — Milestone and badge tracking
17. **Flashcards** — Lightweight review interface
18. **Session Summary** — Post-practice session breakdown
19. **Profile Page** — User stats, target exam, and account settings

### Admin Portal
20. **Admin Login** — Separate admin authentication flow (`/admin/login`)
21. **Admin Dashboard** — Platform-wide stats overview
22. **Student Management** — List all students, drill into individual student detail
23. **Question Bank CRUD** — Create, read, update, and delete questions
24. **Subjects & Topics Catalog** — Read-only subject overview; full CRUD on topics via `TopicMeta`
25. **Exam Session Monitoring** — Read-only list and detail view of all exam sessions
26. **Admin Analytics** — Platform-wide analytics section
27. **Product Event Tracking** — Internal telemetry for key user actions

---

## Project Structure

```
ai-based-personalized-learning-platform/
├── frontend/               # React + Vite SPA (dark-mode glass/aurora theme)
│   └── src/
│       ├── pages/          # Route-level page components
│       │   ├── (16 student pages)
│       │   └── admin/      # 10 admin portal pages
│       ├── components/     # Layout, AdminLayout, ProtectedRoute, AISidebar,
│       │   │               # AIChatMessage, BrandLogo, EmptyState, Footer,
│       │   │               # PasswordField, ResultIcons
│       │   └── landing/    # AiNetworkHero, DashboardPreview, RecommendationCard,
│       │                   # FaqAccordion, PriceCounter, Reveal, icons
│       ├── api/            # Axios API clients (client.js, examClient.js)
│       ├── context/        # AuthContext, ThemeContext (dark-only), ToastContext
│       ├── hooks/          # useMagneticHover, useScrollReveal
│       ├── styles/         # Style modules:
│       │   ├── features/   # admin.css, ai-tutor.css, analytics.css, app-shell.css,
│       │   │               # dashboard.css, exam.css, landing.css, practice.css,
│       │   │               # profile.css, subpages.css
│       │   ├── components.css
│       │   └── global.css
│       └── utils/          # Shared utilities
├── backend/                # Node.js REST API
│   ├── src/
│   │   ├── controllers/    # 15 route handlers (auth, questions, attempts, analytics,
│   │   │                   # exam, examReport, recommendation, ai, admin × 7)
│   │   ├── models/         # 9 Mongoose models — see Database Models
│   │   ├── routes/         # 8 Express routers (auth, questions, attempts, analytics,
│   │   │                   # recommendations, exams, admin, ai)
│   │   ├── services/       # 14 service modules — see Service Layer
│   │   │   └── ai/         # aiService.js, geminiService.js
│   │   ├── middleware/     # authMiddleware, errorMiddleware, validateObjectIdParam
│   │   ├── config/         # DB connection
│   │   ├── assets/         # Static backend assets
│   │   ├── data/           # Seed/reference data
│   │   └── utils/
│   ├── seedQuestions.js    # Question bank seed script
│   ├── seedDemo.js         # Demo user + data seed script
│   ├── seedAdmin.js        # Admin user seed script
│   └── resetDemo.js        # Demo data reset script
├── ml-service/             # Python Flask microservice
│   ├── app.py              # /health + /analyze endpoints (port 8000)
│   ├── services/
│   │   └── analyzer.py     # scikit-learn weak-topic ranking
│   └── requirements.txt
└── package.json            # Monorepo root — concurrently dev script
```

---

## Quick Start (All Services)

> Prerequisites: Node.js ≥ 18, MongoDB running locally, Python ≥ 3.10 with a virtual environment

```bash
# 1. Install root concurrently dependency
npm install

# 2. Install backend and frontend dependencies
npm --prefix backend install
npm --prefix frontend install

# 3. Configure environment files
cp backend/.env.example backend/.env   # then edit backend/.env

# 4. Seed the question bank (first-time only)
npm run seed

# 5. Start all three services in parallel
npm run dev
```

Individual service commands:

```bash
npm run dev:backend    # Backend only  (port 5000)
npm run dev:frontend   # Frontend only (port 5173)
npm run dev:ml         # ML service only (port 8000)
```

> **Note**: The `dev:ml` script uses a hardcoded `.venv` Python path in `package.json`. Update this to match your local virtual environment location, or activate your `.venv` manually and run `python ml-service/app.py` directly.

---

## Backend Setup

1. `cd backend`
2. `npm install`
3. Copy `.env.example` → `.env` and fill in values (see below)
4. `npm run seed` or `npm run seed:questions` — populate the question bank
5. `npm run seed:demo` — (optional) load a demo user with pre-built data
6. `npm run seed:admin` — (optional) seed an admin account
7. `npm run dev` — start with nodemon

To reset demo data: `npm run reset:demo`

### Environment Variables (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Backend HTTP port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/learning_platform` | MongoDB connection string |
| `JWT_SECRET` | — | Strong secret for signing JWTs |
| `JWT_EXPIRES_IN` | `7d` | JWT lifetime |
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` | Flask ML service base URL |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `GEMINI_API_KEY` | — | Google Gemini API key for the AI Tutor feature. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Optional — the Practice Page "Ask with AI" sidebar is disabled when absent. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Gemini model to use. Flash-Lite is recommended on the free tier (~500 req/day vs ~20 for full Flash). |
| `ADMIN_EMAIL` | `admin@learning.com` | Admin account email — created/updated automatically on server start |
| `ADMIN_PASSWORD` | `change_me_before_using` | Admin account password (bcrypt-hashed, never stored in plaintext) |
| `ADMIN_NAME` | `Platform Admin` | Display name for the admin account |

---

## Frontend Setup

1. `cd frontend`
2. `npm install`
3. Copy `.env.example` → `.env`
4. `npm run dev` — start Vite dev server at `http://localhost:5173`

### Pages / Routes

#### Student Routes

| Route | Page | Auth |
|---|---|---|
| `/` | Home / Landing | Public |
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/dashboard` | Dashboard | ✅ |
| `/practice` | Practice Quiz (+ AI Tutor sidebar) | ✅ |
| `/analytics` | Analytics & Charts | ✅ |
| `/profile` | User Profile | ✅ |
| `/exam-simulation` | Exam Simulation | ✅ |
| `/exam-simulation/result` | Exam Results | ✅ |
| `/session-summary` | Session Summary | ✅ |
| `/weak-topics` | Weak Topics | ✅ |
| `/study-plan` | Study Plan | ✅ |
| `/mistake-bank` | Mistake Bank | ✅ |
| `/flashcards` | Flashcards | ✅ |
| `/achievements` | Achievements | ✅ |
| `/admin-analytics` | Admin Analytics (legacy) | ✅ Admin only |

#### Admin Portal Routes

| Route | Page | Auth |
|---|---|---|
| `/admin/login` | Admin Login | Public |
| `/admin` | Admin Dashboard | ✅ Admin only |
| `/admin/students` | Student List | ✅ Admin only |
| `/admin/students/:id` | Student Detail | ✅ Admin only |
| `/admin/questions` | Question Bank | ✅ Admin only |
| `/admin/subjects` | Subjects Overview | ✅ Admin only |
| `/admin/topics` | Topics CRUD | ✅ Admin only |
| `/admin/exams` | Exam Sessions | ✅ Admin only |
| `/admin/exams/:id` | Exam Session Detail | ✅ Admin only |
| `/admin/analytics` | Platform Analytics | ✅ Admin only |

The admin portal uses a dedicated `AdminLayout` shell (sidebar navigation), completely separate from the student `Layout`. Route-based lazy loading is used for all pages — the public landing page is the only module in the initial bundle.

---

## ML Service Setup

1. `cd ml-service`
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   ```
3. `pip install -r requirements.txt`
4. `python app.py` — starts on port 8000

### ML Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/analyze` | Accepts `{ attempts: [...] }`, returns weak-topic ranking |

> The backend recommendation endpoint gracefully falls back to rule-based logic when the ML service is unavailable.

---

## Core API Endpoints

### Auth (`/api/auth`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/register` | Create account |
| `POST` | `/login` | Authenticate, receive JWT |
| `GET` | `/profile` | Get current user profile (protected) |

### Questions (`/api/questions`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/subjects-topics` | List all subjects and their topics |
| `GET` | `/` | Fetch questions (filter by exam, subject, topic, difficulty) |

### Attempts (`/api/attempts`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Submit a practice attempt |
| `GET` | `/me` | Get current user's attempt history |

### Analytics (`/api/analytics`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/me` | Per-topic performance stats for current user |

### Recommendations (`/api/recommendations`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/me` | ML-backed personalized topic recommendations |

### AI Tutor (`/api/ai`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/explain` | Streams a Gemini-powered doubt-resolution reply (SSE) for the currently attempted question. Protected. Rate-limited to 40 req / 15 min. |

### Exam Simulation (`/api/exams`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/sessions` | Start a new exam session |
| `GET` | `/sessions/active/latest` | Fetch the latest active session |
| `GET` | `/sessions/:sessionId` | Get session state |
| `PATCH` | `/sessions/:sessionId/answer` | Save an answer for a question |
| `POST` | `/sessions/:sessionId/submit` | Finalise and score the exam |
| `GET` | `/sessions/:sessionId/report` | Download exam report as PDF |
| `GET` | `/sessions/:sessionId/certificate` | Download completion certificate as PDF |

### Admin (`/api/admin`) — admin role required
| Method | Path | Description |
|---|---|---|
| `POST` | `/login` | Admin authentication |
| `GET` | `/me` | Admin profile |
| `GET` | `/dashboard` | Platform dashboard stats |
| `GET` | `/students` | List all students |
| `GET` | `/students/:id` | Student detail |
| `GET` | `/questions` | List questions (filterable) |
| `GET` | `/questions/:id` | Get single question |
| `POST` | `/questions` | Create question |
| `PUT` | `/questions/:id` | Update question |
| `DELETE` | `/questions/:id` | Delete question |
| `GET` | `/subjects` | Subjects overview |
| `GET` | `/topics` | List topics |
| `POST` | `/topics` | Create topic |
| `PUT` | `/topics/:id` | Update topic |
| `DELETE` | `/topics/:id` | Delete topic |
| `GET` | `/exams` | List exam sessions |
| `GET` | `/exams/:id` | Exam session detail |
| `GET` | `/analytics` | Platform-wide analytics |
| `GET` | `/question-stats` | Question bank statistics |
| `GET` | `/exam-subjects` | Subject breakdown per exam type |

### Health
| Method | Path |
|---|---|
| `GET` | `/api/health` |

---

## Security

- **Helmet** — sets secure HTTP response headers
- **CORS** — restricted to `CLIENT_URL` origins only (no wildcard + credentials)
- **Rate limiting** — 300 req/15 min general API throttle; 20 req/15 min on `/auth/login` and `/auth/register`; 40 req/15 min on `/api/ai` (Gemini quota protection)
- **Exam-session rate limiting** — per-session, per-question throttle with 3-second cooldown on 429; no infinite retry loops
- **express-mongo-sanitize** — strips `$`/`.` keys from request input to block NoSQL injection
- **bcryptjs** — password hashing
- **JWT** — stateless auth via `Authorization: Bearer <token>` header

---

## Database Models

| Model | Purpose |
|---|---|
| `User` | Account, role (`user`/`admin`), target exam |
| `Question` | Question bank — exam, subject, topic, options, answer, explanation |
| `Attempt` | Individual practice attempt record |
| `Performance` | Aggregated per-topic metrics (accuracy, attempts, avg time) |
| `TopicMeta` | Topic catalog for admin management (subjects/topics metadata) |
| `ExamSession` | Full mock exam state — questions, answers, timing, scoring |
| `ExamAuditLog` | Immutable per-answer audit trail for exam integrity |
| `Mistake` | Mistake bank with spaced-repetition fields (3 review stages) |
| `ProductEvent` | Internal telemetry events |

---

## Service Layer

| Service | Responsibility |
|---|---|
| `examSimulationService` | Core exam session lifecycle, scoring, state reconciliation |
| `recommendationService` | ML-backed + rule-based topic recommendations |
| `analyticsService` | Per-topic and platform analytics aggregation |
| `analysisService` | Post-exam intelligence and adaptive study plan generation |
| `feedbackService` | Practice attempt feedback and explanation delivery |
| `performanceService` | Attempt-to-performance aggregation writes |
| `progressTracker` | Milestone and achievement tracking |
| `adaptiveDifficultyService` | Dynamic question difficulty adjustment |
| `eventTrackingService` | Product event telemetry |
| `productSignalsService` | Aggregated product signal computation |
| `examDownloadService` | PDF report and certificate generation (PDFKit) |
| `mlClient` | HTTP client for the Flask ML microservice |
| `aiService` | Streaming doubt-resolution chat orchestration (question context + conversation history) |
| `geminiService` | Low-level Google Gemini API client — SSE streaming, error translation, quota handling |

---

## Testing

### Backend (Jest + Supertest)

Tests run against an in-memory MongoDB instance — no external database required.

```bash
npm --prefix backend run test
# or from the monorepo root:
npm run test:backend
```

| Test File | Coverage Area |
|---|---|
| `api.test.js` | Basic route smoke tests |
| `exam.simulation.test.js` | Full exam session lifecycle |
| `exam.intent.ordering.test.js` | Question ordering and intent logic |
| `intelligence.validation.test.js` | Scoring and intelligence analysis |
| `intelligence.adversarial.test.js` | Adversarial / edge-case scenarios |

### Frontend (Vitest + Testing Library)

```bash
npm --prefix frontend run test
# watch mode:
npm --prefix frontend run test:watch
```

---

## CI Pipeline

- **Workflow**: `.github/workflows/backend-ci.yml`
- Triggers on push and pull request to `main`/`master`
- Steps: install backend dependencies → run backend test suite

---

## Notes

- **AI Tutor** (`Ask with AI`): Available in the Practice Page sidebar. Uses Google Gemini (Flash-Lite by default) for streaming, multi-turn doubt resolution scoped to the currently attempted question. The sidebar renders as a portal to `document.body` to escape the app shell's stacking context. When `GEMINI_API_KEY` is absent or the Gemini service is unreachable, the feature degrades gracefully without affecting the rest of the platform.
- The ML layer uses classical scikit-learn models and heuristic scoring rather than deep learning — intentional for lightweight deployment.
- Exam simulation includes full state-reconciliation on session restore (handles page refresh mid-exam).
- The `ExamSimulationPage` uses an explicit `selectedOptionMap` / `confirmedOptionMap` / `cooldownMap` architecture to prevent selection corruption and infinite retry loops on rate-limited saves.
- Route-based code splitting ensures the initial JS bundle only contains the public landing page; the admin portal is entirely split from student-facing bundles.
- The admin portal has its own separate authentication (`/admin/login`) and layout (`AdminLayout` with sidebar), isolated from the student shell.
- PDF reports and certificates are generated server-side via PDFKit and streamed directly to the client.
- The UI is dark-mode only — the entire design (including the landing page) uses a dark glass/aurora aesthetic. `ThemeContext` always applies `data-theme="dark"` and exposes `theme: 'dark'` to consumers.
