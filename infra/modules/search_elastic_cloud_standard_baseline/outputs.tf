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
    hosting                   = "elastic-cloud"
    authentication_mode       = "api_key"
    locator_precedence        = ["cloud_id", "endpoint"]
    index_name                = var.index_name
    accessor_service_accounts = sort(tolist(var.accessor_service_account_emails))
    secret_ids = {
      for secret_role, secret in google_secret_manager_secret.this : secret_role => secret.secret_id
    }
  }
}
