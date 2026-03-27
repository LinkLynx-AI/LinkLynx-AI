locals {
  base_name = "linklynx-${var.environment}"

  labels = merge(
    {
      environment = var.environment
      issue       = "lin-963"
      managed_by  = "terraform"
    },
    var.labels,
  )

  network_name                      = var.network_name != "" ? var.network_name : "${local.base_name}-vpc"
  gke_nodes_subnet_name             = "${local.base_name}-gke-nodes"
  db_private_subnet_name            = "${local.base_name}-db-private"
  proxy_only_subnet_name            = "${local.base_name}-proxy-only"
  psc_subnet_name                   = "${local.base_name}-psc"
  private_service_access_range_name = "${local.base_name}-private-services"
  public_lb_ipv4_name               = "${local.base_name}-edge-ipv4"
  cloud_armor_policy_name           = "${local.base_name}-edge-baseline"
  public_certificate_name           = "${local.base_name}-edge-cert"
  public_certificate_map_name       = "${local.base_name}-edge-cert-map"

  normalized_public_dns_name   = trimspace(var.public_dns_name) == "" ? "" : "${trimsuffix(lower(trimspace(var.public_dns_name)), ".")}."
  normalized_public_dns_suffix = trimspace(var.public_dns_name) == "" ? "" : trimsuffix(lower(trimspace(var.public_dns_name)), ".")
  public_hostnames = toset([
    for hostname in var.public_hostnames : trimsuffix(lower(trimspace(hostname)), ".")
    if trimspace(hostname) != ""
  ])
  public_hostnames_fqdn = {
    for hostname in local.public_hostnames : hostname => "${hostname}."
  }
  public_dns_enabled = trimspace(var.public_dns_zone_name) != "" && local.normalized_public_dns_name != "" && length(local.public_hostnames) > 0
}

resource "google_compute_network" "this" {
  name                            = local.network_name
  auto_create_subnetworks         = false
  routing_mode                    = var.routing_mode
  delete_default_routes_on_create = false
}

resource "google_compute_subnetwork" "gke_nodes" {
  name                     = local.gke_nodes_subnet_name
  ip_cidr_range            = var.gke_nodes_subnet_cidr
  region                   = var.region
  network                  = google_compute_network.this.id
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = var.gke_pods_secondary_range_name
    ip_cidr_range = var.gke_pods_secondary_range_cidr
  }

  secondary_ip_range {
    range_name    = var.gke_services_secondary_range_name
    ip_cidr_range = var.gke_services_secondary_range_cidr
  }

  stack_type = "IPV4_ONLY"
}

resource "google_compute_subnetwork" "db_private" {
  name                     = local.db_private_subnet_name
  ip_cidr_range            = var.db_private_subnet_cidr
  region                   = var.region
  network                  = google_compute_network.this.id
  private_ip_google_access = true
  stack_type               = "IPV4_ONLY"
}

resource "google_compute_subnetwork" "proxy_only" {
  name          = local.proxy_only_subnet_name
  ip_cidr_range = var.proxy_only_subnet_cidr
  region        = var.region
  network       = google_compute_network.this.id
  purpose       = "REGIONAL_MANAGED_PROXY"
  role          = "ACTIVE"
  stack_type    = "IPV4_ONLY"
}

resource "google_compute_subnetwork" "psc" {
  name          = local.psc_subnet_name
  ip_cidr_range = var.psc_subnet_cidr
  region        = var.region
  network       = google_compute_network.this.id
  purpose       = "PRIVATE_SERVICE_CONNECT"
  stack_type    = "IPV4_ONLY"
}

resource "google_compute_global_address" "private_service_access" {
  name          = local.private_service_access_range_name
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = tonumber(split("/", var.private_service_access_cidr)[1])
  address       = cidrhost(var.private_service_access_cidr, 0)
  network       = google_compute_network.this.id
}

resource "google_service_networking_connection" "private_service_access" {
  network                 = google_compute_network.this.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_access.name]
}

resource "google_compute_global_address" "public_lb_ipv4" {
  name = local.public_lb_ipv4_name
}

resource "google_compute_security_policy" "edge" {
  name        = local.cloud_armor_policy_name
  description = "Baseline backend security policy for ${var.environment} public edge."

  rule {
    action      = "allow"
    priority    = 2147483647
    description = "Default allow. Managed WAF rules are added in LIN-973."

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}

resource "google_dns_managed_zone" "public" {
  count = local.public_dns_enabled ? 1 : 0

  name        = var.public_dns_zone_name
  dns_name    = local.normalized_public_dns_name
  description = "Public zone for ${var.environment} edge hostnames."
  visibility  = "public"

  lifecycle {
    precondition {
      condition = alltrue([
        for hostname in local.public_hostnames :
        hostname == local.normalized_public_dns_suffix || endswith(hostname, ".${local.normalized_public_dns_suffix}")
      ])
      error_message = "public_hostnames must all belong to public_dns_name."
    }
  }
}

resource "google_dns_record_set" "public_ipv4" {
  for_each = local.public_dns_enabled ? local.public_hostnames_fqdn : {}

  managed_zone = google_dns_managed_zone.public[0].name
  name         = each.value
  type         = "A"
  ttl          = var.public_dns_record_ttl
  rrdatas      = [google_compute_global_address.public_lb_ipv4.address]
}

resource "google_certificate_manager_dns_authorization" "public" {
  for_each = local.public_dns_enabled ? local.public_hostnames_fqdn : {}

  name        = "${substr(local.base_name, 0, 30)}-dns-${substr(md5(each.key), 0, 8)}"
  description = "DNS authorization for ${each.key}."
  domain      = each.key
  type        = var.dns_authorization_type
}

resource "google_dns_record_set" "certificate_dns_authorization" {
  for_each = local.public_dns_enabled ? google_certificate_manager_dns_authorization.public : {}

  managed_zone = google_dns_managed_zone.public[0].name
  name         = each.value.dns_resource_record[0].name
  type         = each.value.dns_resource_record[0].type
  ttl          = var.public_dns_record_ttl
  rrdatas      = [each.value.dns_resource_record[0].data]
}

resource "google_certificate_manager_certificate" "public" {
  count = local.public_dns_enabled ? 1 : 0

  name        = local.public_certificate_name
  description = "Google-managed certificate for ${var.environment} public edge."

  managed {
    domains            = sort(keys(local.public_hostnames_fqdn))
    dns_authorizations = [for authorization in google_certificate_manager_dns_authorization.public : authorization.id]
  }
}

resource "google_certificate_manager_certificate_map" "public" {
  count = local.public_dns_enabled ? 1 : 0

  name        = local.public_certificate_map_name
  description = "Certificate map for ${var.environment} public edge."
}

resource "google_certificate_manager_certificate_map_entry" "public" {
  for_each = local.public_dns_enabled ? local.public_hostnames_fqdn : {}

  name        = "${substr(local.base_name, 0, 28)}-entry-${substr(md5(each.key), 0, 8)}"
  description = "Certificate map entry for ${each.key}."
  map         = google_certificate_manager_certificate_map.public[0].name
  hostname    = each.key
  certificates = [
    google_certificate_manager_certificate.public[0].id,
  ]
}
