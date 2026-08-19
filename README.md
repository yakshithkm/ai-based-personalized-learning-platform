# AI-Based Personalized Learning Platform (NEET, JEE, CET)

Full-stack personalized exam preparation platform with AI-assisted recommendations and adaptive learning features.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite + React Router v6 + Recharts |
| **Backend** | Node.js + Express + MongoDB + Mongoose + JWT |
| **ML Service** | Python + Flask + scikit-learn + NumPy |
| **Testing** | Jest + Supertest + mongodb-memory-server (backend) · Vitest + Testing Library (frontend) |
| **Security** | Helmet · express-rate-limit · express-mongo-sanitize · bcryptjs |

---

## Features

1. **User Authentication** — Register, login, profile via JWT (Bearer token)
2. **Question Bank** — Exam-wise (NEET/JEE/CET), subject-topic hierarchical question sets
3. **Practice Quiz Flow** — Per-question attempt submission with correctness and explanation feedback
4. **Performance Tracking** — Accuracy, attempt count, and time-per-topic persistence
5. **Weak Topic Detection** — Threshold-based identification of underperforming topics
6. **Personalized Recommendations** — ML-driven suggestions with rule-based fallback
7. **Analytics Dashboard** — Charts (Recharts) for per-subject and per-topic performance
8. **Exam Simulation** — Full-length and section-wise mock tests with real-time answer saving
9. **Exam Scoring** — NEET/JEE marking scheme (+4/−1/0), percentile estimate, rank range
10. **Post-Exam Intelligence** — Adaptive follow-up study plan generated from exam results
11. **Mistake Bank** — Persistent log of incorrect answers with spaced-repetition scheduling (3 stages)
12. **Weak Topics Page** — Dedicated view of low-accuracy topics with drill-down
13. **Study Plan Page** — AI-generated prioritised study schedule
14. **Achievements Page** — Milestone and badge tracking
15. **Flashcards** — Lightweight review interface
16. **Session Summary** — Post-practice session breakdown
17. **Profile Page** — User stats, target exam, and account settings
18. **Admin Analytics** — Admin-only dashboard for question bank stats and exam subject breakdown
19. **Product Event Tracking** — Internal telemetry for key user actions

---

## Project Structure

```
ai-based-personalized-learning-platform/
├── frontend/               # React + Vite SPA (dark responsive theme)
│   └── src/
│       ├── pages/          # Route-level page components (16 pages)
│       ├── components/     # Layout, ProtectedRoute, landing sections
│       ├── api/            # Axios API client
│       ├── context/        # Auth context
│       ├── hooks/          # Custom React hooks
│       ├── styles/         # Additional style modules
│       └── utils/          # Shared utilities
├── backend/                # Node.js REST API
│   └── src/
│       ├── controllers/    # Route handlers (auth, questions, attempts, analytics, exam, recommendations)
│       ├── models/         # Mongoose models (8 models — see Database Models)
│       ├── routes/         # Express routers (auth, questions, attempts, analytics, recommendations, exams, admin)
│       ├── services/       # Business logic (11 service modules)
│       ├── middleware/      # Auth guard, error handlers, rate limiters, ObjectId validation
│       ├── config/         # DB connection
│       └── utils/
├── ml-service/             # Python Flask microservice
│   ├── app.py              # /health + /analyze endpoints (port 8000)
│   ├── services/
│   │   └── analyzer.py     # scikit-learn weak-topic ranking
│   └── requirements.txt
├── package.json            # Monorepo root — concurrently dev script
├── seedQuestions.js        # Question bank seed script
└── seedDemo.js             # Demo user + data seed script
```

---

## Quick Start (All Services)

> Prerequisites: Node.js ≥ 18, MongoDB running locally, Python ≥ 3.10 with a virtual environment at `.venv/`

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

---

## Backend Setup

1. `cd backend`
2. `npm install`
3. Copy `.env.example` → `.env` and fill in values (see below)
4. `npm run seed` — populate the question bank
5. `npm run seed:demo` — (optional) load a demo user with pre-built data
6. `npm run dev` — start with nodemon

### Environment Variables (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Backend HTTP port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/learning_platform` | MongoDB connection string |
| `JWT_SECRET` | — | Strong secret for signing JWTs |
| `JWT_EXPIRES_IN` | `7d` | JWT lifetime |
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` | Flask ML service base URL |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |

---

## Frontend Setup

1. `cd frontend`
2. `npm install`
3. Copy `.env.example` → `.env`
4. `npm run dev` — start Vite dev server at `http://localhost:5173`

### Pages / Routes

| Route | Page | Auth |
|---|---|---|
| `/` | Home / Landing | Public |
| `/dashboard` | Dashboard | ✅ |
| `/practice` | Practice Quiz | ✅ |
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
| `/admin-analytics` | Admin Analytics | ✅ Admin only |

Route-based lazy loading is used for all authenticated pages — the public landing page is the only module in the initial bundle.

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

### Exam Simulation (`/api/exams`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/sessions` | Start a new exam session |
| `GET` | `/sessions/active/latest` | Fetch the latest active session |
| `GET` | `/sessions/:sessionId` | Get session state |
| `PATCH` | `/sessions/:sessionId/answer` | Save an answer for a question |
| `POST` | `/sessions/:sessionId/submit` | Finalise and score the exam |

### Admin (`/api/admin`) — admin role required
| Method | Path | Description |
|---|---|---|
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
- **Rate limiting** — 300 req/15 min general API throttle; 20 req/15 min on `/auth/login` and `/auth/register`
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
| `ExamSession` | Full mock exam state — questions, answers, timing, scoring |
| `ExamAuditLog` | Immutable per-answer audit trail for exam integrity |
| `Mistake` | Mistake bank with spaced-repetition fields (3 review stages) |
| `ProductEvent` | Internal telemetry events |

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
```

---

## CI Pipeline

- **Workflow**: `.github/workflows/backend-ci.yml`
- Triggers on push and pull request to `main`/`master`
- Steps: install backend dependencies → run backend test suite

---

## Notes

- The ML layer uses classical scikit-learn models and heuristic scoring rather than deep learning — intentional for lightweight deployment.
- Exam simulation includes full state-reconciliation on session restore (handles page refresh mid-exam).
- The `ExamSimulationPage` uses an explicit `selectedOptionMap` / `confirmedOptionMap` / `cooldownMap` architecture to prevent selection corruption and infinite retry loops on rate-limited saves.
- Route-based code splitting ensures the initial JS bundle only contains the public landing page.
