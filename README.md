# AI-Based Personalized Learning Platform (NEET, JEE, CET)

Full-stack personalized exam preparation platform with AI-assisted doubt resolution, on-device AI proctoring, question content protection, adaptive learning features, a learning-content recommendation engine, a server-authoritative gamification & achievement system, a peer referral/invite program, non-blocking transactional security emails, and a dedicated admin portal.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite + React Router v6 + Recharts + `@vladmandic/face-api` (on-device TensorFlow.js) |
| **Backend** | Node.js + Express + MongoDB + Mongoose + JWT + PDFKit + Nodemailer |
| **AI Tutor** | Google Gemini API (`@google/genai`) — streaming, server-side only |
| **Exam Proctoring & Content Protection** | On-device face presence detection (`@vladmandic/face-api`) + browser focus/visibility monitoring + client-side question anti-copy/anti-leak shield |
| **Learning Engine** | Deterministic 0–100 ranking engine + prerequisite expansion + before/after effectiveness tracker |
| **Gamification** | Server-authoritative XP ledger (`GamificationEvent`) + level curve + streak shields + achievement engine + historical backfill |
| **Referrals & Community** | Server-authoritative referral codes (`User.referralCode`) + unique referral tracking (`Referral`) + dynamic Web Share & clipboard invite links |
| **Transactional Email** | Nodemailer with non-blocking fire-and-forget SMTP delivery + fail-safe offline degradation |
| **ML Service** | Python + Flask + scikit-learn + NumPy |
| **Testing** | Jest + Supertest + mongodb-memory-server (backend: 14 test suites) · Vitest + Testing Library (frontend: 18 test files, 81 tests) |
| **Security** | Helmet · express-rate-limit · express-mongo-sanitize · bcryptjs · Idempotent event reporting · Privacy-first local video stream · Question content protection · Non-blocking email boundary |

---

## Features

### Student-Facing
1. **User Authentication** — Register, login, profile via JWT (Bearer token); supports referral code tracking (`?ref=`) and non-blocking transactional security emails (welcome email on registration and login confirmation with IST timestamp)
2. **Question Bank** — Exam-wise (NEET/JEE/CET), subject-topic hierarchical question sets
3. **Practice Quiz Flow** — Per-question attempt submission with correctness and explanation feedback
4. **Ask with AI (AI Tutor)** — Streaming Gemini-powered doubt-resolution sidebar on the Practice Page; multi-turn conversation scoped to the currently attempted question
5. **Performance Tracking** — Accuracy, attempt count, and time-per-topic persistence
6. **Weak Topic Detection** — Threshold-based identification of underperforming topics
7. **Personalized Recommendations** — ML-driven suggestions with rule-based fallback
8. **Analytics Dashboard** — Charts (Recharts) for per-subject and per-topic performance
9. **Exam Simulation** — Full-length and section-wise mock tests with real-time answer saving, single-flight locking, cooldown throttle, and full state reconciliation on restore
10. **Exam Scoring** — NEET/JEE marking scheme (+4/−1/0), percentile estimate, rank range
11. **AI Proctoring & Integrity Shield** — Dual-counter browser focus & on-device webcam presence tracking:
    - **Focus Violation Tracking**: Detects tab changes (`visibilitychange`), window blurring (`blur` with a 250ms confirmation delay), and navigation attempts with 4 warning levels and automated submission at 5 violations (`MAX_VIOLATIONS`).
    - **On-Device Webcam Presence Detection**: Evaluates live video locally via `@vladmandic/face-api` (TinyFaceDetector, ~190 KB weights served locally from `/models/`, no CDN, zero video uploaded or stored). Alerts after 5 consecutive absent frames and auto-submits after 5 presence warnings (`PRESENCE_LIMIT`).
    - **Camera Status Monitoring**: Derives device status (requesting, active, denied, not-found, in-use, disconnected) with user recovery retry controls. Camera unavailability alone is treated as a client warning and is never penalized as an absence.
    - **Question Content Protection & Anti-Leak**: Restricts selection (`user-select: none`), clipboard copying (`onCopy`), cutting (`onCut`), drag-and-drop (`onDragStart`), and right-click context menus (`onContextMenu`) across question stems and options in both Practice and Exam Simulation modes without impeding button clicks.
    - **Server-Authoritative Idempotency**: Violation reports use client-generated idempotency keys (`crypto.randomUUID`) to prevent duplicate counts from retries.
