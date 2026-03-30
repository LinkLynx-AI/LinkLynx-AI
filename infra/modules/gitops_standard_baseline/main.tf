locals {
  common_labels = merge(
    {
      environment = var.environment
      managed_by  = "terraform"
    },
    var.labels,
  )
}

resource "helm_release" "argocd" {
  name             = var.argocd_release_name
  namespace        = var.argocd_namespace
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = trimspace(var.argocd_chart_version) != "" ? trimspace(var.argocd_chart_version) : null
  create_namespace = false
  wait             = true
  atomic           = true
  cleanup_on_fail  = true
  timeout          = 600
  max_history      = 3
  values = [yamlencode({
    global = {
      additionalLabels = local.common_labels
    }
  })]
}

resource "helm_release" "argo_rollouts" {
  name             = var.rollouts_release_name
  namespace        = var.argocd_namespace
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-rollouts"
  version          = trimspace(var.rollouts_chart_version) != "" ? trimspace(var.rollouts_chart_version) : null
  create_namespace = false
  wait             = true
  atomic           = true
  cleanup_on_fail  = true
  timeout          = 600
  max_history      = 3
  values = [yamlencode({
    controller = {
      labels = local.common_labels
    }
  })]
}
