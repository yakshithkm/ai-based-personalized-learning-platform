# AI-Based Personalized Learning Platform (NEET, JEE, CET)

Full-stack personalized exam preparation platform with AI-assisted doubt resolution, on-device AI proctoring, question content protection, adaptive learning features, a learning-content recommendation engine, a server-authoritative gamification & achievement system, a server-enforced FREE / PRO / PREMIUM subscription tier system, a peer referral/invite program, non-blocking transactional security emails, multilingual internationalization (English, Kannada, Hindi, Telugu, Tamil, Malayalam) with on-demand font and locale loading, a dual-theme system (dark & light modes with zero-FOUC bootstrapping and semantic CSS tokens), and a dedicated admin portal.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite + React Router v6 + Recharts + `@vladmandic/face-api` (on-device TensorFlow.js) + `i18next` + `react-i18next` + Noto Sans Variable Fonts (Devanagari, Kannada, Malayalam, Tamil, Telugu) + Dual-Theme Engine (Dark default & Light mode) |
| **Backend** | Node.js + Express + MongoDB + Mongoose + JWT + PDFKit + Nodemailer |
| **Subscription Tiers** | FREE / PRO / PREMIUM · single-source config (`config/tiers.js`) · tier derived from the DB user row on every request · feature gating + atomic usage quotas middleware · server-shaped analytics/recommendations · payment-gateway seam (no gateway integrated) |
| **Multilingual & i18n** | 6 supported languages (`en`, `kn`, `hi`, `te`, `ta`, `ml`) · dynamic on-demand chunk loading · zero-reload in-place switching · user preference persistence · localized date/number/error formatting |
| **Dual-Theme System** | Dark (default) & Light themes · semantic CSS design tokens (`styles/theme.css`) · zero-FOUC inline bootstrapping script in `index.html` · smooth `.theme-transition` cross-fade · cross-tab persistence via `localStorage` · accessible animated header toggle · theme-aware data visualizations |
| **AI Tutor** | Google Gemini API (`@google/genai`) — streaming, server-side only, with multilingual reasoning (6 languages) and scientific/technical notation preservation |
| **Exam Proctoring & Content Protection** | On-device face presence detection (`@vladmandic/face-api`) + browser focus/visibility monitoring + client-side question anti-copy/anti-leak shield |
| **Learning Engine** | Deterministic 0–100 ranking engine + prerequisite expansion + before/after effectiveness tracker |
| **Gamification** | Server-authoritative XP ledger (`GamificationEvent`) + level curve + streak shields + achievement engine + historical backfill |
| **Referrals & Community** | Server-authoritative referral codes (`User.referralCode`) + unique referral tracking (`Referral`) + dynamic Web Share & clipboard invite links |
| **Transactional Email** | Nodemailer with non-blocking fire-and-forget SMTP delivery + fail-safe offline degradation |
| **ML Service** | Python + Flask + scikit-learn + NumPy |
| **Testing** | Jest + Supertest + mongodb-memory-server (backend: 21 test suites — 16 integration + 5 database-free unit suites, 220 tests total: 148 integration + 72 unit tests) · Vitest + Testing Library (frontend: 24 test files, 146 tests) |
| **Security** | Helmet · express-rate-limit · express-mongo-sanitize · bcryptjs · Server-side tier authorization · Atomic usage quotas · Idempotent event reporting · Privacy-first local video stream · Question content protection · Non-blocking email boundary |


---

## Features

### Student-Facing
1. **User Authentication** — Register, login, profile via JWT (Bearer token); supports referral code tracking (`?ref=`), preferred UI language selection & persistence (`PATCH /api/auth/preferences`), and non-blocking transactional security emails (welcome email on registration and login confirmation with IST timestamp). Every new account starts on the FREE tier; no client-supplied tier or plan is ever honored.
2. **Question Bank** — Exam-wise (NEET/JEE/CET), subject-topic hierarchical question sets
3. **Practice Quiz Flow** — Per-question attempt submission with correctness and explanation feedback (daily quota by plan)
4. **Ask with AI (AI Tutor)** — Streaming Gemini-powered doubt-resolution sidebar on the Practice Page; multi-turn conversation scoped to the currently attempted question with multilingual response generation (English, Kannada, Hindi, Telugu, Tamil, Malayalam) preserving standard formulas, units, chemical symbols, and code identifiers. Metered per day by plan; PREMIUM gets an "advanced tutor" prompt mode.
5. **Performance Tracking** — Accuracy, attempt count, and time-per-topic persistence
6. **Weak Topic Detection** — Threshold-based identification of underperforming topics
7. **Personalized Recommendations** — ML-driven suggestions with rule-based fallback
8. **Analytics Dashboard** — Charts (Recharts) for per-subject and per-topic performance; advanced analytics (topic mastery, heatmap, weekly trend, benchmark) are PRO+ and are removed from the API response for FREE users
9. **Exam Simulation** — Full-length and section-wise mock tests with real-time answer saving, single-flight locking, cooldown throttle, and full state reconciliation on restore (monthly quota by plan)
10. **Exam Scoring** — NEET/JEE marking scheme (+4/−1/0), percentile estimate, rank range
11. **AI Proctoring & Integrity Shield** — Dual-counter browser focus & on-device webcam presence tracking:
    - **Focus Violation Tracking**: Detects tab changes (`visibilitychange`), window blurring (`blur` with a 250ms confirmation delay), and navigation attempts with 4 warning levels and automated submission at 5 violations (`MAX_VIOLATIONS`).
    - **On-Device Webcam Presence Detection**: Evaluates live video locally via `@vladmandic/face-api` (TinyFaceDetector, ~190 KB weights served locally from `/models/`, no CDN, zero video uploaded or stored). Alerts after 5 consecutive absent frames and auto-submits after 5 presence warnings (`PRESENCE_LIMIT`).
    - **Camera Status Monitoring**: Derives device status (requesting, active, denied, not-found, in-use, disconnected) with user recovery retry controls. Camera unavailability alone is treated as a client warning and is never penalized as an absence.
    - **Question Content Protection & Anti-Leak**: Restricts selection (`user-select: none`), clipboard copying (`onCopy`), cutting (`onCut`), drag-and-drop (`onDragStart`), and right-click context menus (`onContextMenu`) across question stems and options in both Practice and Exam Simulation modes without impeding button clicks.
    - **Server-Authoritative Idempotency**: Violation reports use client-generated idempotency keys (`crypto.randomUUID`) to prevent duplicate counts from retries.
