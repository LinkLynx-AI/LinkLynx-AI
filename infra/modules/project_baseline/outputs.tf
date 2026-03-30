output "project_id" {
  description = "Created project ID."
  value       = google_project.this.project_id
}

output "project_name" {
  description = "Created project name."
  value       = google_project.this.name
}

output "project_number" {
  description = "Created project number."
  value       = google_project.this.number
}

output "enabled_services" {
  description = "Enabled services for the project."
  value       = sort(keys(google_project_service.services))
}

output "budget_name" {
  description = "Budget resource name."
  value       = google_billing_budget.this.name
}
