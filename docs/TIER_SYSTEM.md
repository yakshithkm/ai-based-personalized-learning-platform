# TutorMind tier system (FREE / PRO / PREMIUM)

The frontend controls what the user **sees**. The backend controls what the user is **allowed to do**.

## A. Implementation assessment (what was found, how it was integrated)

| Area | Existing | Decision |
|---|---|---|
| Auth | JWT (HS256, pinned) -> `protect` loads the `User` row | Tier is derived from that DB row on every request (`req.tierContext`). Token / body / headers are never consulted. |
| User model | `User` (+ `isAdmin`, `isDemo`) | Extended with tier + subscription fields. No second user system. |
| Admin | Full admin portal (`requireAdmin`) | Added tier column / filter / change control + usage view. |
| Demo users | `neet/cet/jee@learning.com`, seeded by `seedDemo.js` | Extended: three tier demos + existing demos provisioned as PREMIUM. |
| AI | `/api/ai/explain` (Gemini, SSE, key server-side) | Gated + metered; Premium gets an "advanced tutor" prompt. |
| Recommendations | Question recs + learning-content engine (`services/learning`) | Tiering applied *inside* the engine inputs (sections, content tier, AI polish), not by post-filtering. |
| Analytics | One `/analytics/me` payload read by every page | Shaped server-side (`analyticsShaper`) - advanced data is absent from the response for Free. |
| Gamification | XP/levels/streaks/achievements | Basic stays open; `/gamification/history` is Pro+. XP is never throttled. |
| Flashcards | "Coming soon" placeholder page | Reserved `FLASHCARDS` entry in the matrix; nothing to enforce yet. |
| Payments | None | Seam only (`billingProvider.js`); checkout is an honest 501. No Razorpay / Stripe code or dependency. |
| Pricing page | Landing "Simple, transparent pricing" cards; all three buttons called `goToRegister()` | Buttons now route by plan + real tier and preserve the selected plan (see section G). Navigation only - never changes a tier. |

## B. Database changes (MongoDB / Mongoose - no new DB)

**`users`** - new fields, all with defaults, so existing documents keep working (a missing `tier` reads as `FREE`):

| Field | Type | Notes |
|---|---|---|
| `tier` | `FREE`\|`PRO`\|`PREMIUM` | default `FREE`; **indexed** |
| `subscriptionStatus` | `ACTIVE`\|`EXPIRED`\|`CANCELLED`\|`PAST_DUE` | default `ACTIVE` (so FREE accounts also read `ACTIVE`; it describes the subscription record, not account activity) |
| `subscriptionStartDate` / `subscriptionEndDate` | Date \| null | `null` end = non-expiring (admin grant, demo) |
| `subscriptionProvider` / `subscriptionExternalId` | String \| null | reserved for Stripe/Razorpay; never sent to the client |

**`usagecounters`** (new) - one document per `(user, key, period)`:
`{ user, key: PRACTICE|AI|RECOMMENDATIONS|EXAMS, period: "2026-10-05" | "2026-10", count, expiresAt }`
- unique index `{user, key, period}`; TTL index on `expiresAt`.
- Limits reset because the **period key changes** (IST calendar day / month) - no cron, no write until the user actually consumes something. Old rows are garbage-collected by the TTL.
- `Infinity` is never stored: unlimited plans are handled in code and bounded by fair-use ceilings.

**`learningcontents`** - new `accessTier` (`FREE` default). Admin can mark a resource PRO/PREMIUM; it is excluded from recommendations below the user's tier and refused when opened directly.

Existing users: nothing is required (default `FREE`). Optional tidy-up: `npm run migrate:tiers` (idempotent; backfills `tier`, provisions legacy demo accounts, builds indexes).

## C. Access-control architecture

```
Request -> protect (JWT -> User row) -> req.tierContext (stored tier + subscription -> EFFECTIVE tier)
        -> requireFeature(F) / requireTier(T)     403 TIER_UPGRADE_REQUIRED | SUBSCRIPTION_EXPIRED
        -> checkUsageLimit(K)                     429 USAGE_LIMIT_REACHED  (atomic reserve, refund on failure)
        -> controller (also shapes data per tier: analytics, mistake bank, recs, learning sections)
```