12. **Post-Exam Intelligence** — Adaptive follow-up study plan generated from exam results
13. **Exam Report & Certificate Download** — PDF export of exam results and completion certificate (PRO+)
14. **Mistake Bank** — Persistent log of incorrect answers with spaced-repetition scheduling (3 stages); capped list size on FREE
15. **Weak Topics Page** — Dedicated view of low-accuracy topics with drill-down
16. **Study Plan Page** — AI-generated prioritised study schedule (number of topics by plan)
17. **Achievements Page** — Milestone and badge tracking
18. **Flashcards** — Lightweight review interface
19. **Session Summary** — Post-practice session breakdown
20. **Profile Page** — User stats, target exam, account settings, current plan, and an **Invite Friends** entry point with referral code display and statistics
21. **Learn Page** — Personalised learning hub (`/learn`): curated study-material recommendations organised into sections (Weak Areas, Mistake Recovery, Continue Learning, Practice After Learning, Challenges, Explore New); includes a LearnNext hero card with localized AI rationale rephrasing, daily plan, and improvement banners. Sections, content tier and AI polish are shaped by the user's plan.
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
27. **Multilingual & Regional Language Support (i18n)** — Full internationalization across the platform:
    - **6 Supported Languages**: English (`en`), Kannada (`kn` — ಕನ್ನಡ), Hindi (`hi` — हिन्दी), Telugu (`te` — తెలుగు), Tamil (`ta` — தமிழ்), and Malayalam (`ml` — മലയാളം).
    - **High-Fidelity Native Typography**: Self-hosted Fontsource variable font packages (`@fontsource-variable/noto-sans-*`) for Devanagari, Kannada, Malayalam, Tamil, and Telugu to guarantee crisp, authentic Indic script rendering across desktop and mobile.
    - **Zero-Reload Dynamic Switching**: Instantaneous in-place UI re-rendering without page refreshes, retaining all form inputs, ongoing quiz attempts, and active routes while synchronizing document attributes (`<html lang="..." dir="ltr">`).
    - **Optimized Dynamic Chunk Loading**: English translation strings are bundled initially (~57 KB); non-English locale bundles (`kn`, `hi`, `te`, `ta`, `ml`) are lazily loaded on demand via Vite dynamic imports.
    - **Multi-Tier Preference Resolution**: Prioritizes `localStorage` (`tutormind-language`), authenticated user profile setting (`User.preferredLanguage`), browser language (`navigator.languages`), with robust fallback to English.
    - **Comprehensive Platform Localization**: Full localization across all student pages, navigation chrome, exam simulation countdowns, proctoring warnings, XP toasts, plan/upgrade screens, and translated backend error messages (`serverErrors.js`).
    - **Accessible Language Selector**: Top navigation and mobile drawer dropdown with native script names, flags, ARIA attributes (`role="listbox"`, `aria-selected`), and full keyboard navigation (ArrowUp/Down, Enter, Escape).
28. **Subscription Tiers (FREE / PRO / PREMIUM)** — The frontend controls what the user *sees*; the backend controls what the user is *allowed to do*:
    - **Server-Derived Tier**: The tier is read from the authenticated user's DB row on every request. Tokens, request bodies, headers and query strings are never consulted.
    - **Feature Gating & Quotas**: Per-plan feature access (`403 TIER_UPGRADE_REQUIRED`) and atomic usage limits for practice, AI doubt solving, recommendations and exam simulations (`429 USAGE_LIMIT_REACHED`), with automatic refund when a request fails. Limits reset by changing the period key (IST day / month) — no cron job.
    - **Server-Shaped Data**: Advanced analytics, readiness predictions, recommendation sections, study-plan and mistake-bank sizes are trimmed server-side, so locked data is absent from the response rather than hidden by the UI.
    - **Subscription Expiry**: A paid tier whose end date has passed is treated as FREE immediately and reported as `SUBSCRIPTION_EXPIRED`.
    - **Frontend Presentation Only**: `TierContext` exposes the server-resolved tier, features, limits and usage; `TierGate` / `TierRoute` / `FeatureLock` / `UsageMeters` / `UpgradePrompt` render that state, and one global, translated dialog explains any tier refusal. The sidebar "Unlock Your Potential" card is shown to FREE accounts only.
    - **Tier Demo Accounts**: Free / Pro / Premium demo logins on the login page go through the normal authentication endpoint and are subject to the same authorization as real users.
29. **Pricing & Plan Selection** — The landing page "Simple, transparent pricing" cards and the `/plans` upgrade screen:
    - **Plan-Aware Buttons**: Logged-out visitors go to `/register` (Free) or `/register?plan=PRO|PREMIUM`; signed-in users see "Open dashboard", "Upgrade to Pro/Premium", a disabled "Current Plan", or "View my plan" depending on their real tier. Clicking a pricing button never changes a tier.
    - **Selection Preserved**: `?plan=` survives registration, login, direct navigation to `/plans?plan=…` while logged out, and page refresh. Values are validated (`FREE` / `PRO` / `PREMIUM` only).
    - **Honest Checkout**: The upgrade screen (`PlanUpgradePanel`) shows plan benefits, current plan, subscription status and billing period, then states that online checkout is not available yet. No fake payment page or success message; no trial wording because no trial exists.
    - **Explore Demo**: A clearly labelled, confirm-first "Explore Pro/Premium Demo" action signs in to the matching demo account through the normal login endpoint.

30. **Dual-Theme System (Dark & Light Modes)** — Seamless switching between curated dark and light aesthetics:
    - **Standardized Semantic Tokens**: Dark (default) and Light mode palettes driven entirely by unified CSS design tokens (`styles/theme.css`). Dark preserves the deep aurora/glass theme (`#0f172a`), while Light delivers a high-contrast ivory surface aesthetic (`#f7f6f2`) with ≥3:1 contrast ratios across text, borders, and charts.
    - **Zero-FOUC Bootstrapping**: Synchronous inline script in `frontend/index.html` resolves `localStorage.getItem('tutormind-theme')` before first paint, assigning `data-theme` on `<html>` and updating `<meta name="theme-color">` to eliminate any theme flashing.
    - **Zero-Tree Re-render Transitions**: Styling responds dynamically via CSS custom properties on `<html>` without requiring React component tree re-renders. A short-lived `.theme-transition` class adds a smooth 320ms cross-fade only on user-initiated clicks (never on page load).
    - **Accessible Header Toggle**: Compact `ThemeToggle` button placed in shared headers (`Layout` and `AdminLayout`), landing navigation & mobile drawer, and floating auth action bars. Features rotating sun/moon SVG icons and full i18n support (`t('theme.switchToLight')` / `t('theme.switchToDark')`) across all 6 supported languages.
    - **Multi-Tab Sync & Auth Decoupling**: Synchronizes across open tabs in real time via `window.onstorage` (`tutormind-theme`). Operates independently of authentication tokens, persisting seamlessly across login and logout.
    - **Theme-Aware Data Visualizations & Subjects**: Dynamic subject visuals in `subjectVisuals.js` adapt color values between dark and light modes, ensuring high readability and WCAG-compliant contrast across charts, accuracy badges, and topic progress indicators.

