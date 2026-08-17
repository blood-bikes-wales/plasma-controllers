output "service_url" {
  description = "HTTPS URL of the Cloud Run service. Add this origin to the OAuth client and Plasma API FRONTEND_URL."
  value       = google_cloud_run_v2_service.controller.uri
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository resource name."
  value       = google_artifact_registry_repository.controller.id
}

output "container_image_base" {
  description = "Image URI prefix; CI appends :<git-sha>."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repository_id}/${var.service_name}"
}

output "workload_identity_provider" {
  description = "Full WIF provider resource name for google-github-actions/auth."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_service_account_email" {
  description = "Service account GitHub Actions impersonates."
  value       = google_service_account.github_deploy.email
}
