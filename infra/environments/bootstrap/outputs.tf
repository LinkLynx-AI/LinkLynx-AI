output "bootstrap_project_id" {
  description = "Bootstrap project ID."
  value       = google_project.bootstrap.project_id
}

output "terraform_state_bucket_name" {
  description = "Shared Terraform state bucket name."
  value       = module.state_backend.bucket_name
}

output "terraform_admin_service_account_email" {
  description = "Terraform admin service account email."
  value       = google_service_account.terraform_admin.email
}

output "environment_project_ids" {
  description = "Runtime project IDs keyed by environment."
  value = {
    for environment, project in module.environment_projects :
    environment => project.project_id
  }
}

output "github_actions_workload_identity_provider_name" {
  description = "Full Workload Identity Provider resource name for GitHub Actions."
  value       = module.github_actions_artifact_publish.workload_identity_provider_name
}

output "github_artifact_publisher_service_account_emails" {
  description = "GitHub Artifact Registry publisher service account emails keyed by environment."
  value       = module.github_actions_artifact_publish.artifact_publisher_service_account_emails
}

output "backend_config_paths" {
  description = "Generated backend config file paths."
  value = {
    for environment, file in local_file.backend_config :
    environment => file.filename
  }
}
