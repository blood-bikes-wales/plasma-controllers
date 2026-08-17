variable "project_id" {
  description = "GCP project for this workspace (staging or production)."
  type        = string
}

variable "region" {
  description = "GCP region for Artifact Registry and Cloud Run."
  type        = string
  default     = "europe-west2"
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "plasma-controller"
}

variable "artifact_repository_id" {
  description = "Artifact Registry Docker repository ID."
  type        = string
  default     = "plasma-controller"
}

variable "container_image" {
  description = "Full container image URI including tag. CI overrides this with a git SHA tag. Do not use latest."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "github_repository" {
  description = "GitHub repository allowed to impersonate the deploy service account (org/name)."
  type        = string
  default     = "blood-bikes-wales/plasma-controllers"
}

variable "deletion_protection" {
  description = "Prevent Terraform from destroying the Cloud Run service."
  type        = bool
  default     = true
}

variable "tfstate_bucket" {
  description = "GCS bucket holding Terraform state for all workspaces. Created once in staging; both deploy service accounts need object access."
  type        = string
  default     = "plasma-controller-tfstate"
}