### Admin Portal
31. **Admin Login** — Separate admin authentication flow (`/admin/login`)
32. **Admin Dashboard** — Platform-wide stats overview
33. **Student Management** — List all students, drill into individual student detail; filter by plan, see each student's plan and subscription state, and change a student's plan through the authorized subscription service (demo accounts are locked)
34. **Question Bank CRUD** — Create, read, update, and delete questions
35. **Subjects & Topics Catalog** — Read-only subject overview; full CRUD on topics via `TopicMeta`
36. **Exam Session Monitoring** — Read-only list and detail view of all exam sessions
37. **Admin Analytics** — Platform-wide analytics section
38. **Learning Content Management** — Full CRUD for the learning-content library that powers the recommendation engine (`/admin/learning-content`), including the `accessTier` (FREE / PRO / PREMIUM) of each resource
39. **Product Event Tracking** — Internal telemetry for key user actions

---

## Project Structure

```
ai-based-personalized-learning-platform/
├── docs/
│   └── TIER_SYSTEM.md      # Tier system design: matrix, architecture, tests, pricing flow, payment seams
├── frontend/               # React + Vite SPA (dark & light dual-theme glass/aurora)
│   ├── public/
│   │   └── models/         # TinyFaceDetector weights served locally (~190 KB)
│   ├── scripts/
│   │   └── copy-face-models.mjs # postinstall script copying model weights to public/models
│   └── src/
│       ├── pages/          # Route-level page components
│       │   ├── (20 pages: 19 student/public pages incl. AboutExamPage, LearnPage, LearningContentPage & PlansPage + 1 legacy admin analytics)
│       │   ├── admin/      # 11 admin portal pages (incl. AdminLearningContentPage)
│       │   └── __tests__/  # Vitest integration, proctoring, content protection, single-flight & pricing-flow suites
│       ├── components/     # Layout, AdminLayout, ProtectedRoute, LanguageSelector, ThemeToggle,
│       │   │               # AISidebar, AIChatMessage, BrandLogo, EmptyState, Footer,
│       │   │               # InviteFriendsModal, PasswordField, ResultIcons
│       │   ├── exam/       # PresenceToast, ProctorAlerts, ViolationIndicator, WebcamMonitor
│       │   ├── admin/      # AdminLayout, AdminQuestionFormModal, ConfirmDialog, Pagination
│       │   ├── tier/       # TierGate, TierRoute, FeatureLock, UpgradePrompt, TierBlockedModal,
│       │   │               # PlanUpgradePanel, UsageMeters, TierBadge, PremiumBadge, Icons,
│       │   │               # tierMeta.js, demoAccounts.js, __tests__/
│       │   ├── learning/   # LearnNextCard, LearnNextTeaser, RecommendationCard, DailyPlan,
│       │   │               # ImprovementBanner, LearningPath, PersonalizedPlanPanel,
│       │   │               # ContentFeedback, learningUi
│       │   ├── landing/    # AiNetworkHero, DashboardPreview, RecommendationCard,
│       │   │               # FaqAccordion, PriceCounter, Reveal, icons
│       │   ├── __smoke__/  # Layout and PasswordField smoke tests (2 suites)
│       │   └── __tests__/  # InviteFriendsModal & LanguageSelector integration tests (2 suites)
│       ├── i18n/           # i18n engine: index.js, languages.js, detect.js, format.js,
│       │   │               # examMessages.js, proctorMessages.js, serverErrors.js, labels.js,
│       │   │               # locales/ (en, hi, kn, ml, ta, te), __tests__/i18n.test.jsx
│       ├── api/            # Axios API clients (client.js, examClient.js,
│       │                   # examProctoringClient.js, learning.js)
│       ├── context/        # AuthContext, GamificationContext, LanguageContext,
│       │   │               # ThemeContext (dark default & light mode provider, localStorage sync,
│       │   │               # cross-tab listener & zero-FOUC bootstrap), TierContext, ToastContext
│       │   └── __tests__/  # ThemeContext integration test suite
│       ├── hooks/          # useExamViolationMonitor, usePresenceMonitor, useWebcamMonitor,
│       │                   # useMagneticHover, useScrollReveal
│       ├── lib/            # faceDetector.js (lazy on-device TensorFlow.js TinyFaceDetector)
│       ├── styles/         # Style modules:
│       │   ├── theme.css   # Single source of truth for semantic dark/light color tokens
│       │   ├── features/   # about-exams.css, admin.css, ai-tutor.css, analytics.css,
│       │   │               # app-shell.css, dashboard.css, exam.css, gamification.css,
│       │   │               # i18n.css, landing.css, learning.css, practice.css, profile.css,
│       │   │               # scrollbar.css, subpages.css, theme-toggle.css, tier.css
│       │   ├── components.css # Shared components + question content protection styling
│       │   └── global.css
│       └── utils/          # Shared utilities: appEvents.js, protectedContent.js,
│                           # subjectVisuals.js (theme-aware subject palettes & SVG icons),
│                           # planSelection.js (plan validation + pricing-button routing),
│                           # tierErrors.js, productEvents.js, visitId.js
├── backend/                # Node.js REST API
│   ├── src/
│   │   ├── controllers/    # 20 route handlers (auth, referral, questions, attempts,
│   │   │                   # analytics, exam, examReport, recommendation,
│   │   │                   # learningRecommendation, gamification, ai, tier, admin × 8)
│   │   ├── models/         # 19 Mongoose models — see Database Models (incl. Referral, UsageCounter,
│   │   │                   # UsageVisit, User.preferredLanguage & User tier/subscription fields)
│   │   ├── routes/         # 11 Express routers (auth, referral, questions, attempts,
│   │   │                   # analytics, recommendations, exams, gamification, admin, ai, tier)
│   │   ├── services/       # service modules — see Service Layer
│   │   │   ├── ai/         # aiService.js (multilingual directives), geminiService.js
│   │   │   ├── billing/    # billingProvider.js (payment-gateway seam; no provider integrated)
│   │   │   ├── gamification/ # gamificationService.js, backfillService.js, config.js
│   │   │   ├── learning/   # index.js + 14 focused modules (ranking, needDetection,
│   │   │   │               # learnerProfile, lifecycle, practiceSet, dailyPlan,
│   │   │   │               # learningPath, history, effectiveness, explanations,
│   │   │   │               # aiExplainer, serializers, constants, errors)
│   │   │   ├── pdf/        # examCertificatePdf.js, examReportPdf.js, pdfHelpers.js
│   │   │   ├── tier/       # tierService.js, subscriptionService.js, usageService.js,
│   │   │   │               # analyticsShaper.js, learningTiering.js
│   │   │   └── emailService.js # Nodemailer transactional email delivery
│   │   ├── middleware/     # authMiddleware, tierMiddleware, contentAccessMiddleware,
│   │   │                   # errorMiddleware, validateObjectIdParam
│   │   ├── config/         # DB connection, examConfig.js, examSubjectMap.js, languages.js,
│   │   │                   # tiers.js (feature matrix, limits, fair-use ceilings, plan catalogue)
│   │   ├── assets/         # Static backend assets
│   │   ├── data/           # Seed/reference data
│   │   └── utils/          # adminBootstrap, generateCertificateId, generateReferralCode,
│   │                       # generateToken, isValidObjectId
│   ├── tests/              # Jest + Supertest suites (16 integration files + unit/ with 5 database-free suites)
│   ├── seedQuestions.js    # Question bank seed script
│   ├── seedDemo.js         # Demo users (incl. Free/Pro/Premium tier demos) + data seed script
│   ├── seedAdmin.js        # Admin user seed script
│   ├── seedLearningContent.js # Learning content library seed script
│   ├── migrateTiers.js     # Idempotent tier migration (backfill tier, provision legacy demos, indexes)
│   ├── resetUsage.js       # Clears plan-usage counters for one user or all demo accounts
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

# 5. (Optional) Seed demo accounts, including the Free / Pro / Premium tier demos
npm --prefix backend run seed:demo

# 6. Start all three services in parallel
npm run dev
```