12. **Post-Exam Intelligence** — Adaptive follow-up study plan generated from exam results
13. **Exam Report & Certificate Download** — PDF export of exam results and completion certificate
14. **Mistake Bank** — Persistent log of incorrect answers with spaced-repetition scheduling (3 stages)
15. **Weak Topics Page** — Dedicated view of low-accuracy topics with drill-down
16. **Study Plan Page** — AI-generated prioritised study schedule
17. **Achievements Page** — Milestone and badge tracking
18. **Flashcards** — Lightweight review interface
19. **Session Summary** — Post-practice session breakdown
20. **Profile Page** — User stats, target exam, account settings, and an **Invite Friends** entry point with referral code display and statistics
21. **Learn Page** — Personalised learning hub (`/learn`): curated study-material recommendations organised into sections (Weak Areas, Mistake Recovery, Continue Learning, Practice After Learning, Challenges, Explore New); includes a LearnNext hero card, daily plan, and improvement banners
22. **Learning Content Detail** — Individual content page (`/learn/:recommendationId`): start, progress, complete, skip, and feedback lifecycle actions with before/after practice measurement
23. **Gamification & Engagement Engine** — Server-authoritative motivation architecture:
    - **XP & Dynamic Level Progression**: Non-linear level progression formula (`250 + (level - 1) * 100` incremental XP per level) driven by verified learning actions (practice attempts with difficulty/speed/weak-topic bonuses, completed study content, legitimate exam scores, daily learning activity, and streak days).
    - **Anti-Farming Event Ledger**: Append-only `GamificationEvent` store with unique `(user, dedupeKey)` constraints ensuring duplicate requests, rapid clicking, or refreshed submissions can never double-credit XP.
    - **Streak Tracking & Streak Shields**: Daily active tracking with 3, 7, 14, 30, 60, 100, and 365-day milestones. Streak shields are automatically awarded at every 7-day milestone (up to 3 shields max) to protect active streaks during inactive days.
    - **Codified Achievement Catalog**: 21 immutable milestone achievements spanning practice volume, high accuracy, daily streaks, learning material completion, exam performance, and player level.
    - **Live UI Chrome & Micro-Interactions**: Real-time XP gain toasts (`+XP`), interactive Level-Up celebration modals, Achievement Unlocked dialogs, and a responsive Level/XP header pill that scales gracefully down to mobile widths.
    - **Automatic Historical Backfill**: Idempotent reconstruction mechanism populating XP, streaks, and achievements from pre-existing practice attempts, content progress, and exam history so existing accounts or seeded demo profiles never start at Level 1 / 0 XP.
24. **Invite Friends & Referral Program** — Built-in peer referral system with live stats:
    - **Unique Referral Codes**: High-entropy 8-character codes (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, excluding visually ambiguous characters like `0/O` and `1/I/L`) auto-assigned to every user and lazily backfilled on save.
    - **Seamless Invite Links**: Dynamic links (`/register?ref=CODE`) built from frontend configuration (`VITE_CLIENT_URL` or runtime `window.location.origin`).
    - **Multi-Channel Sharing**: Dedicated `InviteFriendsModal` featuring one-click link copying (with toast confirmation), native Web Share API (`navigator.share`), and pre-filled email invitations (`mailto:`).
    - **Server-Authoritative Tracking**: DB-level enforcement ensuring one referrer per user (`referredUser` unique index) with automatic self-referral prevention and live signup counters (`friendsInvited`, `successfulSignups`).
25. **Transactional Security & Notification Emails** — Fail-safe email alerts powered by Nodemailer:
    - **Login Confirmation**: Dispatches an instant security notification upon every successful login with date, IST time, and alert instructions for unrecognized logins.
    - **Registration Welcome**: Welcomes new students with account details and target examination summary.
    - **Non-Blocking Architecture**: Fire-and-forget execution with internal error boundaries ensures slow or unconfigured SMTP servers never block, delay, or fail authentication requests.
26. **Comprehensive Exam Hub (About Exams)** — Dedicated reference and guidance center (`/about-exams`) for NEET (UG), JEE Main, and Karnataka CET (KCET / UGCET):
    - **Official Authorities & Scope**: Details governing bodies (NTA, KEA), degree pathways (MBBS, BDS, AYUSH, B.Tech/B.E., B.Arch, B.Planning, Pharmacy), and paper formats.
    - **Verified Direct Portals**: Links directly to official candidate portals and public notice boards for circulars, admit cards, and application forms without fragile year-specific URLs.
    - **Side-by-Side Comparison Matrix**: Cross-exam comparison table contrasting conducting bodies, purposes, subject combinations, and national vs. state eligibility scopes.
    - **Exam Chooser Guide & FAQ**: Decision frameworks and answers to common queries to help candidates select their target entrance examination based on career pathways.

### Admin Portal
27. **Admin Login** — Separate admin authentication flow (`/admin/login`)
28. **Admin Dashboard** — Platform-wide stats overview
29. **Student Management** — List all students, drill into individual student detail
30. **Question Bank CRUD** — Create, read, update, and delete questions
31. **Subjects & Topics Catalog** — Read-only subject overview; full CRUD on topics via `TopicMeta`
32. **Exam Session Monitoring** — Read-only list and detail view of all exam sessions
33. **Admin Analytics** — Platform-wide analytics section
34. **Learning Content Management** — Full CRUD for the learning-content library that powers the recommendation engine (`/admin/learning-content`)
35. **Product Event Tracking** — Internal telemetry for key user actions

---

## Project Structure

