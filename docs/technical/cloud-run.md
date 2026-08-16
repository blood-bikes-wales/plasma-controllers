# Cloud Run deploy

## When to use

Bootstrap GCP, apply Terraform for staging or production, or diagnose a failed GitHub Actions deploy of Plasma Controller to Cloud Run.

## Preconditions

- `gcloud` authenticated as someone who can create buckets and enable APIs on `plasma-staging-502110` and `plasma-production`
- Terraform >= 1.6
- GitHub repo `blood-bikes-wales/plasma-controllers`
- Google OAuth Web client ID (same one Plasma API verifies); created in Cloud Console, not Terraform
- Always pair a workspace with its tfvars file: `staging` + `environments/staging.tfvars`, `production` + `environments/production.tfvars`

| Workspace | GCP project | tfvars |
|-----------|-------------|--------|
| `staging` | `plasma-staging-502110` | `infrastructure/environments/staging.tfvars` |
| `production` | `plasma-production` | `infrastructure/environments/production.tfvars` |

`VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID` are Docker **build-args** ([Dockerfile](../../Dockerfile) `build-env` stage). They are not Cloud Run runtime env vars. Changing them requires a new image.

## Steps

### 1. Create the Terraform state bucket (once)

State for both workspaces lives in one bucket (GCS prefixes isolate `staging` / `production`). Create it in staging:

```bash
gcloud storage buckets create gs://plasma-controller-tfstate \
  --project=plasma-staging-502110 \
  --location=europe-west2 \
  --uniform-bucket-level-access

gcloud storage buckets update gs://plasma-controller-tfstate --versioning
```

If the name is taken, change `bucket` in `infrastructure/backend.tf` to a unique name and use that everywhere below.

### 2. First apply from a laptop (each workspace)

Creates APIs, Artifact Registry, Cloud Run (placeholder hello image), public invoker IAM, and GitHub Workload Identity Federation.

```bash
cd infrastructure
gcloud auth application-default login
terraform init

terraform workspace new staging   # skip if it already exists
terraform workspace select staging
terraform apply -var-file=environments/staging.tfvars
```

Repeat with `production` / `environments/production.tfvars` (`terraform workspace new production`).

Copy outputs into GitHub **Environments** named `staging` and `production`:

| GitHub Environment variable / secret | Terraform output |
|--------------------------------------|------------------|
| `WIF_PROVIDER` (variable) | `workload_identity_provider` |
| `WIF_SERVICE_ACCOUNT` (variable) | `deploy_service_account_email` |
| `GCP_PROJECT_ID` (variable) | `plasma-staging-502110` or `plasma-production` |
| `VITE_API_BASE_URL` (variable) | API origin the SPA should call (TODO: verify Cloud Run API URL) |
| `VITE_GOOGLE_CLIENT_ID` (secret) | OAuth Web client ID |

On the production GitHub Environment, require a reviewer so `workflow_dispatch` cannot ship live unattended.

### 3. Ongoing deploys

- **Staging:** push to `main` runs [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) (build/push SHA image, `terraform apply` with `container_image`).
- **Production:** Actions → Deploy → Run workflow → `production` (uses the `production` environment gate).

Bootstrap must have created the Artifact Registry repository before the first Actions push.

### 4. After the first real image

1. Open `service_url` (Terraform output / Cloud Run console). Add it to the OAuth client **Authorized JavaScript origins**.
2. Set Plasma API `FRONTEND_URL` to that origin (API repo / Secret Manager — not this Terraform).
3. Confirm Google Sign-In on the hosted SPA.

No custom domain in this setup; controllers use the `*.run.app` URL until a later change.

## Verification

```bash
cd infrastructure
terraform workspace select staging
terraform output service_url
curl -sI "$(terraform output -raw service_url)"
```

Expect HTTP 200 from the SPA. `terraform fmt -check` and `terraform validate` run on PRs that touch `infrastructure/` ([`.github/workflows/terraform.yml`](../../.github/workflows/terraform.yml)).

## Rollback / recovery

Cloud Run keeps previous revisions. In Console (or `gcloud run services update-traffic`), route 100% traffic to the last good revision.

To pin Terraform at an older image:

```bash
terraform workspace select staging
terraform apply -var-file=environments/staging.tfvars \
  -var="container_image=europe-west2-docker.pkg.dev/plasma-staging-502110/plasma-controller/plasma-controller:<git-sha>"
```

Do not `terraform destroy` production while `deletion_protection` is true (it is, in `production.tfvars`).

## Related

- [GCP hosting](gcp-hosting.md) — options comparison; this repo implements Cloud Run
- [Technical overview](overview.md)
- Non-technical: [Hosting](../non-technical/hosting.md)
- `infrastructure/` — Terraform root
- [PLM-19](https://bloodbikeswales.atlassian.net/browse/PLM-19) — API serverless on `europe-west2`