Individual service commands:

```bash
npm run dev:backend    # Backend only  (port 5000)
npm run dev:frontend   # Frontend only (port 5173)
npm run dev:ml         # ML service only (port 8000)
```

> **Note**: The `dev:ml` script uses a hardcoded `.venv` Python path in `package.json`. Update this to match your local virtual environment location, or activate your `.venv` manually and run `python ml-service/app.py` directly.

### Demo Accounts

Created by `npm --prefix backend run seed:demo` (it wipes and recreates **demo accounts only**). The login page buttons call the normal login endpoint, so these accounts are authorized exactly like real users of their tier.

| Login page button | Email | Password | Tier |
|---|---|---|---|
| Continue as Free Demo | `free.demo@learning.com` | `free@123` | FREE |
| Continue as Pro Demo | `pro.demo@learning.com` | `pro@123` | PRO |
| Continue as Premium Demo | `premium.demo@learning.com` | `premium@123` | PREMIUM |
| Use NEET / CET / JEE Demo | `neet@` / `cet@` / `jee@learning.com` | see `seedDemo.js` | PREMIUM |

Demo accounts show a "Demo Account" label and cannot be re-planned by an admin. Their credentials are public by design — do not seed them into a real production database.

---

## Backend Setup

1. `cd backend`
2. `npm install`
3. Copy `.env.example` → `.env` and fill in values (see below)
4. `npm run seed` or `npm run seed:questions` — populate the question bank
5. `npm run seed:demo` — (optional) load demo users (including the three tier demos) with pre-built data
6. `npm run seed:admin` — (optional) seed an admin account
7. `npm run seed:content` — (optional) seed the learning-content library (`-- --dry-run` validates only, `-- --reset` removes unused seeded rows first)
8. `npm run backfill:gamification` — (optional) backfill XP, levels, streaks, and achievements for existing users or demo accounts
9. `npm run migrate:tiers` — (optional, idempotent) backfill `tier` on existing users, provision legacy demo accounts and build indexes. A missing `tier` already reads as FREE, so the app works before and after it runs.
10. `npm run dev` — start with nodemon

To reset demo data: `npm run reset:demo`
To clear plan-usage counters (e.g. to re-test quotas): `npm run reset:usage -- free.demo@learning.com` (one user) or `npm run reset:usage -- --demo` (every demo account). Attempts, XP and tiers are untouched.

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
| `TIER_USAGE_TIMEZONE` | `Asia/Kolkata` | Timezone that defines the "day" / "month" boundaries for plan usage limits. Optional. |
| `TIER_FAIR_USE_PRACTICE_PER_DAY` | `2000` | Backend fair-use ceiling for "unlimited" practice. Optional. |
| `TIER_FAIR_USE_AI_PER_DAY` | `300` | Fair-use ceiling for "unlimited" AI doubt solving. Optional. |
| `TIER_FAIR_USE_RECOMMENDATIONS_PER_DAY` | `1000` | Fair-use ceiling for "unlimited" recommendations. Optional. |
| `TIER_FAIR_USE_EXAMS_PER_MONTH` | `200` | Fair-use ceiling for "unlimited" exam simulations. Optional. |

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
| `/` | Home / Landing (includes the plan-aware pricing section at `#pricing-section`) | Public |
| `/about-exams` | About Exams (NEET, JEE Main, KCET reference hub) | Public |
| `/login` | Login (supports `?plan=` pass-through; Free/Pro/Premium demo buttons) | Public |
| `/register` | Register (supports `?ref=` referral prefill and `?plan=` plan pass-through) | Public |
| `/dashboard` | Dashboard (plan usage meters) | ✅ |
| `/practice` | Practice Quiz (+ AI Tutor sidebar & Content Protection) | ✅ |
| `/learn` | Personalised Learning Hub | ✅ |
| `/learn/:recommendationId` | Learning Content Detail | ✅ |
| `/analytics` | Analytics & Charts | ✅ |
| `/plans` | Plans & upgrade screen (`?plan=PRO|PREMIUM` selects the plan to upgrade to) | ✅ |
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

A logged-out visit to `/plans?plan=PRO|PREMIUM` redirects to `/login?plan=…`, so the selection survives sign-in.

#### Admin Portal Routes

| Route | Page | Auth |
|---|---|---|
| `/admin/login` | Admin Login | Public |
| `/admin` | Admin Dashboard | ✅ Admin only |
| `/admin/students` | Student List (plan column, plan filter and plan change control) | ✅ Admin only |
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
| `POST` | `/register` | Create account; accepts optional `ref` referral code and initial `language` preference (`en`, `kn`, `hi`, `te`, `ta`, `ml`). Always creates a FREE account — any `tier` / `plan` in the body is ignored. Asynchronously dispatches welcome email if SMTP is configured. |
| `POST` | `/login` | Authenticate, receive JWT and the server-resolved tier. Lazily backfills referral code if absent. Asynchronously dispatches login security confirmation email with IST timestamp. |
| `GET` | `/profile` | Get current user profile including `preferredLanguage` and tier (protected) |
| `PATCH` | `/preferences` | Update account preferences (sets `preferredLanguage` to one of `en`, `kn`, `hi`, `te`, `ta`, `ml`). Protected. |

### Tier & Plans (`/api/tier`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/plans` | Public plan catalogue (marketing data only: names, taglines, limits, features). No user data. |
| `GET` | `/me` | Protected. Server-resolved tier, subscription state, enabled features, limits and current usage. The frontend renders this; it keeps no copy of the matrix. |
| `POST` | `/checkout` | Protected. Validates the requested upgrade target (`PRO` / `PREMIUM`; anything else is `400 INVALID_UPGRADE_TARGET`). Returns `501` until a payment provider is configured — it never changes a tier. |

