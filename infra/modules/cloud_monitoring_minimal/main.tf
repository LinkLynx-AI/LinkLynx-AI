locals {
  labels = merge(
    {
      component    = "cloud-monitoring"
      cost_profile = "low-budget"
      environment  = var.environment
      issue        = "lin-1018"
      managed_by   = "terraform"
    },
    var.labels,
  )

  notification_channels = concat(
    [for channel in google_monitoring_notification_channel.email : channel.name],
    var.existing_notification_channels,
  )

  rust_api_restart_filter = join(" AND ", [
    "resource.type = \"k8s_container\"",
    "metric.type = \"kubernetes.io/container/restart_count\"",
    "resource.label.\"cluster_name\" = \"${var.cluster_name}\"",
    "resource.label.\"location\" = \"${var.cluster_location}\"",
    "resource.label.\"namespace_name\" = \"${var.rust_api_namespace}\"",
    "resource.label.\"container_name\" = \"${var.rust_api_container_name}\"",
  ])

  cloud_sql_cpu_filter = join(" AND ", [
    "resource.type = \"cloudsql_database\"",
    "metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\"",
    "resource.label.\"database_id\" = \"${var.project_id}:${var.cloud_sql_instance_name}\"",
  ])

  dashboard_json = jsonencode({
    displayName = "LinkLynx ${upper(var.environment)} low-budget observability"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          xPos   = 0
          yPos   = 0
          width  = 6
          height = 4
          widget = {
            title = "Rust API restart delta"
            xyChart = {
              dataSets = [
                {
                  plotType   = "LINE"
                  targetAxis = "Y1"
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = local.rust_api_restart_filter
                      aggregation = {
                        alignmentPeriod    = "300s"
                        perSeriesAligner   = "ALIGN_DELTA"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields      = ["resource.label.namespace_name"]
                      }
                    }
                  }
                }
              ]
              yAxis = {
                label = "restarts"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          xPos   = 6
          yPos   = 0
          width  = 6
          height = 4
          widget = {
            title = "Cloud SQL CPU utilization"
            xyChart = {
              dataSets = [
                {
                  plotType   = "LINE"
                  targetAxis = "Y1"
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = local.cloud_sql_cpu_filter
                      aggregation = {
                        alignmentPeriod  = "300s"
                        perSeriesAligner = "ALIGN_MEAN"
                      }
                    }
                  }
                }
              ]
              yAxis = {
                label = "utilization"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          xPos   = 0
          yPos   = 4
          width  = 12
          height = 3
          widget = {
            text = {
              content = join("\n", [
                "Low-budget prod-only observability baseline",
                "- Stack: Cloud Monitoring + Cloud Logging",
                "- Scope: GKE cluster, Rust API smoke workload, Cloud SQL",
                "- Runbooks: observability-v0 structured logs/metrics, Cloud SQL migration/PITR",
              ])
              format = "MARKDOWN"
            }
          }
        },
      ]
    }
  })
}

resource "google_monitoring_notification_channel" "email" {
  for_each = var.notification_email_addresses

  project      = var.project_id
  display_name = "LinkLynx ${var.environment} alert ${each.value}"
  type         = "email"
  enabled      = true
  labels = {
    email_address = each.value
  }
  user_labels = local.labels
}

resource "google_monitoring_dashboard" "this" {
  project        = var.project_id
  dashboard_json = local.dashboard_json
}

resource "google_monitoring_alert_policy" "rust_api_restart" {
  project      = var.project_id
  display_name = "LinkLynx ${upper(var.environment)} Rust API restart burst"
  combiner     = "OR"

  conditions {
    display_name = "Rust API restart delta > 0"

    condition_threshold {
      filter          = local.rust_api_restart_filter
      comparison      = "COMPARISON_GT"
      duration        = "0s"
      threshold_value = 0

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.namespace_name"]
      }

      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "See docs/runbooks/observability-v0-structured-logs-metrics-runbook.md and docs/runbooks/edge-rest-ws-routing-drain-runbook.md."
    mime_type = "text/markdown"
  }

  notification_channels = local.notification_channels
  user_labels           = local.labels
}

resource "google_monitoring_alert_policy" "cloud_sql_cpu_high" {
  project      = var.project_id
  display_name = "LinkLynx ${upper(var.environment)} Cloud SQL CPU high"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL CPU utilization > 80%"

    condition_threshold {
      filter          = local.cloud_sql_cpu_filter
      comparison      = "COMPARISON_GT"
      duration        = "300s"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "See docs/runbooks/cloud-monitoring-low-budget-operations-runbook.md and docs/runbooks/postgres-pitr-runbook.md."
    mime_type = "text/markdown"
  }

  notification_channels = local.notification_channels
  user_labels           = local.labels
}