```
ai-based-personalized-learning-platform/
├── frontend/               # React + Vite SPA (dark-mode glass/aurora theme)
│   ├── public/
│   │   └── models/         # TinyFaceDetector weights served locally (~190 KB)
│   ├── scripts/
│   │   └── copy-face-models.mjs # postinstall script copying model weights to public/models
│   └── src/
│       ├── pages/          # Route-level page components
│       │   ├── (19 pages: 18 student/public pages incl. AboutExamPage, LearnPage & LearningContentPage + 1 legacy admin analytics)
│       │   ├── admin/      # 11 admin portal pages (incl. AdminLearningContentPage)
│       │   └── __tests__/  # Vitest integration, proctoring, content protection & single-flight suites (14 suites)
│       ├── components/     # Layout, AdminLayout, ProtectedRoute, AISidebar,
│       │   │               # AIChatMessage, BrandLogo, EmptyState, Footer,
│       │   │               # InviteFriendsModal, PasswordField, ResultIcons
│       │   ├── exam/       # PresenceToast, ProctorAlerts, ViolationIndicator, WebcamMonitor
│       │   ├── admin/      # AdminLayout, AdminQuestionFormModal, ConfirmDialog, Pagination
│       │   ├── learning/   # LearnNextCard, LearnNextTeaser, RecommendationCard, DailyPlan,
│       │   │               # ImprovementBanner, LearningPath, PersonalizedPlanPanel,
│       │   │               # ContentFeedback, learningUi
│       │   ├── landing/    # AiNetworkHero, DashboardPreview, RecommendationCard,
│       │   │               # FaqAccordion, PriceCounter, Reveal, icons
│       │   ├── __smoke__/  # Layout and PasswordField smoke tests
│       │   └── __tests__/  # InviteFriendsModal integration tests
│       ├── api/            # Axios API clients (client.js, examClient.js,
│       │                   # examProctoringClient.js, learning.js)
│       ├── context/        # AuthContext, GamificationContext, ThemeContext (dark-only), ToastContext
│       ├── hooks/          # useExamViolationMonitor, usePresenceMonitor, useWebcamMonitor,
│       │                   # useMagneticHover, useScrollReveal
│       ├── lib/            # faceDetector.js (lazy on-device TensorFlow.js TinyFaceDetector)
│       ├── styles/         # Style modules:
│       │   ├── features/   # about-exams.css, admin.css, ai-tutor.css, analytics.css,
│       │   │               # app-shell.css, dashboard.css, exam.css, gamification.css,
│       │   │               # landing.css, learning.css, practice.css, profile.css, subpages.css
│       │   ├── components.css # Shared components + question content protection styling
│       │   └── global.css
│       └── utils/          # Shared utilities, appEvents.js & protectedContent.js
├── backend/                # Node.js REST API
│   ├── src/
│   │   ├── controllers/    # 19 route handlers (auth, referral, questions, attempts,
│   │   │                   # analytics, exam, examReport, recommendation,
│   │   │                   # learningRecommendation, gamification, ai, admin × 8)
│   │   ├── models/         # 17 Mongoose models — see Database Models (incl. Referral)
│   │   ├── routes/         # 10 Express routers (auth, referral, questions, attempts,
│   │   │                   # analytics, recommendations, exams, gamification, admin, ai)
│   │   ├── services/       # 17 service modules — see Service Layer
│   │   │   ├── ai/         # aiService.js, geminiService.js
│   │   │   ├── gamification/ # gamificationService.js, backfillService.js, config.js
│   │   │   ├── learning/   # index.js + 14 focused modules (ranking, needDetection,
│   │   │   │               # learnerProfile, lifecycle, practiceSet, dailyPlan,
│   │   │   │               # learningPath, history, effectiveness, explanations,
│   │   │   │               # aiExplainer, serializers, constants, errors)
│   │   │   ├── pdf/        # examCertificatePdf.js, examReportPdf.js, pdfHelpers.js
│   │   │   └── emailService.js # Nodemailer transactional email delivery
│   │   ├── middleware/     # authMiddleware, errorMiddleware, validateObjectIdParam
│   │   ├── config/         # DB connection, examConfig.js, examSubjectMap.js
│   │   ├── assets/         # Static backend assets
│   │   ├── data/           # Seed/reference data
│   │   └── utils/          # adminBootstrap, generateCertificateId, generateReferralCode,
│   │                       # generateToken, isValidObjectId
│   ├── tests/              # Jest + Supertest test suites (14 test suites)
│   ├── seedQuestions.js    # Question bank seed script
│   ├── seedDemo.js         # Demo user + data seed script
│   ├── seedAdmin.js        # Admin user seed script
│   ├── seedLearningContent.js # Learning content library seed script
│   ├── backfillGamification.js # CLI script for gamification historical backfill
│   ├── scripts/
│   │   └── backfillGamification.js # Multi-user backfill runner
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
# (frontend install runs postinstall script to copy on-device face detector models)
npm --prefix backend install
npm --prefix frontend install

# 3. Configure environment files
cp backend/.env.example backend/.env   # then edit backend/.env
cp frontend/.env.example frontend/.env # then edit frontend/.env

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
7. `npm run seed:content` — (optional) seed the learning-content library (`-- --dry-run` validates only, `-- --reset` removes unused seeded rows first)
8. `npm run backfill:gamification` — (optional) backfill XP, levels, streaks, and achievements for existing users or demo accounts
9. `npm run dev` — start with nodemon

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
| `LEARNING_AI_EXPLANATIONS` | `false` | Set to `true` (with `GEMINI_API_KEY`) to let Gemini rephrase the top "why" sentence in learning recommendations. Ranking never depends on it. |
| `ADMIN_EMAIL` | `admin@learning.com` | Admin account email — created/updated automatically on server start |
| `ADMIN_PASSWORD` | `change_me_before_using` | Admin account password (bcrypt-hashed, never stored in plaintext) |
| `ADMIN_NAME` | `Platform Admin` | Display name for the admin account |
| `SMTP_HOST` | — | SMTP mail server host (e.g. `smtp.gmail.com`). Optional — if unset, transactional emails are skipped safely without error. |
| `SMTP_PORT` | — | SMTP port (e.g. `587` for STARTTLS or `465` for TLS). |
| `SMTP_SECURE` | `false` | Set to `true` for TLS (port 465) or `false` for STARTTLS/plain (port 587). |
| `SMTP_USER` | — | SMTP authentication username / sender email. |
| `SMTP_PASSWORD` | — | SMTP authentication password or app password. |
| `MAIL_FROM` | — | Default sender header (e.g. `"TutorMind <no-reply@tutormind.com>"`). |

---

## Frontend Setup

1. `cd frontend`
2. `npm install` (triggers `postinstall` script `node scripts/copy-face-models.mjs` to copy model weights into `public/models`)
3. Copy `.env.example` → `.env`
4. `npm run dev` — start Vite dev server at `http://localhost:5173`

