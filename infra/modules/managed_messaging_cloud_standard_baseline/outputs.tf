output "redpanda_secret_ids" {
  value = {
    for secret_role, secret in google_secret_manager_secret.redpanda : secret_role => secret.secret_id
  }
}

output "nats_secret_ids" {
  value = {
    for secret_role, secret in google_secret_manager_secret.nats : secret_role => secret.secret_id
  }
}

output "runtime_contract" {
  value = {
    redpanda = {
      authentication_mode       = var.redpanda_authentication_mode
      tls_enabled               = var.redpanda_tls_enabled
      smoke_topic               = var.redpanda_smoke_topic
      accessor_service_accounts = sort(tolist(var.redpanda_accessor_service_account_emails))
      secret_ids = {
        for secret_role, secret in google_secret_manager_secret.redpanda : secret_role => secret.secret_id
      }
    }
    nats = {
      authentication_mode       = var.nats_authentication_mode
      tls_enabled               = var.nats_tls_enabled
      smoke_subject             = var.nats_smoke_subject
      accessor_service_accounts = sort(tolist(var.nats_accessor_service_account_emails))
      secret_ids = {
        for secret_role, secret in google_secret_manager_secret.nats : secret_role => secret.secret_id
      }
    }
  }
}
