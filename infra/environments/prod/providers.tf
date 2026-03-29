provider "google" {
  project                     = var.project_id
  region                      = var.region
  impersonate_service_account = var.terraform_admin_service_account_email != "" ? var.terraform_admin_service_account_email : null
}

data "google_client_config" "current" {}

provider "kubernetes" {
  host = var.enable_standard_gke_cluster_baseline ? "https://${module.gke_autopilot_standard_cluster[0].cluster_endpoint}" : (
    var.enable_minimal_gke_cluster ? "https://${module.gke_autopilot_minimal[0].cluster_endpoint}" : null
  )
  token = data.google_client_config.current.access_token
  cluster_ca_certificate = var.enable_standard_gke_cluster_baseline ? base64decode(module.gke_autopilot_standard_cluster[0].cluster_ca_certificate) : (
    var.enable_minimal_gke_cluster ? base64decode(module.gke_autopilot_minimal[0].cluster_ca_certificate) : null
  )
}
