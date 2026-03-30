locals {
  base_labels = merge(
    {
      environment = var.environment
      managed_by  = "terraform"
      scope       = "scylla-cloud"
    },
    var.labels,
  )
  accessor_bindings = {
    for binding in setproduct(tolist(keys(var.secret_ids)), tolist(var.accessor_service_account_emails)) :
    "${binding[0]}::${binding[1]}" => {
      secret_key = binding[0]
      member     = "serviceAccount:${binding[1]}"
    }
  }
}

resource "google_secret_manager_secret" "this" {
  for_each = var.secret_ids

  secret_id = each.value
  labels = merge(
    local.base_labels,
    {
      dependency  = "scylla-cloud"
      secret_role = each.key
    },
  )

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each = local.accessor_bindings

  secret_id = google_secret_manager_secret.this[each.value.secret_key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value.member
}
