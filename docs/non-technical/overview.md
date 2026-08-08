# Project overview

## What this is

**Plasma Controller** is the web tool Blood Bikes Wales controllers will use to see and organise medical courier jobs — pickups and deliveries between hospitals — and to assign volunteer riders.

It is the controller-facing product for day-to-day dispatch work. Brand and visual standards live in the [brand guidelines](../brand-guidelines.md).

## Who it’s for

- **Controllers** — primary users of the jobs board
- **Volunteer riders** — people controllers assign to jobs
- **Charity leads / trustees** — care that the right people can use the tool safely
- **Developers** — building the UI and (next) real sign-in and backend links

## How it works (simple)

1. A controller opens the app and lands on the sign-in screen.
2. They use **Login with Google** (today this is a placeholder that opens the jobs board without a real Google check).
3. On **Jobs**, they can filter and search sample work, start a **new job**, and **assign a rider**.
4. Sign-out in the user menu is also a placeholder for now.

## What success looks like

- Controllers can move quickly from a hospital call to a clear job and rider assignment
- The board stays easy to scan (status, urgency, area)
- Only authorised organisation accounts can sign in (once real auth is switched on)
- Look and feel stay consistent with Blood Bikes Wales brand guidelines

## Risks and limitations

- **Sign-in is not real yet** — anyone who can open the app can click through to the board.
- **Jobs are sample data** — create and assign do not save to a live system yet.
- Some “open job” links are unfinished (job detail page still to come).
- Dashboard text still notes that authentication gating is a future update.

## Where to learn more

- Technical overview: [../technical/overview.md](../technical/overview.md)
- Architecture: [../technical/architecture.md](../technical/architecture.md)
- Glossary: [glossary.md](glossary.md)
- Brand guidelines: [../brand-guidelines.md](../brand-guidelines.md)
