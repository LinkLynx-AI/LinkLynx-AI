locals {
  environment_specs = {
    staging = {
      project_id          = "${var.project_prefix}-staging"
      project_name        = "${var.project_display_name_prefix} Staging"
      budget_amount       = var.environment_budgets.staging
      budget_display_name = "${var.project_display_name_prefix} staging monthly budget"
    }
    prod = {
      project_id          = "${var.project_prefix}-prod"
      project_name        = "${var.project_display_name_prefix} Production"
      budget_amount       = var.environment_budgets.prod
      budget_display_name = "${var.project_display_name_prefix} production monthly budget"
    }
  }

  state_bucket_name = var.state_bucket_name != "" ? var.state_bucket_name : "${var.project_prefix}-tfstate-${random_id.state_bucket_suffix.hex}"

  terraform_admin_bootstrap_bindings = {
    for role in var.terraform_admin_bootstrap_roles :
    replace(role, "/", "_") => role
  }

  terraform_admin_project_bindings = merge([
    for environment, specification in local.environment_specs : {
      for role in var.terraform_admin_project_roles :
      "${environment}-${replace(role, "/", "_")}" => {
        environment = environment
        role        = role
      }
    }
  ]...)
}

resource "random_id" "state_bucket_suffix" {
  byte_length = 2
}

resource "google_project" "bootstrap" {
  name                = var.bootstrap_project_name
  project_id          = var.bootstrap_project_id
  billing_account     = var.billing_account_id
  auto_create_network = false
  org_id              = var.folder_id == "" ? var.org_id : null
  folder_id           = var.folder_id != "" ? var.folder_id : null
  labels = merge(var.common_labels, {
    component   = "bootstrap"
    environment = "bootstrap"
  })
}

resource "google_project_service" "bootstrap_services" {
  for_each = toset(var.bootstrap_project_services)

  project            = google_project.bootstrap.project_id
  service            = each.value
  disable_on_destroy = false
}

module "state_backend" {
  source = "../../modules/state_backend"

  project_id = google_project.bootstrap.project_id
  bucket_name = local.state_bucket_name
  location   = var.state_bucket_location
  labels = merge(var.common_labels, {
    component   = "tfstate"
    environment = "bootstrap"
  })

  depends_on = [google_project_service.bootstrap_services]
}

resource "google_service_account" "terraform_admin" {
  account_id   = var.terraform_admin_service_account_id
  display_name = "Terraform admin"
  description  = "Bootstrap admin service account for shared infra provisioning."
  project      = google_project.bootstrap.project_id

  depends_on = [google_project_service.bootstrap_services]
}

resource "google_project_iam_member" "terraform_admin_bootstrap_roles" {
  for_each = local.terraform_admin_bootstrap_bindings

  project = google_project.bootstrap.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.terraform_admin.email}"
}

module "environment_projects" {
  for_each = local.environment_specs
  source   = "../../modules/project_baseline"

  project_id                                  = each.value.project_id
  project_name                                = each.value.project_name
  billing_account_id                          = var.billing_account_id
  folder_id                                   = var.folder_id
  org_id                                      = var.org_id
  services                                    = var.project_services
  budget_amount                               = each.value.budget_amount
  budget_currency                             = var.budget_currency
  budget_display_name                         = each.value.budget_display_name
  budget_monitoring_notification_channels     = var.budget_monitoring_notification_channels
  disable_default_budget_alert_recipients     = var.disable_default_budget_alert_recipients
  labels = merge(var.common_labels, {
    environment = each.key
  })
}

resource "google_project_iam_member" "terraform_admin_project_roles" {
  for_each = local.terraform_admin_project_bindings

  project = module.environment_projects[each.value.environment].project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.terraform_admin.email}"
}

resource "local_file" "backend_config" {
  for_each = local.environment_specs

  filename = "${path.module}/../${each.key}/backend.hcl"
  content  = <<-EOT
  bucket = "${module.state_backend.bucket_name}"
  prefix = "env/${each.key}"
  EOT
}