* **Single source of truth:** `backend/src/config/tiers.js` (`FEATURE_PERMISSIONS`, `TIER_LIMITS`, `FAIR_USE_CEILINGS`, `PLAN_CATALOG`). Helpers: `services/tier/tierService.js` (`hasFeatureAccess`, `getTierLimits`, `resolveTierContext`...). No `user.tier === "PRO"` anywhere else on the backend.
* **Middleware** (`middleware/tierMiddleware.js`): `requireTier`, `requireFeature`, `checkUsageLimit`, `requireUsageAvailable`, plus imperative `consumeUsage` / `denyFeature`. A mistyped feature/tier/usage key **throws at route-definition time** rather than silently leaving a route open.
* **Atomic quotas:** one `findOneAndUpdate` with a `count <= limit - n` guard - concurrent requests cannot both slip under a limit (tested: 30 parallel reservations vs limit 20 admit exactly 20). A request that fails (status >= 400), or an AI stream that errors, **refunds** its unit.
* **Expiry:** a paid tier whose end date passed (or status `EXPIRED`) is treated as FREE immediately and reported as `SUBSCRIPTION_EXPIRED`. Cancelled-but-paid-through keeps access until the end date.
* **Only one writer of tiers:** `subscriptionService.applySubscription()` - used by admin changes, demo provisioning and (later) payment webhooks. No self-service endpoint can change a tier.
* **Frontend** holds no copy of the matrix. `GET /api/tier/me` returns the server-resolved features/limits/usage; `TierGate`/`TierRoute`/`FeatureLock` only render that. An axios interceptor turns any tier refusal into one app-wide, translated upgrade dialog. UI hints that depend on the tier (pricing button labels, the sidebar upgrade card) read the server-resolved tier from `TierContext` / the auth user and are cosmetic only.

Error body (example):
```json
{ "success": false, "code": "TIER_UPGRADE_REQUIRED", "feature": "ADVANCED_ANALYTICS",
  "requiredTier": "PRO", "currentTier": "FREE", "message": "This feature requires a Pro subscription." }
```
Quota refusals add `usageKey`, `limit`, `used`, `resetsAt`, `fairUse`.

## D. Final tier matrix (actual TutorMind features)

| Feature | Endpoint(s) / enforcement | FREE | PRO | PREMIUM |
|---|---|---|---|---|
| Dashboard, basic analytics, weak-topic list | `/analytics/me` (shaped) | Yes | Yes | Yes |
| Practice | `POST /attempts` metered; `GET /questions` blocked once quota spent | 20/day | 100/day | unlimited* |
| Advanced practice (focus session) | `/recommendations/focus-session` | - | Yes | Yes |
| Advanced analytics (topic mastery, heatmap, weekly trend, concept data, benchmark) | stripped from `/analytics/me` | - | Yes | Yes |
| Readiness predictions (breakdown, forecast, urgency) | stripped from `/analytics/me` | headline score only | headline score only | Full |
| Question recommendations | `/recommendations/me` count + planning internals | 5 | 10 + deeper signals | 20 + deeper signals |
| Learn Next / weak areas / daily plan | viewing is free; the quota is charged when a recommendation is **started** (`POST /recommendations/:id/start`, once per item) | 5 started/day | 25/day | unlimited* |
| Mistake recovery, continue, explore, improvements | learning sections | - | Yes | Yes |
| Adaptive challenges | `/recommendations/challenges` | - | - | Yes |
| Learning path / alternatives | shaped in bundle | - | Yes | Yes |
| AI-personalised explanations in recs | Gemini polish only for PRO+ | - | Yes | Yes |
| Premium learning content | `accessTier` on content | - | - | Yes |
| Study plan | studyStrategy lists capped | 2 topics | 6 topics | Full |
| Mistake bank | `/attempts/mistake-bank` + analytics capped | 10 items | 100 | Full |
| Exam simulation | `POST /exams/sessions` metered | 2/month | 10/month | unlimited* |
| Detailed exam report / certificate (PDF) | `/exams/sessions/:id/report|certificate` | - | Yes | Yes |
| AI doubt solving | `POST /ai/explain` metered | 5/day | 30/day | unlimited* |
| Advanced AI tutor (concept links, traps, follow-up) | prompt mode | - | - | Yes |
| Basic gamification / achievements | - | Yes | Yes | Yes |
| Gamification history | `/gamification/history` | - | Yes | Yes |
| Flashcards | placeholder page today | reserved | reserved | reserved |
| UI languages (all 6) | - | Yes | Yes | Yes |

