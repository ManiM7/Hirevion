# Hirevion

Hirevion connects candidates with recruiters/companies through real resume ATS
analysis, adaptive skill assessments, and server-side candidate search — no mock
data, no fake scores.

## Features

**Candidates**
- Register, receive a temporary password by email, forced password change on first login
- Resume upload (PDF/DOCX) with real text extraction and section parsing
- Automatic technical skill detection from resume content
- ATS scoring engine (0–100) with a per-section breakdown, weaknesses, and recommendations
- Adaptive-difficulty skill assessments (Easy → Medium → Hard → Expert) generated from detected skills
- Browser-level test-integrity monitoring (tab switch, window blur, fullscreen exit, devtools shortcuts, copy/paste/right-click) with a 2-strike termination policy
- Progress dashboard with score/accuracy history, skill performance, and difficulty progression charts

**Recruiters**
- Register with a company profile (MNC / Startup / Product / Service / Other)
- Server-side candidate search with pagination — filter by skill, location, experience, ATS score, assessment score, role
- Candidate profile view: resume, ATS breakdown, assessment history, activity
- Deterministic, data-grounded "Candidate Overview" summary (rule-based; pluggable AI provider)

**Recruiter–Candidate Connections & Interview Scheduling**
- Recruiter sends a connection request from a candidate's profile; candidate is notified
- Candidate accepts by submitting one or more available time slots, or declines
- Recruiter picks a slot and confirms — creates a real Google Calendar event with an auto-generated Google Meet link via OAuth (never a fake link; a clear setup error if Google isn't configured)
- Both parties are notified with the meeting details and can join directly from their dashboard
- Double-booking and past-date scheduling are prevented server-side; timezones are stored and converted correctly
- Status lifecycle: Pending → Availability Submitted → Scheduled → Completed / Cancelled

**Admin**
- User management (disable/enable accounts)
- Question bank CRUD
- Assessment review, including flagged (terminated/violation) attempts
- Company listing

## Architecture

```
hirevion/
├── client/               React (Vite) SPA
│   └── src/
│       ├── components/   Reusable UI (ProtectedRoute, Spinner)
│       ├── pages/         candidate/, recruiter/, admin/ route pages
│       ├── layouts/        AppLayout (sidebar + topbar)
│       ├── hooks/           useTestIntegrity
│       ├── services/        one file per API resource (axios)
│       ├── context/         AuthContext, ToastContext
│       └── styles/          tokens, base, components, layout, per-feature CSS
│
├── server/               Node.js + Express + MongoDB (Mongoose)
│   ├── controllers/      request/response only
│   ├── services/          business logic (ATS engine, adaptive assessment engine,
│   │                       resume parsing, skill extraction, email, candidate summary)
│   ├── models/             Mongoose schemas
│   ├── routes/              Express routers
│   ├── middleware/          auth, validation, upload, sanitize, error handling
│   ├── utils/                helpers + seed script
│   └── uploads/               resumes/ photos/ logos/ (not statically served except photos/logos)
│
└── .env.example
```

## Tech stack

- **Frontend:** React 18, React Router 7, Axios, Recharts
- **Backend:** Node.js, Express 4
- **Database:** MongoDB + Mongoose
- **Auth:** JWT in an HTTP-only cookie, bcrypt password hashing, per-user `tokenVersion` for instant session invalidation
- **Email:** Nodemailer (SMTP)
- **Resume parsing:** `pdf-parse` (PDF), `mammoth` (DOCX)

## Installation

```bash
npm run install:all   # installs server/ and client/ dependencies
```

## MongoDB setup

Use a local MongoDB instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster. Either way, put the connection string in `server/.env` as `MONGO_URI`.

## Environment variables

Copy `.env.example` to `server/.env` and fill in:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string for signing session tokens |
| `CLIENT_URL` | Frontend origin, used for CORS and email links |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Real SMTP credentials — registration email will fail closed (no account created) without these |
| `UPLOAD_DIR`, `MAX_RESUME_SIZE`, `MAX_PHOTO_SIZE` | Upload limits |
| `AI_PROVIDER`, `AI_API_KEY` | Optional — leave blank to use the deterministic rule-based candidate summary |

## Email setup

Three options, tried in this order — the first one configured wins. Registration correctly fails with an error rather than silently skipping the email if none are set up; the spec requires never pretending an email was sent.

**Option A — Gmail API (recommended for production, especially on hosts like Render).** Sends over HTTPS via the same Google OAuth credentials used for Calendar/Meet below — one setup covers both. Some hosts (Render's free tier included) block outbound SMTP ports entirely, which this avoids. See the Google setup below; it requests both scopes together.

**Option B — SendGrid.** Also sends over HTTPS. Sign up free at [sendgrid.com](https://sendgrid.com/) (100/day free), verify a "Single Sender" email under Settings → Sender Authentication (no domain required), create an API key under Settings → API Keys, and set `SENDGRID_API_KEY` + `SENDGRID_FROM` in `server/.env`.

**Option C — SMTP.** Works locally; may be blocked outbound on some hosts in production. For quick local testing with Gmail:
1. Enable 2-Step Verification on the Google account.
2. Create an [App Password](https://myaccount.google.com/apppasswords).
3. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=<address>`, `SMTP_PASS=<app password>`.

## Google Calendar / Meet + Gmail send setup

One OAuth grant covers both real interview scheduling (Google Meet links) and Option A above (sending real email via the Gmail API). Skip this and scheduling correctly fails with a clear setup error instead of ever faking a meeting link; email falls through to SendGrid/SMTP instead.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project (or use an existing one) and enable both the **Google Calendar API** and the **Gmail API**.
2. Create an OAuth 2.0 Client ID of type **Desktop app**. Copy the Client ID and Client Secret into `server/.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
3. Run `npm run google:auth` from `server/` — it prints a Google consent URL. Open it, sign in with the Google account that should organize interview meetings and send registration emails, and approve access. The script catches the redirect automatically (no copy-paste).
4. The script prints a `GOOGLE_REFRESH_TOKEN` — add it to `server/.env`, along with `GMAIL_SENDER_EMAIL=<the address you signed in with>`, and restart the server.

The refresh token is a long-lived credential stored only in `.env`, the same way every other secret in this project is configured — nothing is written to the database.

## Running

```bash
npm run dev        # runs server + client together (via concurrently)
# or separately:
npm run server
npm run client
```

Backend: http://localhost:5000 · Frontend: http://localhost:5173 (proxies `/api` and `/uploads` to the backend).

## Seeding the question bank

```bash
npm run seed
```

Creates (idempotently):
- An admin account (`ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars, or a generated temp password printed to the console — **not stored anywhere**, so copy it immediately)
- A starter question bank across JavaScript, React, Node.js, MongoDB, Python, SQL, Java, HTML, CSS, and Git, spanning all four difficulty levels

This seed data is question-bank/admin bootstrap only — it never creates fake candidates, résumés, or assessment results.

## API overview

All endpoints are under `/api`. Highlights:

- `POST /api/auth/register` (`role=candidate|recruiter`, multipart for profile photo / company logo)
- `POST /api/auth/login`, `POST /api/auth/change-password`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/PUT /api/candidates/profile`, `POST /api/candidates/resume`, `POST /api/candidates/resume/analyze`, `GET /api/candidates/ats`, `GET /api/candidates/progress`
- `POST /api/assessments/start`, `GET /api/assessments/:id/question`, `POST /api/assessments/:id/answer`, `POST /api/assessments/:id/violation`, `POST /api/assessments/:id/finish`, `GET /api/assessments/:id/result`
- `GET /api/recruiters/candidates` (search + filters + pagination), `GET /api/recruiters/candidates/:id`, `GET /api/recruiters/candidates/:id/resume/file`
- `GET/PUT /api/recruiters/company`, `GET/PUT /api/recruiters/profile`
- `GET /api/admin/users`, `GET/POST/PUT/DELETE /api/admin/questions`, `GET /api/admin/assessments`, `GET /api/admin/assessments/suspicious`
- `POST /api/connections` (recruiter sends a request), `GET /api/connections` (list mine), `GET /api/connections/:id`, `POST /api/connections/:id/availability`, `POST /api/connections/:id/decline`, `POST /api/connections/:id/schedule`, `POST /api/connections/:id/cancel`
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`

Full request/response shapes are in the corresponding route/controller files.

## Security notes

- Passwords are bcrypt-hashed (12 rounds); temporary passwords are never stored or logged in plaintext.
- Sessions are JWTs in HTTP-only, `SameSite=Lax` cookies; a per-user `tokenVersion` is bumped on password change so old tokens — including the temporary-password one — stop working immediately, even before they expire.
- Login is rate-limited per IP and additionally locks an individual account for 15 minutes after 5 failed attempts.
- Uploads are validated by MIME type, extension, and size; stored under randomly generated filenames (the original filename is never trusted for storage).
- Resume files are never statically served — only an authenticated, ownership-checked endpoint can stream them.
- The correct answer to an assessment question is never sent to the frontend before it is submitted; the backend is the sole authority on scoring, timing, and question sequencing.
- MongoDB operator injection (`$ne`, dotted keys, etc.) is stripped from all request input.
- `helmet`, CORS restricted to `CLIENT_URL`, and input validation (`express-validator`) are applied on every route.

## Assessment anti-cheating limitations

The test-integrity system detects practical **browser-level** signals: tab switching, window blur, fullscreen exit, copy/paste, right-click, and common devtools keyboard shortcuts. **It cannot detect or prevent** a candidate using a second physical device, a second computer, or another person off-screen. Treat violation counts as a signal for recruiters to review, not proof of misconduct.

## Known limitations

- Resume parsing is heuristic (regex/section-header based), not ML-based — unusual resume layouts may parse imperfectly.
- The rule-based candidate summary only uses verified platform data; no external LLM is wired up by default (see `server/services/aiProvider.js` to add one).
- The question bank ships with a starter set; add more via `/admin/questions` or the seed script for deeper assessments.

## Testing checklist (manual)

- [x] Candidate register → temporary password email → login → forced change-password → old temp password rejected → login with new password
- [x] Resume upload (PDF/DOCX) → real text extraction → skills detected
- [x] ATS analysis → real, measurable score and section breakdown
- [x] Assessment start → adaptive difficulty escalates on correct answers, holds/backs off on wrong answers
- [x] Tab-switch/window-blur violation → warning 1/2 → second violation terminates the test
- [x] Progress charts reflect real assessment history
- [x] Recruiter search by skill + ATS/assessment filters → correct, paginated results
- [x] Recruiter candidate profile → resume/ATS/assessment/summary all visible
- [x] Admin login → question bank CRUD
