output "namespace" {
  value = kubernetes_namespace_v1.this.metadata[0].name
}

output "service_name" {
  value = kubernetes_service_v1.this.metadata[0].name
}

output "gateway_name" {
  value = var.gateway_name
}

output "public_hostname" {
  value = var.public_hostname
}
