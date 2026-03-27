locals {
  environment = "prod"
}

output "environment" {
  value = local.environment
}

output "project_id" {
  value = var.project_id
}
