# AI-Based Personalized Learning Platform (NEET, JEE, CET)

Full-stack personalized exam preparation platform with AI-assisted recommendations.

## Tech Stack
- Frontend: React + Vite + Recharts
- Backend: Node.js + Express + MongoDB + JWT
- ML Service: Python + Flask + scikit-learn

## Features Implemented
1. User authentication (register, login, profile via JWT)
2. Subject/topic question bank
3. Practice quiz flow with answer submission
4. Performance tracking (accuracy, attempts, time)
5. Weak topic detection
6. Personalized recommendations
7. Analytics dashboard with chart visualizations

## Project Structure
- frontend: React UI (dark responsive theme)
- backend: REST API + MongoDB models + recommendation orchestration
- ml-service: Weak-topic analytics and lightweight ML scoring

## Backend Setup
1. Open terminal in backend folder.
2. Install dependencies:
   npm install
3. Create .env from .env.example and update values.
4. Seed question bank:
   npm run seed
5. Start backend:
   npm run dev

## Frontend Setup
1. Open terminal in frontend folder.
2. Install dependencies:
   npm install
3. Create .env from .env.example.
4. Start frontend:
   npm run dev

## ML Service Setup
1. Open terminal in ml-service folder.
2. Create virtual environment and activate it.
3. Install dependencies:
   pip install -r requirements.txt
4. Start ML service:
   python app.py

## Core API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/profile
- GET /api/questions/subjects-topics
- GET /api/questions
- POST /api/attempts
- GET /api/attempts/me
- GET /api/analytics/me
- GET /api/recommendations/me

## Suggested Commit Messages By Feature
1. Authentication
   feat(auth): add JWT-based register/login/profile with protected routes

2. Question Bank
   feat(question-bank): add exam-wise subject-topic question schema and retrieval APIs

3. Practice System
   feat(practice): implement quiz attempt submission with correctness and explanation feedback

4. Performance Tracking
   feat(performance): compute and persist per-topic and overall accuracy/time metrics

5. Weak Topic Detection
   feat(analytics): detect weak topics using topic-level performance thresholds

6. Personalized Recommendation
   feat(recommendation): integrate ML analysis service with fallback rule-based recommender

7. Dashboard and Charts
   feat(frontend): build dark-theme dashboard, practice, and analytics pages with Recharts

8. ML Service
   feat(ml-service): add scikit-learn API for attempt analysis and weak-topic ranking

9. Docs and Setup
   docs(setup): add monorepo setup instructions, API overview, and run workflow

## Notes
- The ML layer intentionally uses simple classical ML and heuristic scoring, not deep learning.
- Recommendation endpoint gracefully falls back to rule-based recommendations if the ML API is unavailable.
