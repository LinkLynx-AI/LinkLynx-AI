locals {
  app_labels = merge(
    {
      app        = var.deployment_name
      component  = "dragonfly"
      managed_by = "terraform"
    },
    var.labels,
  )
}

resource "kubernetes_namespace_v1" "this" {
  metadata {
    name   = var.namespace
    labels = local.app_labels
  }
}

resource "kubernetes_service_account_v1" "this" {
  metadata {
    labels    = local.app_labels
    name      = var.service_account_name
    namespace = kubernetes_namespace_v1.this.metadata[0].name
  }

  automount_service_account_token = false
}

resource "kubernetes_deployment_v1" "this" {
  metadata {
    name      = var.deployment_name
    namespace = kubernetes_namespace_v1.this.metadata[0].name
    labels    = local.app_labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = local.app_labels
    }

    template {
      metadata {
        labels = local.app_labels
      }

      spec {
        service_account_name             = kubernetes_service_account_v1.this.metadata[0].name
        automount_service_account_token  = false
        termination_grace_period_seconds = 30

        container {
          name              = "dragonfly"
          image             = var.image
          image_pull_policy = "IfNotPresent"

          port {
            container_port = var.port
            name           = "redis"
          }

          liveness_probe {
            tcp_socket {
              port = "redis"
            }

            initial_delay_seconds = 15
            period_seconds        = 30
            timeout_seconds       = 2
            failure_threshold     = 3
          }

          readiness_probe {
            tcp_socket {
              port = "redis"
            }

            initial_delay_seconds = 5
            period_seconds        = 10
            timeout_seconds       = 2
            failure_threshold     = 3
          }

          resources {
            requests = {
              cpu               = var.cpu_request
              memory            = var.memory_request
              ephemeral-storage = var.ephemeral_storage_request
            }
            limits = {
              cpu               = var.cpu_limit
              memory            = var.memory_limit
              ephemeral-storage = var.ephemeral_storage_limit
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "this" {
  metadata {
    name      = var.service_name
    namespace = kubernetes_namespace_v1.this.metadata[0].name
    labels    = local.app_labels
  }

  spec {
    selector = local.app_labels

    port {
      name        = "redis"
      port        = var.port
      target_port = "redis"
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_network_policy_v1" "default_deny_ingress" {
  metadata {
    name      = "${var.deployment_name}-default-deny-ingress"
    namespace = kubernetes_namespace_v1.this.metadata[0].name
    labels    = local.app_labels
  }

  spec {
    pod_selector {
      match_labels = local.app_labels
    }

    policy_types = ["Ingress"]
  }
}

resource "kubernetes_network_policy_v1" "allow_client_ingress" {
  metadata {
    name      = "${var.deployment_name}-allow-client-ingress"
    namespace = kubernetes_namespace_v1.this.metadata[0].name
    labels    = local.app_labels
  }

  spec {
    pod_selector {
      match_labels = local.app_labels
    }

    ingress {
      dynamic "from" {
        for_each = var.allowed_client_namespaces

        content {
          namespace_selector {
            match_labels = {
              "kubernetes.io/metadata.name" = from.value
            }
          }
        }
      }

      ports {
        port     = tostring(var.port)
        protocol = "TCP"
      }
    }

    policy_types = ["Ingress"]
  }
}
