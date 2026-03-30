variable "environment" {
  description = "Environment name for labels and dashboard titles."
  type        = string
}

variable "namespace" {
  description = "Namespace where the standard observability stack is installed."
  type        = string
  default     = "observability"
}

variable "labels" {
  description = "Additional labels applied to observability resources."
  type        = map(string)
  default     = {}
}

variable "kube_prometheus_stack_release_name" {
  description = "Helm release name for kube-prometheus-stack."
  type        = string
  default     = "linklynx-monitoring"
}

variable "kube_prometheus_stack_chart_version" {
  description = "Optional pinned kube-prometheus-stack chart version."
  type        = string
  default     = ""
}

variable "loki_release_name" {
  description = "Helm release name for Loki."
  type        = string
  default     = "linklynx-loki"
}

variable "loki_chart_version" {
  description = "Optional pinned Loki chart version."
  type        = string
  default     = ""
}

variable "alloy_release_name" {
  description = "Helm release name for Grafana Alloy."
  type        = string
  default     = "linklynx-alloy"
}

variable "alloy_chart_version" {
  description = "Optional pinned Grafana Alloy chart version."
  type        = string
  default     = ""
}

variable "blackbox_release_name" {
  description = "Helm release name for Prometheus Blackbox Exporter."
  type        = string
  default     = "linklynx-blackbox"
}

variable "blackbox_chart_version" {
  description = "Optional pinned Prometheus Blackbox Exporter chart version."
  type        = string
  default     = ""
}

variable "monitored_app_namespaces" {
  description = "Application namespaces included in dashboard and alert query filters."
  type        = set(string)
  default     = ["api", "frontend", "ai", "data"]
}

variable "api_http_probe_targets" {
  description = "Full HTTP(S) healthcheck URLs probed by blackbox for API reachability."
  type        = set(string)
  default     = []
}

variable "cloud_sql_tcp_targets" {
  description = "TCP targets for Cloud SQL reachability probes. Use host:port form."
  type        = set(string)
  default     = []
}

variable "dragonfly_tcp_targets" {
  description = "TCP targets for Dragonfly reachability probes. Use host:port form."
  type        = set(string)
  default     = []
}

variable "scylla_tcp_targets" {
  description = "TCP targets for Scylla reachability probes. Use host:port form."
  type        = set(string)
  default     = []
}

variable "redpanda_tcp_targets" {
  description = "TCP targets for Redpanda reachability probes. Use host:port form."
  type        = set(string)
  default     = []
}

variable "nats_tcp_targets" {
  description = "TCP targets for NATS reachability probes. Use host:port or provider-required URL form."
  type        = set(string)
  default     = []
}

variable "search_http_probe_targets" {
  description = "HTTP(S) targets for Elastic Cloud reachability probes."
  type        = set(string)
  default     = []
}

variable "discord_webhook_url" {
  description = "Discord webhook URL used by Alertmanager."
  type        = string
  default     = ""
  sensitive   = true
}

variable "discord_mention" {
  description = "Optional Discord mention content prepended to alert notifications."
  type        = string
  default     = "@here"
}

variable "prometheus_retention" {
  description = "Prometheus retention period."
  type        = string
  default     = "15d"
}

variable "prometheus_storage_size" {
  description = "Persistent volume size for Prometheus."
  type        = string
  default     = "50Gi"
}

variable "alertmanager_storage_size" {
  description = "Persistent volume size for Alertmanager."
  type        = string
  default     = "10Gi"
}

variable "grafana_storage_size" {
  description = "Persistent volume size for Grafana."
  type        = string
  default     = "10Gi"
}

variable "loki_storage_size" {
  description = "Persistent volume size for Loki single-binary storage."
  type        = string
  default     = "20Gi"
}

variable "loki_retention_period" {
  description = "Loki retention period."
  type        = string
  default     = "168h"
}