### Referrals (`/api/referrals`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/me` | Get current user's referral summary (`referralCode`, `friendsInvited`, `successfulSignups`). Protected. Rate-limited to 300 req / 15 min. |

### Questions (`/api/questions`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/subjects-topics` | List all subjects and their topics |
| `GET` | `/` | Fetch questions (filter by exam, subject, topic, difficulty). Refused once the plan's daily practice quota is spent. |

### Attempts (`/api/attempts`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Submit a practice attempt (evaluates correctness, persists performance, processes server-authoritative gamification XP). Metered against the plan's daily practice quota. |
| `GET` | `/me` | Get current user's attempt history |
| `GET` | `/mistake-bank` | Mistake bank; list size is capped by plan |

### Analytics (`/api/analytics`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/me` | Per-topic performance stats, habit insights, exam readiness, and persistent gamification level/XP for current user. Shaped server-side by plan — advanced fields are absent for FREE. |

### Recommendations (`/api/recommendations`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/me` | ML-backed personalized topic recommendations (`?include=learning` additionally returns the learning-content bundle); count and planning detail depend on plan |
| `GET` | `/focus-session` | Returns a focused practice set for the current session (PRO+) |
| `GET` | `/learning` | Full learning-content recommendation bundle (sections, learnNext, dailyPlan). Resolves request language (`?language=` query or `Accept-Language` header) for localized AI-polished rationale. Sections and AI polish are shaped by plan. |
| `GET` | `/learn-next` | Top single learning-content recommendation (with localized AI explanation if enabled) |
| `GET` | `/weak-areas` | Learning content targeting weak topics |
| `GET` | `/mistake-recovery` | Learning content for repeatedly missed concepts (PRO+) |
| `GET` | `/challenges` | Advanced content for mastered topics (PREMIUM) |
| `GET` | `/daily-plan` | Daily learning schedule |
| `GET` | `/:id` | Get a single recommendation by ID |
| `GET` | `/:id/practice` | Practice question set for a recommendation |
| `POST` | `/:id/start` | Mark recommendation as started (the daily recommendations quota is charged here, once per item) |
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
| `GET` | `/history` | Paginated append-only XP event history ledger (anti-farming audit trail). PRO+. |

> **Note**: Gamification routes are strictly read-only by design. There is intentionally no client endpoint to add XP or grant achievements; XP is awarded server-authoritative as a side effect of validated learning actions (answering questions, finishing learning content, or submitting legitimate exams). XP is never throttled by plan.

### AI Tutor (`/api/ai`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/explain` | Streams a Gemini-powered doubt-resolution reply (SSE) for the currently attempted question in the student's chosen language (`language`: `en`, `kn`, `hi`, `te`, `ta`, `ml`), preserving scientific formulas, chemical notations, units, and code identifiers in standard notation. Protected. Rate-limited to 40 req / 15 min, plus the plan's daily AI quota (a stream that errors refunds its unit). |

### Exam Simulation (`/api/exams`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/sessions` | Start a new exam session (metered against the plan's monthly exam quota) |
| `GET` | `/sessions/active/latest` | Fetch the latest active session |
| `GET` | `/sessions/:sessionId` | Get session state |
| `PATCH` | `/sessions/:sessionId/answer` | Save an answer for a question (single-flight guarded) |
| `POST` | `/sessions/:sessionId/violations` | Record a focus violation or presence warning with an idempotent event ID (`TAB_HIDDEN`, `WINDOW_BLUR`, `ROUTE_LEAVE`, `NO_PERSON`). Protected. |
| `POST` | `/sessions/:sessionId/submit` | Finalise and score the exam. Accepts optional submit reason and claimed counters (`MANUAL`, `TIME_EXPIRED`, `MAX_VIOLATIONS`, `PRESENCE_LIMIT`) verified server-side. Legitimate submissions process exam XP. |
| `GET` | `/sessions/:sessionId/report` | Download exam report as PDF (PRO+) |
| `GET` | `/sessions/:sessionId/certificate` | Download completion certificate as PDF (PRO+) |

### Admin (`/api/admin`) — admin role required
| Method | Path | Description |
|---|---|---|
| `POST` | `/login` | Admin authentication |
| `GET` | `/me` | Admin profile |
| `GET` | `/dashboard` | Platform dashboard stats |
| `GET` | `/students` | List all students (filterable, including `?tier=FREE|PRO|PREMIUM`) |
| `GET` | `/students/:id` | Student detail (stored and effective plan, subscription state, usage) |
| `PATCH` | `/students/:id/tier` | Change a student's plan through the subscription service. Refuses demo accounts (`409`). The only way a tier changes today. |
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
| `POST` | `/learning-content` | Create content item (including `accessTier`) |
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

## Subscription Tiers & Access Control

TutorMind has three plans — **FREE**, **PRO** and **PREMIUM**. The frontend controls what the user *sees*; the backend controls what the user is *allowed to do*. The full design, matrix and test list live in [`docs/TIER_SYSTEM.md`](docs/TIER_SYSTEM.md).

### How a request is authorized

```
Request -> protect (JWT -> User row) -> req.tierContext (stored tier + subscription -> EFFECTIVE tier)
        -> requireFeature(F) / requireTier(T)     403 TIER_UPGRADE_REQUIRED | SUBSCRIPTION_EXPIRED
        -> checkUsageLimit(K)                     429 USAGE_LIMIT_REACHED  (atomic reserve, refund on failure)
        -> controller (also shapes data per tier: analytics, mistake bank, recs, learning sections)
```

- **Single source of truth:** `backend/src/config/tiers.js` (feature permissions, limits, fair-use ceilings, plan catalogue). Helpers live in `services/tier/`. Changing a plan cell means editing that file only.
- **Derived, never trusted:** the tier comes from the DB user row on every request. A forged tier in the token, body, headers or query is ignored.
- **Fail-closed middleware:** a mistyped feature / tier / usage key throws at route-definition time instead of silently leaving a route open.
- **Atomic quotas:** one guarded `findOneAndUpdate` per reservation, so concurrent requests cannot both slip under a limit. A request that fails (status ≥ 400), or an AI stream that errors, refunds its unit. Limits reset by changing the period key (IST day / month), with TTL cleanup — no cron job.
- **Expiry:** a paid tier whose end date passed (or status `EXPIRED`) is treated as FREE immediately.
- **One writer of tiers:** `subscriptionService.applySubscription()` — used by admin changes, demo provisioning and (later) verified payment webhooks. No self-service endpoint can change a tier.

### Plan summary

