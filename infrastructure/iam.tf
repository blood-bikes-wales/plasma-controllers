resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = google_cloud_run_v2_service.controller.project
  location = google_cloud_run_v2_service.controller.location
  name     = google_cloud_run_v2_service.controller.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_project_iam_member" "github_deploy" {
  for_each = toset([
    "roles/run.admin",
    "roles/artifactregistry.admin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountUser",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/resourcemanager.projectIamAdmin",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_deploy.email}"
}

# State lives in one staging-project bucket. objectAdmin is enough to read/write
# .tfstate, but this resource itself is bucket IAM, so CI also needs getIamPolicy /
# setIamPolicy (storage.admin). Project IAM Admin does not cover GCS bucket policies.
resource "google_storage_bucket_iam_member" "github_deploy_tfstate" {
  bucket = var.tfstate_bucket
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.github_deploy.email}"
}
