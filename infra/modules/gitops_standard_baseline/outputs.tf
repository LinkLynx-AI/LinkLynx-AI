output "argocd_namespace" {
  value = var.argocd_namespace
}

output "argocd_release_name" {
  value = helm_release.argocd.name
}

output "rollouts_release_name" {
  value = helm_release.argo_rollouts.name
}

output "gitops_repository_url" {
  value = var.gitops_repository_url
}

output "gitops_target_revision" {
  value = var.gitops_target_revision
}

output "app_project_name" {
  value = var.app_project_name
}

output "applications" {
  value = var.applications
}
