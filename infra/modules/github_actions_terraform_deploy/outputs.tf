output "terraform_deployer_service_account_emails" {
  description = "GitHub Terraform deployer service account emails keyed by environment."
  value = {
    for environment, service_account in google_service_account.terraform_deployer :
    environment => service_account.email
  }
}
