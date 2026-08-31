# Technical overview

## Purpose

Plasma Controller is a single-page app for **Blood Bikes Wales** volunteer controllers. Controllers sign in with Google Workspace, then manage medical courier jobs (pickup/delivery between hospitals), rider shifts, and a volunteer/bike directory — all backed by the plasma-api backend.

## Stack

| Layer | Choice |
|-------|--------|
| Language / runtime | TypeScript; CI Node 22; Docker Node 24 Alpine |
| Framework / platform | React 19, React Router 8 (SPA, `ssr: false`), Vite 8 |
| UI | Tailwind CSS 4, shadcn (base-nova), Base UI, Lucide |
| Auth | Google Identity Services (ID token); session in `sessionStorage` |
| API | `apiFetch` → plasma-api (`VITE_API_BASE_URL`) |
| Maps | Google Maps Places API (`VITE_GOOGLE_MAPS_API_KEY`) |
| Lint / format | Biome |
| Tests | Vitest, React Testing Library, user-event, jsdom |
| Key integrations | Google Sign-In, Google Maps Places, plasma-api |

## Entrypoints

| Entrypoint | Path |
|------------|------|
| App shell | `app/root.tsx` (`AuthProvider`) |
| Route tree | `app/routes.ts` |
| Index redirect | `app/routes/_index.tsx` → `/login` |
| Login | `app/routes/login.tsx` |
| Auth gate | `app/routes/protected-layout.tsx` |
| App chrome | `app/routes/dashboard-layout.tsx` |
| Jobs board | `app/routes/jobs.tsx` |
| Job detail | `app/routes/jobs.$jobId.tsx` |
| Shifts | `app/routes/shifts.tsx` |
| Directory | `app/routes/directory.tsx` |
| Dev server | `npm run dev` (typically `http://localhost:5173`) |
| Production serve | `npm run build` then `npm run start` |

## How to run

### Prerequisites

- Node.js (prefer CI’s Node 22 for local parity)
- `npm install`
- plasma-api running and reachable (default `http://localhost/api`)
- Copy `.env.example` to `.env` and set:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | plasma-api base URL (no trailing slash) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID for Workspace sign-in |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps key for Places autocomplete |

### Build

```bash
npm install
npm run build
npm run typecheck
```

### Test

```bash
npm test
npm run test:watch
npm run lint
npm run format:check
```

CI (`.github/workflows/ci.yml`) runs lint, format check, and tests on PRs to `main`.

### Local / deploy

```bash
npm run dev
npm run start   # after build
```

Docker: multi-stage `Dockerfile` builds then runs `npm run start`.

## Key paths

| Path | Role |
|------|------|
| `app/routes.ts` | Route registration |
| `app/lib/auth.tsx` | Auth context, `GET /me`, role state |
| `app/lib/api-client.ts` | HTTP client with Bearer token |
| `app/lib/capabilities.ts` | Nav and path access by role |
| `app/lib/jobs.ts` | Job API helpers and types |
| `app/lib/shifts.ts` | Shift logon/logoff API |
| `app/lib/directory.ts` | Directory search API |
| `app/lib/places.ts` | Google Maps Places wrapper |
| `app/components/login-form.tsx` | Google Sign-In button |
| `app/routes/jobs.tsx` | Jobs board (API-backed) |
| `app/routes/jobs.$jobId.tsx` | Job detail and lifecycle |
| `app/routes/shifts.tsx` | Active shifts UI |
| `app/routes/directory.tsx` | Volunteer/bike search |
| `tests/` | Route and lib unit tests |
| `docs/brand-guidelines.md` | Brand / UI tokens |

## Pitfalls

- Root `README.md` is still the React Router template (mentions SSR); this app sets `ssr: false`.
- Google ID token is stored in `sessionStorage` — closing the tab ends the session.
- `fetchJobById` searches active + completed lists client-side; there is no dedicated `GET /jobs/:id` yet.
- Job create and relay need a valid `VITE_GOOGLE_MAPS_API_KEY`; login needs `VITE_GOOGLE_CLIENT_ID`.
- Only admin and controller roles can create jobs or manage shifts; other roles have read-oriented access.
- Prefer these docs over the template README for product truth.
