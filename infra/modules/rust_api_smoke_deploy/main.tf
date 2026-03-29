locals {
  app_labels = merge(
    {
      app        = var.deployment_name
      component  = "rust-api-smoke"
      managed_by = "terraform"
    },
    var.labels,
  )
  workload_identity_enabled = length(var.service_account_annotations) > 0
  backend_security_enabled  = trimspace(var.backend_security_policy_name) != ""
  scylla_runtime_env        = { for key in sort(keys(var.scylla_runtime_env)) : key => var.scylla_runtime_env[key] if trimspace(var.scylla_runtime_env[key]) != "" }
}

resource "kubernetes_namespace_v1" "this" {
  metadata {
    name   = var.namespace
    labels = local.app_labels
  }
}

resource "kubernetes_service_account_v1" "this" {
  metadata {
    annotations = var.service_account_annotations
    labels      = local.app_labels
    name        = var.service_account_name
    namespace   = kubernetes_namespace_v1.this.metadata[0].name
  }

  automount_service_account_token = local.workload_identity_enabled
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
        automount_service_account_token  = local.workload_identity_enabled
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

          dynamic "env" {
            for_each = local.scylla_runtime_env

            content {
              name  = env.key
              value = env.value
            }
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

resource "kubernetes_network_policy_v1" "allow_http_ingress" {
  metadata {
    name      = "${var.deployment_name}-allow-http-ingress"
    namespace = kubernetes_namespace_v1.this.metadata[0].name
    labels    = local.app_labels
  }

  spec {
    pod_selector {
      match_labels = local.app_labels
    }

    ingress {
      ports {
        port     = "8080"
        protocol = "TCP"
      }
    }

    policy_types = ["Ingress"]
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

resource "kubernetes_manifest" "backend_policy" {
  count = local.backend_security_enabled ? 1 : 0

  manifest = {
    apiVersion = "networking.gke.io/v1"
    kind       = "GCPBackendPolicy"
    metadata = {
      name      = "${var.service_name}-backend-policy"
      namespace = kubernetes_namespace_v1.this.metadata[0].name
      labels    = local.app_labels
    }
    spec = {
      default = {
        securityPolicy = var.backend_security_policy_name
      }
      targetRef = {
        group = ""
        kind  = "Service"
        name  = kubernetes_service_v1.this.metadata[0].name
      }
    }
  }

  depends_on = [kubernetes_service_v1.this]
}
