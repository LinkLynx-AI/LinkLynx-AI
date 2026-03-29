locals {
  app_labels = merge(
    {
      app        = var.deployment_name
      component  = "rust-api-smoke"
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
    name      = var.service_account_name
    namespace = kubernetes_namespace_v1.this.metadata[0].name
    labels    = local.app_labels
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
    replicas = var.replicas

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
        termination_grace_period_seconds = 120

        container {
          name              = "rust-api"
          image             = var.image
          image_pull_policy = "IfNotPresent"

          port {
            container_port = 8080
            name           = "http"
          }

          env {
            name  = "RUST_LOG"
            value = "info"
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = "http"
            }

            initial_delay_seconds = 5
            period_seconds        = 10
            timeout_seconds       = 2
            failure_threshold     = 3
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = "http"
            }

            initial_delay_seconds = 15
            period_seconds        = 30
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
              cpu               = var.cpu_request
              memory            = var.memory_request
              ephemeral-storage = var.ephemeral_storage_request
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
      name         = "http"
      port         = 8080
      target_port  = "http"
      app_protocol = "HTTP"
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_manifest" "gateway" {
  manifest = {
    apiVersion = "gateway.networking.k8s.io/v1"
    kind       = "Gateway"
    metadata = {
      name      = var.gateway_name
      namespace = kubernetes_namespace_v1.this.metadata[0].name
      annotations = {
        "networking.gke.io/certmap" = var.certificate_map_name
      }
      labels = local.app_labels
    }
    spec = {
      gatewayClassName = "gke-l7-global-external-managed"
      addresses = [
        {
          type  = "NamedAddress"
          value = var.gateway_static_ip_name
        }
      ]
      listeners = [
        {
          name     = "https"
          protocol = "HTTPS"
          port     = 443
          hostname = var.public_hostname
          allowedRoutes = {
            namespaces = {
              from = "Same"
            }
          }
        }
      ]
    }
  }

  depends_on = [kubernetes_service_v1.this]
}

resource "kubernetes_manifest" "route" {
  manifest = {
    apiVersion = "gateway.networking.k8s.io/v1"
    kind       = "HTTPRoute"
    metadata = {
      name      = var.route_name
      namespace = kubernetes_namespace_v1.this.metadata[0].name
      labels    = local.app_labels
    }
    spec = {
      parentRefs = [
        {
          name        = var.gateway_name
          sectionName = "https"
        }
      ]
      hostnames = [var.public_hostname]
      rules = [
        {
          matches = [
            {
              path = {
                type  = "PathPrefix"
                value = "/"
              }
            }
          ]
          backendRefs = [
            {
              name = kubernetes_service_v1.this.metadata[0].name
              port = 8080
            }
          ]
        }
      ]
    }
  }

  depends_on = [kubernetes_manifest.gateway]
}

resource "kubernetes_manifest" "health_check_policy" {
  manifest = {
    apiVersion = "networking.gke.io/v1"
    kind       = "HealthCheckPolicy"
    metadata = {
      name      = var.health_check_policy_name
      namespace = kubernetes_namespace_v1.this.metadata[0].name
      labels    = local.app_labels
    }
    spec = {
      targetRef = {
        group = ""
        kind  = "Service"
        name  = kubernetes_service_v1.this.metadata[0].name
      }
      default = {
        checkIntervalSec   = 15
        timeoutSec         = 5
        healthyThreshold   = 1
        unhealthyThreshold = 2
        logConfig = {
          enabled = true
        }
        config = {
          type = "HTTP"
          httpHealthCheck = {
            portSpecification = "USE_FIXED_PORT"
            port              = 8080
            requestPath       = "/health"
          }
        }
      }
    }
  }

  depends_on = [kubernetes_manifest.route]
}