| | FREE | PRO | PREMIUM |
|---|---|---|---|
| Practice questions | 20 / day | 100 / day | Unlimited* |
| AI doubt solving | 5 / day | 30 / day | Unlimited* (advanced tutor mode) |
| Recommendations started | 5 / day | 25 / day | Unlimited* |
| Exam simulations | 2 / month | 10 / month | Unlimited* |
| Advanced analytics & focus sessions | — | ✔ | ✔ |
| Full readiness predictions | Headline score only | Headline score only | ✔ |
| Exam report & certificate PDFs | — | ✔ | ✔ |
| Mistake bank | 10 items | 100 | Full |
| Study plan | 2 topics | 6 topics | Full |
| Adaptive challenges, premium learning content | — | — | ✔ |
| Gamification, 6 UI languages | ✔ | ✔ | ✔ |

\* "Unlimited" in the UI; backend fair-use ceilings (`TIER_FAIR_USE_*`) still apply. See `docs/TIER_SYSTEM.md` for the complete feature matrix.

### Pricing page & plan selection

Choosing a plan on the landing page is **navigation, not entitlement**. The selected plan only decides which screen opens next; it is validated (`FREE` / `PRO` / `PREMIUM`), never sent when registering, and never changes a tier.

```text
Landing pricing card
  |- Free     -> /register                      -> Free dashboard (account starts FREE)
  |- Pro      -> /register?plan=PRO     -> /plans?plan=PRO      -> (future checkout)
  |- Premium  -> /register?plan=PREMIUM -> /plans?plan=PREMIUM  -> (future checkout)
```

Signed-in users get buttons based on their real tier (`resolvePricingAction` in `frontend/src/utils/planSelection.js`):

| Current tier | Free card | Pro card | Premium card |
|---|---|---|---|
| FREE | Open dashboard | Upgrade to Pro | Upgrade to Premium |
| PRO | Open dashboard | Current Plan (disabled) | Upgrade to Premium |
| PREMIUM | Open dashboard | View my plan | Current Plan (disabled) |

Labels are honest: there is no trial mechanism, so no button promises one. The `/plans` upgrade screen (`PlanUpgradePanel`) shows plan benefits, the current plan, subscription status and billing period, then states: *"Online subscription checkout is not available yet. You can continue using your current plan or explore the demo experience."* A separate, confirm-first **Explore Pro/Premium Demo** action signs in to the seeded demo account through the normal login endpoint.

### Payment integration (not implemented)

No payment gateway (Razorpay, Stripe, …) is integrated, and no checkout or success screen pretends otherwise. When one is added, payment stays separate from authorization:

```text
User selects a plan -> authenticated -> backend validates eligibility -> checkout session
  -> provider confirms payment -> backend VERIFIES the confirmation (signature / provider API)
  -> subscription record updated (applySubscription) -> tier activated
```

The seams are `services/billing/billingProvider.js` (`createCheckoutSession`, `handleWebhook`) and `subscriptionService.applySubscription()`. A paid subscription must never be activated from frontend navigation, a `?plan=` query parameter, or a client-supplied success flag. See `docs/TIER_SYSTEM.md` section H.

---

## Learning-Content Recommendations

TutorMind recommends *what to learn next* (study material → practice → re-measure), not just which questions to solve. The engine is deterministic and needs no LLM or API key.

