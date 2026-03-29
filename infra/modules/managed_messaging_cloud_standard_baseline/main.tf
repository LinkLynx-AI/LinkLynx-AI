locals {
  base_labels = merge(
    {
      environment = var.environment
      managed_by  = "terraform"
      scope       = "managed-messaging-cloud"
    },
    var.labels,
  )
  redpanda_accessor_bindings = {
    for binding in setproduct(tolist(keys(var.redpanda_secret_ids)), tolist(var.redpanda_accessor_service_account_emails)) :
    "${binding[0]}::${binding[1]}" => {
      secret_key = binding[0]
      member     = "serviceAccount:${binding[1]}"
    }
  }
  nats_accessor_bindings = {
    for binding in setproduct(tolist(keys(var.nats_secret_ids)), tolist(var.nats_accessor_service_account_emails)) :
    "${binding[0]}::${binding[1]}" => {
      secret_key = binding[0]
      member     = "serviceAccount:${binding[1]}"
    }
  }
}

resource "google_secret_manager_secret" "redpanda" {
  for_each = var.redpanda_secret_ids

  secret_id = each.value
  labels = merge(
    local.base_labels,
    {
      dependency  = "redpanda"
      secret_role = each.key
    },
  )

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "nats" {
  for_each = var.nats_secret_ids

  secret_id = each.value
  labels = merge(
    local.base_labels,
    {
      dependency  = "nats"
      secret_role = each.key
    },
  )

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "redpanda_accessor" {
  for_each = local.redpanda_accessor_bindings

  secret_id = google_secret_manager_secret.redpanda[each.value.secret_key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value.member
}

resource "google_secret_manager_secret_iam_member" "nats_accessor" {
  for_each = local.nats_accessor_bindings

  secret_id = google_secret_manager_secret.nats[each.value.secret_key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value.member
}
