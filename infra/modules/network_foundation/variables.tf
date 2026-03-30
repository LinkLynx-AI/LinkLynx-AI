variable "environment" {
  description = "Environment name used in resource naming."
  type        = string
}

variable "region" {
  description = "Primary region for regional resources."
  type        = string
}

variable "labels" {
  description = "Additional labels applied to supported resources."
  type        = map(string)
  default     = {}
}

variable "network_name" {
  description = "Optional VPC name override."
  type        = string
  default     = ""
}

variable "routing_mode" {
  description = "VPC routing mode."
  type        = string
  default     = "REGIONAL"

  validation {
    condition     = contains(["REGIONAL", "GLOBAL"], var.routing_mode)
    error_message = "routing_mode must be REGIONAL or GLOBAL."
  }
}

variable "gke_nodes_subnet_cidr" {
  description = "Primary subnet range for GKE nodes."
  type        = string
  default     = "10.0.0.0/20"
}

variable "gke_pods_secondary_range_name" {
  description = "Secondary range name for GKE pods."
  type        = string
  default     = "gke-pods"
}

variable "gke_pods_secondary_range_cidr" {
  description = "Secondary range CIDR for GKE pods."
  type        = string
  default     = "10.16.0.0/14"
}

variable "gke_services_secondary_range_name" {
  description = "Secondary range name for GKE services."
  type        = string
  default     = "gke-services"
}

variable "gke_services_secondary_range_cidr" {
  description = "Secondary range CIDR for GKE services."
  type        = string
  default     = "10.32.0.0/20"
}

variable "db_private_subnet_cidr" {
  description = "Dedicated private subnet for future database-adjacent workloads."
  type        = string
  default     = "10.48.0.0/24"
}

variable "proxy_only_subnet_cidr" {
  description = "Proxy-only subnet CIDR for Envoy-based load balancers in this region."
  type        = string
  default     = "10.48.2.0/23"
}

variable "psc_subnet_cidr" {
  description = "Private Service Connect subnet CIDR."
  type        = string
  default     = "10.48.4.0/24"
}

variable "private_service_access_cidr" {
  description = "Allocated range reserved for private services access peering."
  type        = string
  default     = "10.60.0.0/16"
}

variable "public_dns_zone_name" {
  description = "Cloud DNS managed zone name. Leave empty to skip public DNS resources."
  type        = string
  default     = ""
}

variable "public_dns_name" {
  description = "Cloud DNS public zone suffix, for example staging.example.com."
  type        = string
  default     = ""
}

variable "public_hostnames" {
  description = "Public hostnames that resolve to the shared edge IP and are covered by the managed certificate."
  type        = set(string)
  default     = []
}

variable "public_dns_record_ttl" {
  description = "TTL for public A and certificate validation records."
  type        = number
  default     = 300

  validation {
    condition     = var.public_dns_record_ttl > 0
    error_message = "public_dns_record_ttl must be greater than zero."
  }
}

variable "dns_authorization_type" {
  description = "Certificate Manager DNS authorization type."
  type        = string
  default     = "PER_PROJECT_RECORD"

  validation {
    condition     = contains(["FIXED_RECORD", "PER_PROJECT_RECORD"], var.dns_authorization_type)
    error_message = "dns_authorization_type must be FIXED_RECORD or PER_PROJECT_RECORD."
  }
}
