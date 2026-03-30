output "elastic_secret_ids" {
  description = "Elastic Cloud placeholder secret IDs."
  value       = sort(keys(google_secret_manager_secret.elastic))
}

output "all_secret_ids" {
  description = "All search placeholder secret IDs."
  value       = sort(keys(google_secret_manager_secret.elastic))
}
