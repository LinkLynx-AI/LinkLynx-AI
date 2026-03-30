locals {
  base_labels = merge(
    {
      environment = var.environment
      managed_by  = "terraform"
      scope       = "search"
    },
    var.labels,
  )
}

resource "google_secret_manager_secret" "elastic" {
  for_each = var.elastic_secret_ids

  secret_id = each.value
  labels = merge(
    local.base_labels,
    {
      dependency = "elastic-cloud"
    },
  )

  replication {
    auto {}
  }
}
