# Hosting Plasma Controller

## What this is

Plasma Controller is the web tool controllers use in the browser. This page explains **where that website lives** on Google Cloud. The charity already uses Google Cloud for Plasma API (the system behind the scenes). The website and the API are separate: one is the screen controllers see; the other stores and checks jobs and sign-in.

The website is set up to run on **Cloud Run** (the same kind of Google Cloud service planned for the API), in London (`europe-west2`). Staging and live are different Google Cloud projects so a trial cannot be confused with the real board.

## Who it’s for

- **Charity leads / trustees** — cost, where the site lives, staging vs live
- **Controllers** — they only need the web address; they do not manage hosting
- **Ops / technical volunteers** — who owns the Google Cloud projects and runs the first setup

## How it works (simple)

1. A controller opens a normal HTTPS web address in the browser (staging or live).
2. Google Cloud Run serves the website files (the pages, layout, and scripts).
3. After Google sign-in, the browser talks to **Plasma API** for real data. That API is planned to run as a Google Cloud service in London.
4. Only people with the organisation’s Google accounts should get in, once sign-in is fully switched on.

We also looked at Firebase Hosting and Cloud Storage behind a load balancer. This repository uses Cloud Run so the website and API share one platform. The load-balancer option costs more than we need at this scale.

## Staging and production

| Environment | Purpose | Google Cloud project |
|-------------|---------|----------------------|
| Staging | Try a release before controllers rely on it | `plasma-staging-502110` |
| Production (live) | What controllers use day to day | `plasma-production` |

Exact public web addresses are the Cloud Run `*.run.app` URLs until a custom domain is chosen (TODO: verify). Staging deploys when code lands on `main`. Live deploys are started by hand and can require a reviewer.

## Who owns this

Google Cloud billing and projects sit with Blood Bikes Wales technical volunteers (the same Plasma API projects). Controllers do not need Google Cloud access. Engineers follow the [Cloud Run deploy](../technical/cloud-run.md) runbook for first-time setup and GitHub Environment values.

## What success looks like

- Controllers open one bookmarkable HTTPS address and reach the jobs board
- Staging exists so a bad release can be caught before it hits live
- Cost stays low (the site can scale to zero when nobody is using it)
- Sign-in still uses the organisation’s Google accounts, same as the API expects

## Risks and limitations

- The site is **not live until** the first Terraform apply and GitHub Environment values are in place (see the runbook).
- Sign-in and live jobs still depend on Plasma API being available and on the correct Google Cloud settings (allowed website address, same Google sign-in client).
- The first visit after idle time can be a little slow (the service wakes up). We are **not** adding extra website caching. Traffic is low.

## Where to learn more

- Technical hosting: [../technical/gcp-hosting.md](../technical/gcp-hosting.md)
- Deploy runbook: [../technical/cloud-run.md](../technical/cloud-run.md)
- What the product is: [overview.md](overview.md)
- Glossary: [glossary.md](glossary.md)