### Environment Variables (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Backend API base URL |
| `VITE_CLIENT_URL` | `http://localhost:5173` | Base client URL used to construct invite/referral links. If unset, the app falls back to `window.location.origin` at runtime. |

### Pages / Routes

#### Student Routes

| Route | Page | Auth |
|---|---|---|
| `/` | Home / Landing | Public |
| `/about-exams` | About Exams (NEET, JEE Main, KCET reference hub) | Public |
| `/login` | Login | Public |
| `/register` | Register (supports `?ref=` referral prefill) | Public |
| `/dashboard` | Dashboard | ✅ |
| `/practice` | Practice Quiz (+ AI Tutor sidebar & Content Protection) | ✅ |
| `/learn` | Personalised Learning Hub | ✅ |
| `/learn/:recommendationId` | Learning Content Detail | ✅ |
| `/analytics` | Analytics & Charts | ✅ |
| `/profile` | User Profile (+ Invite Friends modal) | ✅ |
| `/exam-simulation` | Exam Simulation (+ Webcam, Focus Proctoring & Content Protection) | ✅ |
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
| `/admin/learning-content` | Learning Content CRUD | ✅ Admin only |
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
| `POST` | `/register` | Create account; accepts optional `ref` referral code. Asynchronously dispatches welcome email if SMTP is configured. |
| `POST` | `/login` | Authenticate, receive JWT. Lazily backfills referral code if absent. Asynchronously dispatches login security confirmation email with IST timestamp. |
| `GET` | `/profile` | Get current user profile (protected) |

### Referrals (`/api/referrals`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/me` | Get current user's referral summary (`referralCode`, `friendsInvited`, `successfulSignups`). Protected. Rate-limited to 300 req / 15 min. |

### Questions (`/api/questions`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/subjects-topics` | List all subjects and their topics |
| `GET` | `/` | Fetch questions (filter by exam, subject, topic, difficulty) |

### Attempts (`/api/attempts`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Submit a practice attempt (evaluates correctness, persists performance, processes server-authoritative gamification XP) |
| `GET` | `/me` | Get current user's attempt history |

### Analytics (`/api/analytics`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/me` | Per-topic performance stats, habit insights, exam readiness, and persistent gamification level/XP for current user |

### Recommendations (`/api/recommendations`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/me` | ML-backed personalized topic recommendations (`?include=learning` additionally returns the learning-content bundle) |
| `GET` | `/focus-session` | Returns a focused practice set for the current session |
| `GET` | `/learning` | Full learning-content recommendation bundle (sections, learnNext, dailyPlan) |
| `GET` | `/learn-next` | Top single learning-content recommendation |
| `GET` | `/weak-areas` | Learning content targeting weak topics |
| `GET` | `/mistake-recovery` | Learning content for repeatedly missed concepts |
| `GET` | `/challenges` | Advanced content for mastered topics |
| `GET` | `/daily-plan` | Daily learning schedule |
| `GET` | `/:id` | Get a single recommendation by ID |
| `GET` | `/:id/practice` | Practice question set for a recommendation |
| `POST` | `/:id/start` | Mark recommendation as started |
| `POST` | `/:id/progress` | Update progress on a recommendation |
| `POST` | `/:id/complete` | Mark recommendation as completed (awards 20 XP via gamification engine) |
| `POST` | `/:id/skip` | Skip a recommendation |
| `POST` | `/:id/feedback` | Submit feedback on a recommendation |

