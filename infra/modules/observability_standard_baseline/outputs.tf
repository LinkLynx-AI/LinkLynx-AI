output "namespace" {
  value = var.namespace
}

output "grafana_service_name" {
  value = "${var.kube_prometheus_stack_release_name}-grafana"
}

output "loki_gateway_service_name" {
  value = "${var.loki_release_name}-gateway"
}

output "blackbox_release_name" {
  value = helm_release.blackbox_exporter.name
}

output "grafana_port_forward_command" {
  value = "kubectl -n ${var.namespace} port-forward svc/${var.kube_prometheus_stack_release_name}-grafana 3000:80"
}

output "dashboard_configmaps" {
  value = [
    kubernetes_config_map_v1.slo_dashboard.metadata[0].name,
    kubernetes_config_map_v1.dependency_dashboard.metadata[0].name,
  ]
}
