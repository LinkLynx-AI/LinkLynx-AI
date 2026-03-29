output "namespaces" {
  value = [for namespace in sort(keys(kubernetes_namespace_v1.this)) : namespace]
}

output "restricted_ingress_namespaces" {
  value = [for namespace in sort(keys(kubernetes_network_policy_v1.default_deny_restricted_ingress)) : namespace]
}

output "ops_viewer_service_account" {
  value = {
    name      = kubernetes_service_account_v1.ops_viewer.metadata[0].name
    namespace = kubernetes_service_account_v1.ops_viewer.metadata[0].namespace
  }
}
