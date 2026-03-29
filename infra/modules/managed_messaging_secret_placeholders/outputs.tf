output "redpanda_secret_ids" {
  value = sort(keys(google_secret_manager_secret.redpanda))
}

output "nats_secret_ids" {
  value = sort(keys(google_secret_manager_secret.nats))
}

output "all_secret_ids" {
  value = sort(concat(keys(google_secret_manager_secret.redpanda), keys(google_secret_manager_secret.nats)))
}
