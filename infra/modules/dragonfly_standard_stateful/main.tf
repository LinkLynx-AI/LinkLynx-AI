locals {
  app_labels = merge(
    {
      app        = var.statefulset_name
      component  = "dragonfly"
      managed_by = "terraform"
    },
    var.labels,
  )
}

resource "kubernetes_service_account_v1" "this" {
  metadata {
    labels    = local.app_labels
    name      = var.service_account_name
    namespace = var.namespace
  }

  automount_service_account_token = false
}

resource "kubernetes_service_v1" "headless" {
  metadata {
    name      = "${var.service_name}-headless"
    namespace = var.namespace
    labels    = local.app_labels
  }

  spec {
    cluster_ip = "None"
    selector   = local.app_labels

    port {
      name        = "redis"
      port        = var.port
      target_port = "redis"
    }
  }
}

resource "kubernetes_service_v1" "client" {
  metadata {
    name      = var.service_name
    namespace = var.namespace
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

resource "kubernetes_stateful_set_v1" "this" {
  metadata {
    name      = var.statefulset_name
    namespace = var.namespace
    labels    = local.app_labels
  }

  spec {
    pod_management_policy = "OrderedReady"
    replicas              = 1
    service_name          = kubernetes_service_v1.headless.metadata[0].name

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
        termination_grace_period_seconds = 60

        affinity {
          pod_anti_affinity {
            preferred_during_scheduling_ignored_during_execution {
              weight = 100

              pod_affinity_term {
                topology_key = "topology.kubernetes.io/zone"

                label_selector {
                  match_labels = local.app_labels
                }
              }
            }
          }
        }

        container {
          name              = "dragonfly"
          image             = var.image
          image_pull_policy = "IfNotPresent"

          port {
            container_port = var.port
            name           = "redis"
          }

          volume_mount {
            mount_path = "/data"
            name       = "data"
          }

          liveness_probe {
            tcp_socket {
              port = "redis"
            }

            initial_delay_seconds = 20
            period_seconds        = 30
            timeout_seconds       = 2
            failure_threshold     = 3
          }

          readiness_probe {
            tcp_socket {
              port = "redis"
            }

            initial_delay_seconds = 10
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

    volume_claim_template {
      metadata {
        name   = "data"
        labels = local.app_labels
      }

      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = var.storage_class_name != "" ? var.storage_class_name : null

        resources {
          requests = {
            storage = var.storage_size
          }
        }
      }
    }
  }
}

resource "kubernetes_pod_disruption_budget_v1" "this" {
  metadata {
    name      = "${var.statefulset_name}-pdb"
    namespace = var.namespace
    labels    = local.app_labels
  }

  spec {
    min_available = "1"

    selector {
      match_labels = local.app_labels
    }
  }
}

resource "kubernetes_network_policy_v1" "default_deny_ingress" {
  metadata {
    name      = "${var.statefulset_name}-default-deny-ingress"
    namespace = var.namespace
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
    name      = "${var.statefulset_name}-allow-client-ingress"
    namespace = var.namespace
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
