locals {
  instance_name = var.instance_name != "" ? var.instance_name : "linklynx-${var.environment}-postgres"
  labels = merge(
    {
      component    = "cloud-sql"
      cost_profile = "low-budget"
      environment  = var.environment
      issue        = "lin-1017"
      managed_by   = "terraform"
    },
    var.labels,
  )
}

resource "google_sql_database_instance" "this" {
  project          = var.project_id
  name             = local.instance_name
  region           = var.region
  database_version = var.database_version

  deletion_protection = var.deletion_protection

  settings {
    tier                        = var.tier
    availability_type           = var.availability_type
    disk_type                   = var.disk_type
    disk_size                   = var.disk_size_gb
    disk_autoresize             = var.disk_autoresize
    deletion_protection_enabled = var.deletion_protection
    user_labels                 = local.labels

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.point_in_time_recovery_enabled
      start_time                     = var.backup_start_time
      transaction_log_retention_days = var.transaction_log_retention_days

      backup_retention_settings {
        retained_backups = var.retained_backups
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled       = false
      private_network    = var.network_self_link
      allocated_ip_range = var.allocated_ip_range_name
      ssl_mode           = "ENCRYPTED_ONLY"
    }

    maintenance_window {
      day          = var.maintenance_day
      hour         = var.maintenance_hour
      update_track = var.maintenance_update_track
    }
  }
}

resource "google_sql_database" "application" {
  project  = var.project_id
  instance = google_sql_database_instance.this.name
  name     = var.database_name
}
