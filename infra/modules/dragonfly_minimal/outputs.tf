output "namespace" {
  value = kubernetes_namespace_v1.this.metadata[0].name
}

output "service_name" {
  value = kubernetes_service_v1.this.metadata[0].name
}

output "service_port" {
  value = var.port
}

output "internal_endpoint" {
  value = "${kubernetes_service_v1.this.metadata[0].name}.${kubernetes_namespace_v1.this.metadata[0].name}.svc.cluster.local:${var.port}"
}
