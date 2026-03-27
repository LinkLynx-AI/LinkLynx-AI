provider "google" {
  project                     = var.project_id
  region                      = var.region
  impersonate_service_account = var.terraform_admin_service_account_email != "" ? var.terraform_admin_service_account_email : null
}
