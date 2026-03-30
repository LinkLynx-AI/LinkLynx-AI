locals {
  namespace_profiles = {
    frontend = {
      access_boundary    = "public"
      autoscaling_policy = "vpa-primary"
      domain             = "frontend"
      tier               = "application"
    }
    api = {
      access_boundary    = "public"
      autoscaling_policy = "vpa-primary"
      domain             = "api"
      tier               = "application"
    }
    ai = {
      access_boundary    = "internal"
      autoscaling_policy = "spot-ready"
      domain             = "ai"
      tier               = "application"
    }
    data = {
      access_boundary    = "internal"
      autoscaling_policy = "manual"
      domain             = "data"
      tier               = "stateful"
    }
    ops = {
      access_boundary    = "internal"
      autoscaling_policy = "manual"
      domain             = "ops"
      tier               = "operations"
    }
    observability = {
      access_boundary    = "internal"
      autoscaling_policy = "manual"
      domain             = "observability"
      tier               = "operations"
    }
  }

  namespace_definitions = {
    for namespace in var.namespace_names : namespace => merge(
      {
        access_boundary    = "internal"
        autoscaling_policy = "manual"
        domain             = namespace
        tier               = "application"
      },
      lookup(local.namespace_profiles, namespace, {}),
    )
  }

  namespace_labels = {
    for namespace, config in local.namespace_definitions : namespace => merge(
      {
        environment                      = var.environment
        issue                            = "lin-964"
        managed_by                       = "terraform"
        "linklynx.ai/access-boundary"    = config.access_boundary
        "linklynx.ai/autoscaling-policy" = config.autoscaling_policy
        "linklynx.ai/domain"             = config.domain
        "linklynx.ai/tier"               = config.tier
      },
      var.labels,
    )
  }
}

check "namespace_baseline_inputs" {
  assert {
    condition     = length(setsubtract(var.restricted_ingress_namespaces, var.namespace_names)) == 0
    error_message = "restricted_ingress_namespaces must be a subset of namespace_names."
  }

  assert {
    condition     = contains(tolist(var.namespace_names), var.ops_viewer_namespace)
    error_message = "ops_viewer_namespace must be included in namespace_names."
  }
}

resource "kubernetes_namespace_v1" "this" {
  for_each = local.namespace_labels

  metadata {
    name   = each.key
    labels = each.value
  }
}

resource "kubernetes_service_account_v1" "ops_viewer" {
  metadata {
    name      = var.ops_viewer_service_account_name
    namespace = kubernetes_namespace_v1.this[var.ops_viewer_namespace].metadata[0].name
    labels    = local.namespace_labels[var.ops_viewer_namespace]
  }

  automount_service_account_token = false
}

resource "kubernetes_cluster_role_binding_v1" "ops_viewer" {
  metadata {
    name = "${var.environment}-${var.ops_viewer_service_account_name}-view"
    labels = merge(
      {
        environment = var.environment
        issue       = "lin-964"
        managed_by  = "terraform"
      },
      var.labels,
    )
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "view"
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.ops_viewer.metadata[0].name
    namespace = kubernetes_service_account_v1.ops_viewer.metadata[0].namespace
  }
}

resource "kubernetes_network_policy_v1" "default_deny_restricted_ingress" {
  for_each = var.restricted_ingress_namespaces

  metadata {
    name      = "default-deny-ingress"
    namespace = kubernetes_namespace_v1.this[each.key].metadata[0].name
    labels    = local.namespace_labels[each.key]
  }

  spec {
    pod_selector {}

    policy_types = ["Ingress"]
  }
}

resource "kubernetes_network_policy_v1" "allow_same_namespace_ingress" {
  for_each = var.restricted_ingress_namespaces

  metadata {
    name      = "allow-same-namespace-ingress"
    namespace = kubernetes_namespace_v1.this[each.key].metadata[0].name
    labels    = local.namespace_labels[each.key]
  }

  spec {
    pod_selector {}

    ingress {
      from {
        pod_selector {}
      }
    }

    policy_types = ["Ingress"]
  }
}
