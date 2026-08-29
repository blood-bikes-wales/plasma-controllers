# Project overview

## What this is

**Plasma Controller** is the web tool Blood Bikes Wales controllers use to manage medical courier jobs — pickups and deliveries between hospitals — assign riders, track shifts, and look up volunteers and bikes.

It is the controller-facing product for day-to-day dispatch work. Brand and visual standards live in the [brand guidelines](../brand-guidelines.md).

## Who it’s for

- **Controllers** — primary users: jobs board, shift logon, dispatch
- **Admins** — same operational access as controllers
- **Volunteer riders and drivers** — can sign in; see jobs, shifts, and directory (job creation and shift management are limited to controllers/admins)
- **Trustees** — oversight access to operational screens
- **Developers** — building the UI and API integration

## How it works (simple)

1. A controller opens the app and signs in with their **Blood Bikes Wales Google account**.
2. If they hold more than one role (e.g. controller and rider), they **choose which role** to use for this session.
3. On **Jobs**, they see live work from the system — filter by status, search, open a job, create new jobs with hospital addresses, assign riders, and progress jobs through collection and delivery. Relay jobs can be set up with handover points.
4. On **Shifts**, they see who is on duty and can log riders on or off (controllers/admins).
5. On **Directory**, they search for volunteers (by name, role, or area) or bikes (by registration) without loading full lists upfront.
6. **Sign out** clears the session and returns to the login screen.

## What success looks like

- Controllers can move quickly from a hospital call to a clear job and rider assignment
- The board stays easy to scan (status, area, reference)
- Only authorised organisation Google accounts can sign in
- Shift and directory information is available in one place alongside jobs
- Look and feel stay consistent with Blood Bikes Wales brand guidelines

## Risks and limitations

- Access depends on Google Workspace accounts registered with the backend — unknown accounts are rejected at sign-in.
- The Google sign-in token lasts for the browser tab session; closing the tab requires signing in again.
- Some users with multiple roles must pick a role each time they have not already chosen one.
- Job detail loads by searching job lists rather than a dedicated single-job view on the server.
- Maps autocomplete requires Google API keys to be configured in the deployment environment.

## Where to learn more

- Technical overview: [../technical/overview.md](../technical/overview.md)
- Architecture: [../technical/architecture.md](../technical/architecture.md)
- Glossary: [glossary.md](glossary.md)
- Brand guidelines: [../brand-guidelines.md](../brand-guidelines.md)
