output "workload_identity_pool_name" {
  description = "Full workload identity pool resource name."
  value       = google_iam_workload_identity_pool.github_actions.name
}

output "workload_identity_provider_name" {
  description = "Full workload identity provider resource name."
  value       = google_iam_workload_identity_pool_provider.github_actions.name
}

output "artifact_publisher_service_account_emails" {
  description = "GitHub artifact publisher service account emails keyed by environment."
  value = {
    for environment, service_account in google_service_account.artifact_publisher :
    environment => service_account.email
  }
}
