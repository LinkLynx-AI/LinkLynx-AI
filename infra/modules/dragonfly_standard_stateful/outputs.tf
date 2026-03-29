output "namespace" {
  value = var.namespace
}

output "service_name" {
  value = kubernetes_service_v1.client.metadata[0].name
}

output "service_port" {
  value = var.port
}

output "internal_endpoint" {
  value = "${kubernetes_service_v1.client.metadata[0].name}.${var.namespace}.svc.cluster.local:${var.port}"
}

output "statefulset_name" {
  value = kubernetes_stateful_set_v1.this.metadata[0].name
}