**Pipeline:** student performance → learning-need detection → candidate retrieval (active `LearningContent` only, filtered by the user's tier) → prerequisite expansion → 0-100 ranking → sections / learning path / daily plan → persisted recommendation history → lifecycle (start, progress, complete, feedback) → practice set → before/after measurement → next recommendation.

**Code:** `backend/src/services/learning/` (15 focused modules), models `LearningContent`, `LearningContentProgress`, `LearningRecommendation`, `QuestionRecommendationLog`. Tier shaping is applied inside the engine inputs (`services/tier/learningTiering.js`), not by post-filtering.

**Endpoints (all authenticated):** `GET /api/recommendations/me` (unchanged; `?include=learning` adds the bundle), `GET /api/recommendations/learning`, `learn-next`, `weak-areas`, `mistake-recovery`, `challenges`, `daily-plan`, `focus-session`, `GET /:id`, `GET /:id/practice`, `POST /:id/start|progress|complete|skip|feedback`, and admin `GET/POST/PUT/DELETE /api/admin/learning-content` (+ `/meta`).

**Seeding** (idempotent): `cd backend && npm run seed:questions && npm run seed:content` (`-- --dry-run` validates only, `-- --reset` removes unused seeded rows first).

**Optional AI:** `LEARNING_AI_EXPLANATIONS=true` (with `GEMINI_API_KEY`) lets Gemini rephrase only the top "why" sentence. Ranking never depends on it, and the AI polish is applied for PRO+ only.

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
- **Server-side tier authorization** — every Pro/Premium route is guarded by `requireFeature` / `requireTier`; the tier is derived from the DB on every request, and forged tiers in token/body/headers/query are ignored. A selected plan (`?plan=`) is only a navigation hint and is never proof of entitlement.
- **Atomic usage quotas** — plan limits are reserved with a single guarded database update, so parallel requests cannot exceed a limit; failed requests refund their unit; unlimited plans are still bounded by fair-use ceilings
- **Single tier writer** — only `subscriptionService.applySubscription()` changes a tier (admin action today, verified payment webhook later); registration always creates FREE accounts and no self-service endpoint can upgrade or downgrade
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
| `User` | Account, role (`user`/`admin`), target exam, unique auto-generated `referralCode`, `preferredLanguage` (`en`, `kn`, `hi`, `te`, `ta`, `ml`), `isDemo`, and subscription fields: `tier` (`FREE`/`PRO`/`PREMIUM`, default `FREE`, indexed), `subscriptionStatus` (`ACTIVE`/`EXPIRED`/`CANCELLED`/`PAST_DUE`), start/end dates, and reserved provider fields (never sent to the client) |
| `UsageCounter` | Plan usage per `(user, key, period)` for practice / AI / recommendations / exams, with a unique index and TTL cleanup; limits reset because the period key changes |
| `UsageVisit` | De-duplicates usage charges per page visit so duplicate requests of one visit (double effect, double click) are charged once |
| `Referral` | Tracks successful referred registrations (`referrer`, unique `referredUser`, `referralCode`) |
| `Question` | Question bank — exam, subject, topic, options, answer, explanation |
| `Attempt` | Individual practice attempt record |
| `Performance` | Aggregated per-topic metrics (accuracy, attempts, avg time) |
| `TopicMeta` | Topic catalog for admin management (subjects/topics metadata) |
| `ExamSession` | Full mock exam state — questions, answers, timing, scoring, and proctoring integrity state (`violationCount`, `maximumViolations`, `violationEvents`, `presenceWarningCount`, `maximumPresenceWarnings`, `autoSubmitted`, `autoSubmitReason`) |
| `ExamAuditLog` | Immutable per-answer audit trail for exam integrity |
| `Mistake` | Mistake bank with spaced-repetition fields (3 review stages) |
| `LearningContent` | Study material items powering the recommendation engine (title, type, subject, topic, difficulty, prerequisites, active flag, `accessTier`) |
| `LearningContentProgress` | Per-student progress record for each content item (status, score, time spent) |
| `LearningRecommendation` | Persisted recommendation record including ranking score, lifecycle state, before/after measurement, and the once-per-item quota-charge claim |
| `QuestionRecommendationLog` | Log linking practice questions to a parent recommendation for before/after measurement |
| `GamificationProfile` | Server-authoritative user gamification state (XP, level, level progress, daily/weekly XP, streaks, streak shields, personal bests, historical counters) |
| `GamificationEvent` | Append-only event ledger with unique `(user, dedupeKey)` index preventing XP double-counting and farming |
| `UserAchievement` | Immutable unlock records with unique `(user, achievementId)` index ensuring achievements cannot be lost |
| `ProductEvent` | Internal telemetry events |

Existing users need no migration: a missing `tier` reads as FREE. `npm run migrate:tiers` is an optional, idempotent tidy-up.

---

## Service Layer

| Service | Responsibility |
|---|---|
| `tier/` (5 modules) | Tier system: `tierService` (effective-tier resolution, feature/limit lookups), `subscriptionService` (the only tier writer), `usageService` (atomic quotas, refunds, per-visit de-duplication), `analyticsShaper` (strips advanced analytics for lower plans), `learningTiering` (tier-aware learning sections and content) |
| `billing/billingProvider` | Payment-gateway seam (`createCheckoutSession`, `handleWebhook`); no provider integrated, so checkout returns an honest 501 |
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
| `aiService` | Streaming doubt-resolution chat orchestration (question context + conversation history + multilingual language directives; advanced-tutor prompt for PREMIUM) |
| `geminiService` | Low-level Google Gemini API client — SSE streaming, error translation, quota handling |
| `learning/` (15 modules) | Learning-content recommendation engine: need detection, learner profiling, candidate retrieval & ranking, prerequisite expansion, lifecycle management, practice sets, daily plans, effectiveness tracking, multilingual AI explainer, and serialization |

---

## Testing

### Backend (Jest + Supertest)

Integration tests run against an in-memory MongoDB instance — no external database required (`mongodb-memory-server` downloads a MongoDB binary on first run, so network access is needed once). The tier **unit** suites need no database at all. The backend suite encompasses 21 test suites (16 integration test files + 5 unit test files in `tests/unit/`) with 220 tests total (148 integration tests and 72 database-free unit tests).

```bash
npm --prefix backend run test        # all suites (integration + unit)
npm --prefix backend run test:unit   # database-free unit suites only
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
| `language.test.js` | Language configuration normalization, request language resolution, AI language directive construction, and preferred language profile persistence (`PATCH /api/auth/preferences`) |
| `learning.engine.test.js` | Learning-content recommendation engine (ranking, need detection, lifecycle) |
| `learning.api.test.js` | Learning recommendation REST API integration |
| `referral.test.js` | Referral code generation, invite-based registration, self-referral prevention, and referral summary endpoints |
| `registrationEmail.test.js` | Registration confirmation welcome email delivery and error boundaries |
| `tier.api.test.js` | Registration always FREE (body `tier`/`plan` ignored), tier in login/profile, no self-service upgrade, per-tier gating, quotas (AI / exams / practice), refund, atomic concurrency, period rollover, admin tier change and demo lock, checkout validation (400 for FREE/unknown targets, 501 otherwise, tier never changes) |
| `unit/tier.config.test.js` | Matrix completeness and monotonic limits (Free ≤ Pro ≤ Premium), fail-closed normalisation, expiry rules, IST day/month boundaries |
| `unit/tier.middleware.test.js` | 403/429 bodies, forged tier in body/headers/query ignored, expiry handling, refund-on-failure, analytics shaping |
| `unit/tier.usageWindow.test.js` | Usage period windows and visit de-duplication |
| `unit/tier.aiStream.test.js` | AI streaming quota charge and refund behaviour |
| `unit/tier.routes.wiring.test.js` | Real Express app: FREE / legacy / expired users refused on every Pro/Premium route, 401 when anonymous, non-admin cannot reach admin tier endpoint, checkout is 501 |

### Frontend (Vitest + Testing Library)

```bash
npm --prefix frontend run test
# watch mode:
npm --prefix frontend run test:watch
```

Comprehensive test coverage across 24 test files (146 passing tests):
- `context/__tests__/ThemeContext.test.jsx` — Default dark theme, OS preference isolation, saved light preference restoration, invalid value fallback, instant toggle & persistence, accessible localized action labels, and auth lifecycle decoupling
- `ExamSimulationPage.contentProtection.test.jsx` & `PracticePage.contentProtection.test.jsx` — Question text and option selection restrictions, copy/cut/drag blocking, and context menu suppression
- `ProfilePage.inviteFriends.test.jsx` & `InviteFriendsModal.test.jsx` — Invite modal rendering, referral code loading, link copying, Web Share API, mailto composition, and live signup counters
- `LanguageSelector.test.jsx` — Dropdown rendering, native language labels, route and input state retention during switches, localStorage persistence, and keyboard accessibility (Arrow keys, Enter, Escape)
- `i18n.test.jsx` — Language configuration, translation key parity across all 6 locales (en, kn, hi, te, ta, ml), placeholder consistency, zero-reload switching, fallback hierarchy, and server error translation
- `RegisterPage.referral.test.jsx` — Referral code prefill via `?ref=` query parameter and submission with registration payload
- `ExamSimulationPage.proctoring.test.jsx` — Focus violations, blur grace confirmation, tab hidden detection, on-device presence detection, auto-submission flows, and duplicate prevention
- `ExamSimulationPage.singleFlight.test.jsx` & `ExamSimulationPage.singleFlightController.test.jsx` — Rapid-click deduplication and rate-limit cooldown countdown
- `ExamSimulationPage.integrity.test.jsx` & `ExamSimulationPage.race.test.jsx` — State reconciliation, sequence ordering, out-of-order rejection, and duplicate suppression
- `ExamSimulationPage.crossClient.integrity.test.jsx` — Multi-tab/device session conflict resolution
- `LearnPage.test.jsx` — Learning hub rendering, section display, empty/error/cold-start states, and lifecycle interactions
- `components/tier/__tests__/tier.test.jsx` — TierGate/TierRoute lock UI, quota/expiry/fair-use dialogs, Hindi rendering
- `utils/__tests__/planSelection.test.js` — Plan validation (only FREE/PRO/PREMIUM), `?plan=` URL helpers, all nine current-tier × selected-plan pricing-button outcomes, logged-out routing
- `PricingPlanFlow.test.jsx` — Landing buttons for logged-out / Free / Pro users, plan preserved through register and login (and never sent to the API), logged-out direct navigation to `/plans?plan=…`, honest checkout message with no success text, current-plan states, confirm-then-login demo action, invalid `?plan=` ignored
- Smoke tests for `HomePage`, `AboutExamPage`, `ProfilePage`, `Layout`, and `PasswordField`
- Utility suites for `markdownLite`

---

## CI Pipeline

- **Workflow**: `.github/workflows/backend-ci.yml`
- Triggers on push and pull request to `main`/`master`
- Steps: install backend dependencies → run backend test suite

---

## Notes

- **Subscription Tiers**:
  - Tier enforcement is entirely server-side. The UI (locks, badges, usage meters, upgrade prompts, the sidebar upgrade card, plan-aware pricing buttons) renders what `GET /api/tier/me` returns and is never the source of authorization.
  - Premium *content* is protected per resource (`LearningContent.accessTier`, enforced in the backend and surfaced with an `UpgradePrompt`); advanced analytics and recommendation sections are removed from API responses, not just hidden.
  - There is no real checkout yet and no free-trial mechanism. Pro/Premium can currently be granted only by an admin (or via demo provisioning). The landing hero / nav still say "Start free trial", which simply creates a normal FREE account.
  - Backend Mongo-backed tests (including the tier API tests) need a MongoDB binary; run `npm --prefix backend test` locally once. See `docs/TIER_SYSTEM.md` for the full design and limits.
- **Multilingual & Regional Language Architecture (i18n)**:
  - **Six Supported Languages**: English (`en`), Kannada (`kn` — ಕನ್ನಡ), Hindi (`hi` — हिन्दी), Telugu (`te` — తెలుగు), Tamil (`ta` — தமிழ்), and Malayalam (`ml` — മലയാളം).
  - **Typography & Fontsource Variable Fonts**: Self-hosted `@fontsource-variable` packages for Devanagari, Kannada, Malayalam, Tamil, and Telugu avoid external CDN requests and render crisp native glyphs across all operating systems without layout shifts or font clipping.
  - **Dynamic Chunk Splitting**: The English translation dictionary (~57 KB) is included directly in the core bundle. Regional language bundles (`kn`, `hi`, `te`, `ta`, `ml`) are lazily fetched as separate chunks on demand via Vite dynamic imports (`loadAndActivateLanguage`), preserving lean initial bundle sizes.
  - **Zero-Reload In-Place Re-Rendering**: Language changes trigger immediate React state updates via `react-i18next` without reloading the browser window or clearing in-flight component state. Active form fields, quiz draft answers, and current URL route paths are fully preserved while `<html lang="..." dir="ltr">` attributes are synchronized.
  - **Preference Resolution & Backend Sync**: Preference selection cascades through `localStorage` (`tutormind-language`) → authenticated user profile setting (`User.preferredLanguage`) → browser headers (`navigator.languages` / `Accept-Language`) → English default. Logged-in users automatically synchronize their choice to the database via `PATCH /api/auth/preferences`.
  - **Multilingual AI Tutor Prompting**: When querying the AI Tutor in non-English modes, a dedicated language directive is injected into the Gemini system prompt instructing the model to respond entirely in the student's chosen language while maintaining scientific formulas (e.g. $H_2O$, $\Delta H$, $NaCl$), units ($m/s$, $pH$), chemical symbols, and code identifiers in their standard Unicode/Latin form, with Western numerals (0-9).
  - **Localized Formatting & Error Guarding**: Native `Intl.NumberFormat` and `Intl.DateTimeFormat` handle localized numbers, percentages, and timestamps. Server-side error messages from the backend API are intercepted and translated via `serverErrors.js` to prevent untranslated English error banners from bleeding into regional language sessions.
  - **Accessible Language Selector**: The `LanguageSelector` dropdown component includes full keyboard support (ArrowUp/ArrowDown navigation, Enter selection, Escape dismissal, auto-focus management) and explicit ARIA semantics (`role="listbox"`, `role="option"`, `aria-selected`, `aria-expanded`).
  - **Parity enforced by tests**: every translation key must exist in all six locales (with matching placeholders), so new UI text must be added to `en`, `kn`, `hi`, `te`, `ta` and `ml` together.
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
- **Dual-Theme Design System (Dark & Light Modes)**:
  - **Single Source of Truth**: All color styling across the application is governed by semantic CSS tokens defined in `frontend/src/styles/theme.css`. Components consume semantic CSS custom properties (`--bg`, `--panel`, `--text`, `--primary`, `--border`, RGB channel triplets, etc.) and never hardcode theme colors.
  - **Dark (Default) Palette**: Retains the signature dark glass/aurora aesthetic (`#0f172a`), radial blue/indigo atmospheric gradients, deep glassmorphic surfaces, and crisp glowing accents. Dark mode serves as the platform default whenever no user preference has been saved.
  - **Light Palette**: Delivers a crisp, warm ivory/paper aesthetic (`#f7f6f2`), subtle clean borders, gentle elevation shadows, and deep high-contrast text and badge colors ensuring ≥3:1 graphical contrast and WCAG AA readability.
  - **Zero Flash of Unstyled Theme (Zero-FOUC)**: An inline script in `frontend/index.html` runs synchronously before first paint, reading `localStorage.getItem('tutormind-theme')` and instantly setting `data-theme` on `<html>` and `<meta name="theme-color">` (`#0f172a` for dark, `#f7f6f2` for light), completely eliminating theme flashes on load or refresh.
  - **Zero-Tree Re-render Transitions**: Theme switching modifies the root `<html data-theme="...">` attribute. Because styles consume CSS custom properties directly, no full component tree re-rendering is needed for color updates. A temporary `.theme-transition` class enables a 320ms smooth cross-fade only during active user toggles (never during initial page boot).
  - **Cross-Tab Synchronization & Auth Decoupling**: Theme state is maintained in `localStorage` under `tutormind-theme` and synchronized in real time across open browser tabs via `window.onstorage`. Because theme preference is independent of authentication tokens, selections persist across sign-in, sign-out, and session expirations. The operating system's `prefers-color-scheme` media query is intentionally ignored in favor of explicit user choice.
  - **Accessible Navigation Toggle**: The compact `ThemeToggle` component appears beside the language selector in the shared student header (`Layout`), admin header (`AdminLayout`), landing navigation & mobile drawer (`HomePage`), and floating action bars (`LoginPage` and `RegisterPage`). It renders sun/moon SVG icons, features a subtle entrance rotation micro-animation, and provides localized screen-reader accessibility labels and tooltips (`t('theme.switchToLight')` / `t('theme.switchToDark')`) across all 6 supported languages.
  - **Theme-Aware Data Visualizations & Subjects**: Dynamic subject tokens in `subjectVisuals.js` automatically adjust between dark tones and deeper light tones (Physics, Chemistry, Mathematics, Biology) so charts (Recharts), topic badges, and performance rings retain high visual distinction and contrast across both backgrounds.