\* "Unlimited" in the UI; backend fair-use ceilings (env-tunable) still apply.
Change any cell by editing `config/tiers.js` - no other code changes.

## E. Testing

Run: `cd backend && npm run test:unit` (no database needed) and `npm test` (needs MongoDB / `mongodb-memory-server`); `cd frontend && npx vitest run`.

| Suite | Covers |
|---|---|
| `tests/unit/tier.config.test.js` | matrix completeness & monotonic (Free <= Pro <= Premium), limits, fail-closed normalisation, expiry rules, IST day/month boundaries |
| `tests/unit/tier.middleware.test.js` | 403/429 bodies, forged tier in body/headers/query ignored, expired -> `SUBSCRIPTION_EXPIRED`, refund-on-failure, analytics shaping removes data |
| `tests/unit/tier.recommendationStart.test.js` | one charge per recommendation start; duplicate/re-open not charged; claim released on 429 or failed start |
| `tests/unit/tier.routes.wiring.test.js` | real Express app: Free / legacy / expired users refused on every Pro/Premium route; 401 when anonymous; non-admin cannot reach admin tier endpoint; checkout is 501 |
| `tests/tier.api.test.js` (Mongo) | registration always FREE (body `tier` ignored), tier in login/profile, no self-service upgrade, per-tier gating, quotas incl. AI / exams / practice, refund, atomic concurrency, period rollover, admin change + demo lock; **pricing selection: a client-supplied `plan` on register is ignored, and `/tier/checkout` rejects FREE / unknown / missing plans (400), returns 501 for a valid target and never changes the tier** |
| `frontend/.../tier.test.jsx` | TierGate/TierRoute lock UI, quota/expiry/fair-use dialogs, Hindi rendering |
| `frontend/src/utils/__tests__/planSelection.test.js` | plan validation (only FREE/PRO/PREMIUM), `?plan=` URL helpers, all 9 current-tier x selected-plan pricing-button outcomes, logged-out routing |
| `frontend/src/pages/__tests__/PricingPlanFlow.test.jsx` | landing buttons (logged out / Pro / Free users), plan preserved through register and login, register never sends `plan`/`tier` to the API, `/plans` direct navigation while logged out, honest checkout message with no success text, "current plan" states, confirm-then-login demo action, invalid `?plan=` ignored |
| existing suites | learning/gamification/exam/intelligence suites now provision PREMIUM users so they keep testing engine behaviour; the i18n parity test requires every new key in all 6 languages |

Manual presentation script: log in as **Free Demo** (Analytics shows locks, mistake bank capped, report buttons show a Pro badge, Dashboard shows quotas, sidebar shows the upgrade card) -> **Pro Demo** (advanced analytics, reports; Premium prompts on challenges; no upgrade card) -> **Premium Demo** (everything). Spend the Free AI quota (5) to see the limit dialog and the 429 from DevTools.

Pricing-flow script: logged out, click **Upgrade to Pro** on the landing page -> register -> you land on `/plans?plan=PRO` as a FREE user with Pro benefits and the "checkout not available yet" message; refresh the page and the selection persists.

## F. Environment / configuration

All optional (see `backend/.env.example`): `TIER_USAGE_TIMEZONE` (default `Asia/Kolkata`), `TIER_FAIR_USE_PRACTICE_PER_DAY`, `TIER_FAIR_USE_AI_PER_DAY`, `TIER_FAIR_USE_RECOMMENDATIONS_PER_DAY`, `TIER_FAIR_USE_EXAMS_PER_MONTH`. No new services or dependencies.

New scripts: `npm run migrate:tiers`, `npm run test:unit`. After pulling: `npm run seed:demo` to create the tier demo accounts (it wipes and recreates **demo accounts only**).