### Gamification (`/api/gamification`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/summary` | Aggregated gamification summary (profile, recent events, unlock count) for header pill and dashboard |
| `GET` | `/profile` | Current user gamification profile (XP, level, streak, shields, counters, personal bests) |
| `GET` | `/achievements` | Full achievement catalog (21 milestones) with user unlock status and timestamp |
| `GET` | `/history` | Paginated append-only XP event history ledger (anti-farming audit trail) |

> **Note**: Gamification routes are strictly read-only by design. There is intentionally no client endpoint to add XP or grant achievements; XP is awarded server-authoritative as a side effect of validated learning actions (answering questions, finishing learning content, or submitting legitimate exams).

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
| `PATCH` | `/sessions/:sessionId/answer` | Save an answer for a question (single-flight guarded) |
| `POST` | `/sessions/:sessionId/violations` | Record a focus violation or presence warning with an idempotent event ID (`TAB_HIDDEN`, `WINDOW_BLUR`, `ROUTE_LEAVE`, `NO_PERSON`). Protected. |
| `POST` | `/sessions/:sessionId/submit` | Finalise and score the exam. Accepts optional submit reason and claimed counters (`MANUAL`, `TIME_EXPIRED`, `MAX_VIOLATIONS`, `PRESENCE_LIMIT`) verified server-side. Legitimate submissions process exam XP. |
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
| `GET` | `/learning-content` | List learning content |
| `GET` | `/learning-content/meta` | Learning content metadata (subjects, topics, types) |
| `GET` | `/learning-content/:id` | Get single content item |
| `POST` | `/learning-content` | Create content item |
| `PUT` | `/learning-content/:id` | Update content item |
| `DELETE` | `/learning-content/:id` | Delete content item |
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

## Learning-Content Recommendations

TutorMind recommends *what to learn next* (study material → practice → re-measure), not just which questions to solve. The engine is deterministic and needs no LLM or API key.

**Pipeline:** student performance → learning-need detection → candidate retrieval (active `LearningContent` only) → prerequisite expansion → 0-100 ranking → sections / learning path / daily plan → persisted recommendation history → lifecycle (start, progress, complete, feedback) → practice set → before/after measurement → next recommendation.

**Code:** `backend/src/services/learning/` (15 focused modules), models `LearningContent`, `LearningContentProgress`, `LearningRecommendation`, `QuestionRecommendationLog`.

**Endpoints (all authenticated):** `GET /api/recommendations/me` (unchanged; `?include=learning` adds the bundle), `GET /api/recommendations/learning`, `learn-next`, `weak-areas`, `mistake-recovery`, `challenges`, `daily-plan`, `focus-session`, `GET /:id`, `GET /:id/practice`, `POST /:id/start|progress|complete|skip|feedback`, and admin `GET/POST/PUT/DELETE /api/admin/learning-content` (+ `/meta`).

**Seeding** (idempotent): `cd backend && npm run seed:questions && npm run seed:content` (`-- --dry-run` validates only, `-- --reset` removes unused seeded rows first).

**Optional AI:** `LEARNING_AI_EXPLANATIONS=true` (with `GEMINI_API_KEY`) lets Gemini rephrase only the top "why" sentence. Ranking never depends on it.

---

## Gamification & Engagement Engine

TutorMind integrates a server-authoritative gamification engine designed to reward consistent study habits, deliberate practice, and mastery.

### Architectural Guarantees & Anti-Farming

- **Server-Authoritative Awards**: The frontend never transmits XP values or unlocks directly. XP is awarded purely as a side effect of server-side operations (attempt submission, learning item completion, legitimate exam submission).
- **Append-Only Event Ledger (`GamificationEvent`)**: Every award is logged with a deterministic `dedupeKey` (e.g. `PRACTICE_ANSWER:${attemptId}` or `DAILY_ACTIVITY:${date}`). A unique compound index on `(user, dedupeKey)` ensures duplicate client retries or page refreshes are treated as idempotent no-ops.
- **Proctoring Disqualification**: Exams terminated automatically due to integrity violations (`MAX_VIOLATIONS` or `PRESENCE_LIMIT`) are strictly disqualified from earning exam completion or high-score XP.

### XP Awards & Progression

| Event | Base XP | Bonus Conditions |
|---|---|---|
| Practice Answer (Incorrect) | 5 XP | — |
| Practice Answer (Correct) | 10 XP | +3 XP speed bonus (answered in ≤ 35s) |
| Practice Answer (Weak Topic) | 15 XP | +3 XP speed bonus if answered in ≤ 35s |
| Practice Answer (Hard Question) | 20 XP | +3 XP speed bonus if answered in ≤ 35s |
| Learning Content Completed | 20 XP | Triggered on recommendation completion |
| Exam Completed | 50 XP | Disqualified if terminated for proctoring violations |
| Exam Score ≥ 80% | +50 XP | Added to base exam completion award |
| Exam Score ≥ 90% | +75 XP | Added to base exam completion award |
| Exam Score ≥ 95% | +100 XP | Added to base exam completion award |
| Daily Active Practice | 5 XP | Awarded once per calendar day |
| Streak Day | 10 XP | Awarded upon advancing daily streak |

