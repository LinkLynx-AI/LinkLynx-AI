output "network_name" {
  value = google_compute_network.this.name
}

output "network_self_link" {
  value = google_compute_network.this.self_link
}

output "gke_nodes_subnet_name" {
  value = google_compute_subnetwork.gke_nodes.name
}

output "gke_nodes_subnet_self_link" {
  value = google_compute_subnetwork.gke_nodes.self_link
}

output "gke_pods_secondary_range_name" {
  value = var.gke_pods_secondary_range_name
}

output "gke_services_secondary_range_name" {
  value = var.gke_services_secondary_range_name
}

output "db_private_subnet_name" {
  value = google_compute_subnetwork.db_private.name
}

output "db_private_subnet_self_link" {
  value = google_compute_subnetwork.db_private.self_link
}

output "proxy_only_subnet_name" {
  value = google_compute_subnetwork.proxy_only.name
}

output "proxy_only_subnet_self_link" {
  value = google_compute_subnetwork.proxy_only.self_link
}

output "psc_subnet_name" {
  value = google_compute_subnetwork.psc.name
}

output "psc_subnet_self_link" {
  value = google_compute_subnetwork.psc.self_link
}

output "private_service_access_range_name" {
  value = google_compute_global_address.private_service_access.name
}

output "private_service_access_connection" {
  value = google_service_networking_connection.private_service_access.peering
}

output "public_lb_ipv4_address" {
  value = google_compute_global_address.public_lb_ipv4.address
}

output "public_lb_ipv4_name" {
  value = google_compute_global_address.public_lb_ipv4.name
}
output "public_dns_zone_name" {
  value = local.public_dns_enabled ? google_dns_managed_zone.public[0].name : null
}

output "public_dns_name" {
  value = local.normalized_public_dns_name != "" ? local.normalized_public_dns_name : null
}

output "public_certificate_map_name" {
  value = local.public_dns_enabled ? google_certificate_manager_certificate_map.public[0].name : null
}

output "public_certificate_id" {
  value = local.public_dns_enabled ? google_certificate_manager_certificate.public[0].id : null
}

output "dns_authorization_records" {
  value = local.public_dns_enabled ? {
    for hostname, authorization in google_certificate_manager_dns_authorization.public : hostname => {
      name = authorization.dns_resource_record[0].name
      type = authorization.dns_resource_record[0].type
      data = authorization.dns_resource_record[0].data
    }
  } : {}
}

output "cloud_armor_policy_name" {
  value = google_compute_security_policy.edge.name
}

output "edge_responsibility" {
  value = {
    api_gateway_main_path = false
    cdn                   = "Cloud CDN (attach later for static-only use cases)"
    dns                   = "Cloud DNS"
    lb                    = "External Application Load Balancer"
    tls                   = "Certificate Manager"
    waf                   = "Cloud Armor"
  }
}