## Demo accounts

| Button | Email | Password | Tier |
|---|---|---|---|
| Continue as Free Demo | free.demo@learning.com | free@123 | FREE |
| Continue as Pro Demo | pro.demo@learning.com | pro@123 | PRO |
| Continue as Premium Demo | premium.demo@learning.com | premium@123 | PREMIUM |

Ordinary DB users provisioned through `applySubscription`. The buttons call the normal login endpoint - after sign-in they are indistinguishable from real users: same JWT, same middleware, same quotas. `isDemo` only (1) shows a "Demo Account" label and (2) locks the account against admin tier edits. They cannot change tier (no endpoint exists), reach admin routes (`isAdmin` false) or edit subscription fields. The legacy NEET/CET/JEE demos are provisioned PREMIUM. Demo passwords are public by design; do not seed demo accounts in a real production database.

The credentials list lives in one frontend module, `components/tier/demoAccounts.js`, shared by the login page buttons and the upgrade screen's "Explore Pro/Premium Demo" action. Both go through `/auth/login`; neither grants anything on the client.

## G. Pricing page & plan selection

**Principle:** choosing a plan is *navigation*, not entitlement. The selected plan only decides which screen opens next. It is never trusted as proof of purchase, never sent when registering, and never changes a tier. Real tier changes happen only through `subscriptionService.applySubscription()` (admin today, verified payment webhook later).

Supported plan values are `FREE`, `PRO`, `PREMIUM` (`normalizePlan()` in `frontend/src/utils/planSelection.js` accepts any casing and rejects everything else). The backend independently validates the target in `POST /api/tier/checkout`.

**Flow**

```
Landing pricing card
  |- Free     -> /register                      -> Free dashboard (account starts FREE)
  |- Pro      -> /register?plan=PRO     -> /plans?plan=PRO      -> (future checkout)
  |- Premium  -> /register?plan=PREMIUM -> /plans?plan=PREMIUM  -> (future checkout)
```

* Register and Login read `?plan=`, validate it, and after success go to `getPostAuthPath(plan)` (`/plans?plan=PRO|PREMIUM`, otherwise `/dashboard`). The Login <-> Register links carry the parameter. The tier demo buttons on the login page are explicit demo actions and still go to `/dashboard`.
* `ProtectedRoute` keeps the selection when a logged-out visitor opens `/plans?plan=PREMIUM` directly: it redirects to `/login?plan=PREMIUM`.
* The plan lives in the URL, so refreshing an upgrade page or opening it from a bookmark keeps it.

**Logged-in behaviour** (`resolvePricingAction({ plan, user })`, a pure function covered by tests):

| Current tier | Selected plan | Result |
|---|---|---|
| FREE | FREE | "Open dashboard" |
| FREE | PRO | "Upgrade to Pro" -> `/plans?plan=PRO` |
| FREE | PREMIUM | "Upgrade to Premium" -> `/plans?plan=PREMIUM` |
| PRO | FREE | "Open dashboard" |
| PRO | PRO | disabled "Current Plan" |
| PRO | PREMIUM | "Upgrade to Premium" -> `/plans?plan=PREMIUM` |
| PREMIUM | FREE | "Open dashboard" |
| PREMIUM | PRO | "View my plan" -> `/plans` |
| PREMIUM | PREMIUM | disabled "Current Plan" |

The card matching the account's plan also shows a "Your current plan" tag. Admin sessions are sent to `/admin`. Buttons are disabled until the auth state has loaded.

**Labels are honest.** There is no trial mechanism, so the Pro button says "Upgrade to Pro" (not "Start Pro trial") and Premium says "Upgrade to Premium". If a real trial system is added later, change `home.pricing.pro.cta` in the locale files.

**Upgrade screen** (`/plans`, `pages/PlansPage.jsx` + reusable `components/tier/PlanUpgradePanel.jsx`). With a valid `?plan=PRO|PREMIUM` and a lower real tier it shows: current plan, selected plan, subscription status, billing period, the plan's benefits, an activation note ("selecting a plan does not change your account"), and a checkout button. For a user already on that plan (or a higher one) it shows "X is your current plan" / "Your Y plan already includes X" with no checkout. Invalid `?plan=` values show no panel.

