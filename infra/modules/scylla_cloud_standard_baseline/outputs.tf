output "secret_ids" {
  value = {
    for secret_role, secret in google_secret_manager_secret.this : secret_role => secret.secret_id
  }
}

output "secret_resource_ids" {
  value = {
    for secret_role, secret in google_secret_manager_secret.this : secret_role => secret.id
  }
}

output "runtime_contract" {
  value = {
    hosts                     = sort(tolist(var.hosts))
    keyspace                  = var.keyspace
    schema_path               = var.schema_path
    request_timeout_ms        = var.request_timeout_ms
    auth_enabled              = var.auth_enabled
    tls_enabled               = var.tls_enabled
    disallow_shard_aware_port = var.disallow_shard_aware_port
    secret_ids                = { for secret_role, secret in google_secret_manager_secret.this : secret_role => secret.secret_id }
    accessor_service_accounts = sort(tolist(var.accessor_service_account_emails))
  }
}