### Dynamic Level Curve

The XP required to progress between levels scales non-linearly:
$$\text{XP to next level from } L = 250 + (L - 1) \times 100$$

- **Level 1 → 2**: 250 XP
- **Level 2 → 3**: 350 XP (600 cumulative XP)
- **Level 3 → 4**: 450 XP (1,050 cumulative XP)
- **Level 4 → 5**: 550 XP (1,600 cumulative XP)

### Streak Shields & Habit System

- **Habit Streaks**: Calculated across all qualifying study events (practice questions, learning material, exam completions).
- **Streak Shields**: For every 7 days of continuous streak, the student automatically earns 1 Streak Shield (capped at 3 shields max) to prevent accidental streak forfeiture during missed days.

### Codified Achievement Catalog

21 achievements across 6 categories defined in `backend/src/services/gamification/config.js` and stored permanently in `UserAchievement`:
- **Practice Volume**: *First Step* (1 Q), *Getting Started* (25 Q), *Question Crusher* (100 Q), *Practice Pro* (500 Q), *Master Solver* (1000 Q)
- **Accuracy**: *Sharpshooter* (80%+ across 20+ Q), *Precision* (90%+ across 50+ Q)
- **Streaks**: *3-Day Learner*, *7-Day Streak*, *14-Day Streak*, *30-Day Streak*, *60-Day Streak*, *100-Day Streak*
- **Learning Content**: *First Lesson* (1 item), *Knowledge Builder* (10 items), *Deep Learner* (50 items)
- **Exams**: *First Exam*, *Exam Ready* (5 exams), *High Performer* (80%+ score), *Elite Performance* (90%+ score)
- **Levels**: *Rising Star* (Level 5), *Advanced Learner* (Level 10), *Master Learner* (Level 20)

### Historical Backfill Migration

Pre-existing users and seeded demo accounts are automatically backfilled via `backend/src/services/gamification/backfillService.js`. When any user hits `/api/gamification/*` or `/api/analytics/me`, their historical practice attempts, content progress, and exam sessions are reconciled into `GamificationProfile` and `GamificationEvent` idempotently without double-counting. Administrators can also run the batch backfill CLI via `npm --prefix backend run backfill:gamification`.

---

## Invite Friends & Referral System

TutorMind provides a built-in peer invite program to encourage collaborative exam preparation:

- **Collision-Resistant Referral Codes**: Every user receives an uppercase 8-character referral code drawn from an unambiguous character set (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`). Pre-existing users are lazily backfilled upon login or referral query.
- **Dynamic Referral URLs**: Referral URLs (`/register?ref=CODE`) are formed using the configurable `VITE_CLIENT_URL` (falling back safely to `window.location.origin` at runtime).
- **One-Referrer-Per-Student Guarantee**: Stored in the `Referral` collection with a unique index on `referredUser`. A user can only be referred once, and self-referrals are prevented server-side.
- **Multi-Channel Sharing & Live Metrics**: Accessible directly from the Profile page via `InviteFriendsModal`:
  - One-click invite link copying with clipboard fallback.
  - Native mobile/desktop share sheet (`navigator.share`).
  - Native email launcher (`mailto:`) with pre-composed invitation text.
  - Real-time counters for `friendsInvited` and `successfulSignups`.

---

## Security & Protection

- **Helmet** — sets secure HTTP response headers
- **CORS** — restricted to `CLIENT_URL` origins only (no wildcard + credentials)
- **Rate limiting** — 300 req/15 min general API throttle; 20 req/15 min on `/auth/login` and `/auth/register`; 40 req/15 min on `/api/ai` (Gemini quota protection); 300 req/15 min on `/api/referrals`
- **Exam-session rate limiting** — per-session, per-question throttle with 3-second cooldown on 429; single-flight locks prevent request flooding
- **Question Content Protection** — blocks text selection (`user-select: none`), clipboard copy (`onCopy`), cutting (`onCut`), dragging (`onDragStart`), and context menus (`onContextMenu`) across question stems and options in Practice and Exam Simulation modes
- **Proctoring event idempotency** — client-generated UUID keys prevent duplicate counts or inflated violation state from network retries
- **Privacy-first video handling** — camera streams remain purely local in browser memory; video frames are never recorded, transmitted, or uploaded to any server
- **Anti-farming gamification ledger** — unique compound indexes prevent replay attacks, double-crediting, or inflated scores
- **Non-blocking email delivery** — transactional emails run asynchronously in a fire-and-forget boundary; SMTP latency or connection errors never degrade or delay registration or login responses
- **Referral integrity** — server-authoritative code lookup, strict database uniqueness constraints, and self-referral prevention
- **express-mongo-sanitize** — strips `$`/`.` keys from request input to block NoSQL injection
- **bcryptjs** — password hashing
- **JWT** — stateless auth via `Authorization: Bearer <token>` header

---

## Database Models

| Model | Purpose |
|---|---|
| `User` | Account, role (`user`/`admin`), target exam, unique auto-generated `referralCode` |
| `Referral` | Tracks successful referred registrations (`referrer`, unique `referredUser`, `referralCode`) |
| `Question` | Question bank — exam, subject, topic, options, answer, explanation |
| `Attempt` | Individual practice attempt record |
| `Performance` | Aggregated per-topic metrics (accuracy, attempts, avg time) |
| `TopicMeta` | Topic catalog for admin management (subjects/topics metadata) |
| `ExamSession` | Full mock exam state — questions, answers, timing, scoring, and proctoring integrity state (`violationCount`, `maximumViolations`, `violationEvents`, `presenceWarningCount`, `maximumPresenceWarnings`, `autoSubmitted`, `autoSubmitReason`) |
| `ExamAuditLog` | Immutable per-answer audit trail for exam integrity |
| `Mistake` | Mistake bank with spaced-repetition fields (3 review stages) |
| `LearningContent` | Study material items powering the recommendation engine (title, type, subject, topic, difficulty, prerequisites, active flag) |
| `LearningContentProgress` | Per-student progress record for each content item (status, score, time spent) |
| `LearningRecommendation` | Persisted recommendation record including ranking score, lifecycle state, and before/after measurement |
| `QuestionRecommendationLog` | Log linking practice questions to a parent recommendation for before/after measurement |
| `GamificationProfile` | Server-authoritative user gamification state (XP, level, level progress, daily/weekly XP, streaks, streak shields, personal bests, historical counters) |
| `GamificationEvent` | Append-only event ledger with unique `(user, dedupeKey)` index preventing XP double-counting and farming |
| `UserAchievement` | Immutable unlock records with unique `(user, achievementId)` index ensuring achievements cannot be lost |
| `ProductEvent` | Internal telemetry events |

---

## Service Layer

| Service | Responsibility |
|---|---|
| `examSimulationService` | Core exam session lifecycle, scoring, state reconciliation, focus & presence proctoring enforcement |
| `recommendationService` | ML-backed + rule-based topic recommendations |
| `gamification/` (3 modules) | Server-authoritative gamification engine: XP calculation & anti-farming deduplication (`gamificationService`), historical backfill reconstruction (`backfillService`), and central awards/level-curve/achievements config (`config`) |
| `emailService` | Transactional email dispatcher for login notifications and registration welcome messages using Nodemailer with fail-safe error boundaries |
| `analyticsService` | Per-topic and platform analytics aggregation, habit tracking, and gamification profile integration |
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
| `learning/` (15 modules) | Learning-content recommendation engine: need detection, learner profiling, candidate retrieval & ranking, prerequisite expansion, lifecycle management, practice sets, daily plans, effectiveness tracking, AI explainer, and serialization |

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
| `authEmail.test.js` | Login security confirmation email delivery, graceful handling of SMTP failures, and offline fallback |
| `emailService.test.js` | Nodemailer transport configuration, HTML/text formatting, and configuration guards |
| `exam.simulation.test.js` | Full exam session lifecycle |
| `exam.intent.ordering.test.js` | Question ordering, nonce rotation, and intent logic |
| `exam.proctoring.test.js` | Focus violation recording, camera presence tracking, auto-submit reasons, duplicate prevention, and counter bounds |
| `intelligence.validation.test.js` | Scoring and intelligence analysis |
| `intelligence.adversarial.test.js` | Adversarial / edge-case scenarios |
| `gamification.test.js` | XP calculation, speed & difficulty bonuses, anti-farming deduplication, level curve progression, and achievement unlocks |
| `gamification.backfill.test.js` | Historical streak reconstruction, multi-source backfill, and idempotency guarantees |
| `learning.engine.test.js` | Learning-content recommendation engine (ranking, need detection, lifecycle) |
| `learning.api.test.js` | Learning recommendation REST API integration |
| `referral.test.js` | Referral code generation, invite-based registration, self-referral prevention, and referral summary endpoints |
| `registrationEmail.test.js` | Registration confirmation welcome email delivery and error boundaries |

### Frontend (Vitest + Testing Library)

```bash
npm --prefix frontend run test
# watch mode:
npm --prefix frontend run test:watch
```

Comprehensive test coverage across 18 test files (81 passing tests):
- `ExamSimulationPage.contentProtection.test.jsx` & `PracticePage.contentProtection.test.jsx` — Question text and option selection restrictions, copy/cut/drag blocking, and context menu suppression
- `ProfilePage.inviteFriends.test.jsx` & `InviteFriendsModal.test.jsx` — Invite modal rendering, referral code loading, link copying, Web Share API, mailto composition, and live signup counters
- `RegisterPage.referral.test.jsx` — Referral code prefill via `?ref=` query parameter and submission with registration payload
- `ExamSimulationPage.proctoring.test.jsx` — Focus violations, blur grace confirmation, tab hidden detection, on-device presence detection, auto-submission flows, and duplicate prevention
- `ExamSimulationPage.singleFlight.test.jsx` & `ExamSimulationPage.singleFlightController.test.jsx` — Rapid-click deduplication and rate-limit cooldown countdown
- `ExamSimulationPage.integrity.test.jsx` & `ExamSimulationPage.race.test.jsx` — State reconciliation, sequence ordering, out-of-order rejection, and duplicate suppression
- `ExamSimulationPage.crossClient.integrity.test.jsx` — Multi-tab/device session conflict resolution
- `LearnPage.test.jsx` — Learning hub rendering, section display, empty/error/cold-start states, and lifecycle interactions
- Smoke tests for `HomePage`, `AboutExamPage`, `ProfilePage`, `Layout`, and `PasswordField`
- Utility suites for `markdownLite`

---

## CI Pipeline

- **Workflow**: `.github/workflows/backend-ci.yml`
- Triggers on push and pull request to `main`/`master`
- Steps: install backend dependencies → run backend test suite

---

## Notes

- **Question Content Protection & Anti-Leak**:
  - Question text and options on both Practice and Exam Simulation pages are protected using CSS `user-select: none` (`.question-protected-content`) combined with explicit React event blockers (`onCopy`, `onCut`, `onDragStart`, and `onContextMenu`).
  - Protection is strictly scoped to the text content; answer selection buttons, keyboard controls, and layout navigation remain completely interactive and accessible.
- **Peer Referral Program**:
  - Each student is assigned an unambiguous 8-character code (`generateReferralCode()`).
  - Pre-existing user accounts automatically receive a referral code upon login or referral query through lazy backfill, avoiding required manual migrations.
  - The `Referral` collection guarantees that each student is credited to at most one referrer via a unique index on `referredUser`.
- **Transactional Security Emails**:
  - Sent via Nodemailer over standard SMTP.
  - Operates under a strict fire-and-forget pattern: emails are dispatched asynchronously without awaiting in authentication controllers, ensuring that slow SMTP servers never delay user responses.
  - If SMTP configuration (`SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`) is absent, email delivery is safely bypassed without errors.
- **Gamification & Habit Retention**:
  - XP awards are server-authoritative and completely shielded from client tampering. An append-only ledger (`GamificationEvent`) guarantees idempotency and blocks XP farming.
  - Streak shields safeguard consistent study habits by forgiving up to 3 inactive days without resetting the student's streak counter.
  - Micro-interactions (animated XP toasts, level-up celebration dialogs, and unlock modals) are broadcast through custom DOM events (`tutormind:gamification-event`) handled globally by `GamificationProvider`.
- **AI Tutor** (`Ask with AI`): Available in the Practice Page sidebar. Uses Google Gemini (Flash-Lite by default) for streaming, multi-turn doubt resolution scoped to the currently attempted question. The sidebar renders as a portal to `document.body` to escape the app shell's stacking context. When `GEMINI_API_KEY` is absent or the Gemini service is unreachable, the feature degrades gracefully without affecting the rest of the platform.
- **Exam Proctoring & Integrity Shield**:
  - **Dual Independent Counters**: Focus violations (tab switches, window blurs, route leaves) and presence warnings (no face visible in camera) are tracked on separate counters. Neither adds to or interferes with the other.
  - **Browser Focus Monitoring**: Utilizes `visibilitychange` and window `blur`. Transient blurs (system permission prompts or native confirmation dialogs) are filtered via a 250ms confirmation check. Each transition away from the exam counts as at most one violation. Reaching 5 violations triggers automatic test submission (`MAX_VIOLATIONS`).
  - **On-Device Webcam Presence**: Powered by `@vladmandic/face-api` (TinyFaceDetector, ~190 KB weights served directly from `frontend/public/models/`). Face detection runs 100% on-device inside the student's browser via TensorFlow.js. Video frames are never sent over the network or saved anywhere. If a student is absent for 5 consecutive seconds, a warning toast is raised. 5 presence warnings trigger automatic test submission (`PRESENCE_LIMIT`).
  - **Fail-Open & Resilient**: If the camera is denied, disconnected, in use by another app, or if the detector fails to load, presence checking safely turns off and the student is never penalized. Device status recovery with an inline Retry button is provided.
  - **Server-Authoritative Enforcement**: Client auto-submit requests with reason `MAX_VIOLATIONS` or `PRESENCE_LIMIT` are validated by the backend against actual recorded counts before finalizing the exam.
- The ML layer uses classical scikit-learn models and heuristic scoring rather than deep learning — intentional for lightweight deployment.
- Exam simulation includes full state-reconciliation on session restore (handles page refresh mid-exam).
- The `ExamSimulationPage` uses an explicit `selectedOptionMap` / `confirmedOptionMap` / `cooldownMap` architecture to prevent selection corruption and infinite retry loops on rate-limited saves.
- Route-based code splitting ensures the initial JS bundle only contains the public landing page; the admin portal is entirely split from student-facing bundles.
- The admin portal has its own separate authentication (`/admin/login`) and layout (`AdminLayout` with sidebar), isolated from the student shell.
- PDF reports and certificates are generated server-side via PDFKit and streamed directly to the client.
- The UI is dark-mode only — the entire design (including the landing page) uses a dark glass/aurora aesthetic. `ThemeContext` always applies `data-theme="dark"` and exposes `theme: 'dark'` to consumers.
