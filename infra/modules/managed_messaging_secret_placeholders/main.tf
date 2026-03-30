locals {
  base_labels = merge(
    {
      environment = var.environment
      managed_by  = "terraform"
      scope       = "managed-messaging"
    },
    var.labels,
  )
}

resource "google_secret_manager_secret" "redpanda" {
  for_each = var.redpanda_secret_ids

  secret_id = each.value
  labels = merge(
    local.base_labels,
    {
      dependency = "redpanda"
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
      dependency = "nats"
    },
  )

  replication {
    auto {}
  }
}
