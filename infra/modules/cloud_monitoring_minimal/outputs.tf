output "dashboard_name" {
  value = google_monitoring_dashboard.this.id
}

output "notification_channels" {
  value = {
    created  = [for channel in google_monitoring_notification_channel.email : channel.name]
    attached = local.notification_channels
  }
}

output "alert_policies" {
  value = {
    cloud_sql_cpu_high = google_monitoring_alert_policy.cloud_sql_cpu_high.name
    rust_api_restart   = google_monitoring_alert_policy.rust_api_restart.name
  }
}