* **Checkout is honest.** The button calls `POST /api/tier/checkout`, which returns 501 until a provider exists; the panel then shows "Online subscription checkout is not available yet. You can continue using your current plan or explore the demo experience." (`tier.plans.checkoutBody`, overridable through the panel's `checkoutNotice` prop). No payment page, no success message, no tier change. Demo accounts cannot start checkout.
* **Explore demo.** A separate, clearly labelled "Explore Pro/Premium Demo" action asks for confirmation (it signs the user out of their own account), then signs in to the seeded demo account through the normal login endpoint. Pricing clicks never switch accounts silently.
* **Reusable for payments.** `PlanUpgradePanel` is presentational. A payment integration drives it through props (`checkoutState`, `onCheckout`, `checkoutNotice`, `subscription`) without a redesign.

**Related UI rules**

* The sidebar "Unlock Your Potential" card is shown to FREE accounts only (hidden for PRO / PREMIUM and while the tier is still loading) and links to `/plans?plan=PRO`. The logout button is pinned to the bottom of the sidebar either way.
* Admin > Students > Plan dropdown tooltip: FREE rows read "Free plan (no paid subscription)", paid rows read "Subscription: <status>", demo rows read "Demo accounts have a fixed plan". The tooltip describes the subscription record; the separate STATUS column describes learner activity.

## H. Future payment integration (Stripe / Razorpay)

Intended flow: user selects a plan -> authenticated -> backend validates eligibility -> checkout session -> provider confirms payment -> backend **verifies** the confirmation (signature / provider API) -> subscription record updated -> tier activated. Payment processing stays separate from tier authorization, and a real paid subscription must never be activated from frontend navigation, query parameters (`?plan=`), or a client-supplied success flag.

Everything funnels through two seams:
1. `services/billing/billingProvider.js` - implement `createCheckoutSession(user, tier)` and `handleWebhook(rawBody, headers)`; return it from `getBillingProvider()` when its env vars exist. `POST /api/tier/checkout` and the Plans / upgrade screen buttons already call it (they show "checkout not available" until then).
2. In the webhook, verify the signature then call `subscriptionService.applySubscription(userId, { tier, status, startDate, endDate, provider, externalId })` on paid / renewed / failed / cancelled events. Mount the webhook route **before** `express.json()` in `app.js` (raw body needed).

No middleware, config, or frontend change is required: access is derived from `tier` + `subscriptionStatus` + `subscriptionEndDate` on every request, and expiry already downgrades automatically. On the frontend, feed the real checkout / payment state into `PlanUpgradePanel`.

## Known limits / not done

* **Recommendations quota:** viewing the Learn page, refreshing, or switching language never costs quota. The daily "recommendations" quota is charged when a recommendation is started, exactly once per item (an atomic `quotaCharged` claim on the recommendation makes double requests, reloads and re-opening free). To change what counts, edit `learningRecommendationController.startRecommendation`, or raise `recommendationsPerDay` in `config/tiers.js`.
* Flashcards and a standalone study-plan generator don't exist as backend features, so only reserved/shaped entries exist for them.
* `TierRoute` is provided and tested, but no current page is wholly Pro/Premium-only, so none is wrapped; premium *content* is protected per-resource (backend `accessTier` + `UpgradePrompt` on the content page).
* **No real checkout or trial yet.** Pro / Premium cannot be activated by users; there is no trial duration or eligibility logic, so no button offers a trial. The landing hero / nav still say "Start free trial" (`home.startFreeTrial`); that creates a normal FREE account, and you may want to reword it.
* The Kannada, Hindi, Telugu, Tamil and Malayalam strings added for the pricing / upgrade flow are machine-assisted translations that follow the existing terminology; have a native speaker review them.
* Backend Mongo-backed tests (`tier.api.test.js`, including the two pricing-selection tests, and the pre-existing suites) were written/updated but could not be executed in the authoring sandbox (MongoDB binary download blocked) - run `npm test` once locally. The backend unit suite and the full frontend suite were run and pass.