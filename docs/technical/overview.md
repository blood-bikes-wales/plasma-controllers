# Technical overview

## Purpose

Plasma Controller is a single-page app for **Blood Bikes Wales** volunteer controllers. Controllers use it to view and organise medical courier jobs (pickup/delivery between hospitals) and assign riders. On this codebase revision, Google sign-in and job persistence are still stubs; the jobs UI is driven by mock data.

## Stack

| Layer | Choice |
|-------|--------|
| Language / runtime | TypeScript; CI Node 22; Docker Node 24 Alpine |
| Framework / platform | React 19, React Router 8 (SPA, `ssr: false`), Vite 8 |
| UI | Tailwind CSS 4, shadcn (base-nova), Base UI, Lucide |
| Persistence | None — no API client or token store in `app/lib/` yet |
| Lint / format | Biome |
| Tests | Vitest, React Testing Library, user-event, jsdom |
| Key integrations | Planned: Google sign-in + backend API (not wired in this revision) |

## Entrypoints

| Entrypoint | Path |
|------------|------|
| App shell | `app/root.tsx` |
| Route tree | `app/routes.ts` |
| Index redirect | `app/routes/_index.tsx` → `/login` |
| Login | `app/routes/login.tsx` |
| App chrome | `app/routes/dashboard-layout.tsx` |
| Jobs board | `app/routes/jobs.tsx` |
| Dev server | `npm run dev` (typically `http://localhost:5173`) |
| Production serve | `npm run build` then `npm run start` |

## How to run

### Prerequisites

- Node.js (prefer CI’s Node 22 for local parity)
- `npm install`

No `.env` / `VITE_*` variables are required in this revision.

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
| `app/routes/login.tsx` / `app/components/login-form.tsx` | Login UI (stub navigate) |
| `app/routes/dashboard-layout.tsx` | Header + `UserMenu` |
| `app/routes/jobs.tsx` | Jobs board (mock data) |
| `app/components/new-job-drawer.tsx` | New job sheet |
| `app/components/assign-rider-drawer.tsx` | Assign rider sheet |
| `app/lib/utils.ts` | `cn()` helper only |
| `tests/` | Route integration helpers |
| `docs/brand-guidelines.md` | Brand / UI tokens |

## Pitfalls

- Root `README.md` is still the React Router template (mentions SSR); this app sets `ssr: false`.
- “Login with Google” only `console.log`s and navigates to `/jobs` — no GIS, no backend check (`app/components/login-form.tsx`).
- Routes under `dashboard-layout` are **not** auth-gated; dashboard copy still says auth will come later.
- Job create/assign does not persist; assign confirm logs to the console.
- Links toward `/jobs/:id` appear in UI flows but that route is not registered.
- Prefer these docs over the template README for product truth.
