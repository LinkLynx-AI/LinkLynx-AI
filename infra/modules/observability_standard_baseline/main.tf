locals {
  common_labels = merge(
    {
      environment = var.environment
      managed_by  = "terraform"
      scope       = "observability-standard"
    },
    var.labels,
  )

  grafana_dashboard_labels = merge(
    local.common_labels,
    {
      grafana_dashboard = "1"
    },
  )

  monitored_app_namespace_regex = join("|", sort(tolist(var.monitored_app_namespaces)))
  alertmanager_secret_name      = "alertmanager-discord-webhook"
  loki_gateway_url              = "http://${var.loki_release_name}-gateway.${var.namespace}.svc.cluster.local"
  loki_push_url                 = "${local.loki_gateway_url}/loki/api/v1/push"

  blackbox_api_targets = [
    for target in sort(tolist(var.api_http_probe_targets)) : {
      name   = "api-${substr(md5(target), 0, 8)}"
      url    = target
      module = "http_2xx"
      labels = {
        dependency  = "api"
        environment = var.environment
        target_type = "api"
      }
    }
  ]

  blackbox_cloud_sql_targets = [
    for target in sort(tolist(var.cloud_sql_tcp_targets)) : {
      name   = "cloudsql-${substr(md5(target), 0, 8)}"
      url    = target
      module = "tcp_connect"
      labels = {
        dependency  = "cloudsql"
        environment = var.environment
        target_type = "cloudsql"
      }
    }
  ]

  blackbox_dragonfly_targets = [
    for target in sort(tolist(var.dragonfly_tcp_targets)) : {
      name   = "dragonfly-${substr(md5(target), 0, 8)}"
      url    = target
      module = "tcp_connect"
      labels = {
        dependency  = "dragonfly"
        environment = var.environment
        target_type = "dragonfly"
      }
    }
  ]

  blackbox_scylla_targets = [
    for target in sort(tolist(var.scylla_tcp_targets)) : {
      name   = "scylla-${substr(md5(target), 0, 8)}"
      url    = target
      module = "tcp_connect"
      labels = {
        dependency  = "scylla"
        environment = var.environment
        target_type = "scylla"
      }
    }
  ]

  blackbox_redpanda_targets = [
    for target in sort(tolist(var.redpanda_tcp_targets)) : {
      name   = "redpanda-${substr(md5(target), 0, 8)}"
      url    = target
      module = "tcp_connect"
      labels = {
        dependency  = "redpanda"
        environment = var.environment
        target_type = "redpanda"
      }
    }
  ]

  blackbox_nats_targets = [
    for target in sort(tolist(var.nats_tcp_targets)) : {
      name   = "nats-${substr(md5(target), 0, 8)}"
      url    = target
      module = "tcp_connect"
      labels = {
        dependency  = "nats"
        environment = var.environment
        target_type = "nats"
      }
    }
  ]

  blackbox_search_targets = [
    for target in sort(tolist(var.search_http_probe_targets)) : {
      name   = "search-${substr(md5(target), 0, 8)}"
      url    = target
      module = "http_2xx"
      labels = {
        dependency  = "search"
        environment = var.environment
        target_type = "search"
      }
    }
  ]

  blackbox_targets = concat(
    local.blackbox_api_targets,
    local.blackbox_cloud_sql_targets,
    local.blackbox_dragonfly_targets,
    local.blackbox_scylla_targets,
    local.blackbox_redpanda_targets,
    local.blackbox_nats_targets,
    local.blackbox_search_targets,
  )

  alertmanager_content = trimspace(var.discord_mention) != "" ? var.discord_mention : "LinkLynx alert"

  alertmanager_config = {
    global = {
      resolve_timeout = "5m"
    }
    route = {
      group_by        = ["alertname", "dependency", "namespace"]
      group_wait      = "30s"
      group_interval  = "5m"
      repeat_interval = "4h"
      receiver        = "discord-default"
      routes = [
        {
          receiver = "null"
          matchers = ["alertname = \"Watchdog\""]
        },
      ]
    }
    receivers = [
      {
        name = "discord-default"
        discord_configs = [
          {
            send_resolved    = true
            webhook_url_file = "/etc/alertmanager/secrets/${local.alertmanager_secret_name}/webhook-url"
            title            = "{{ template \"discord.default.title\" . }}"
            message          = "{{ template \"discord.default.message\" . }}"
            content          = local.alertmanager_content
            username         = "linklynx-alertmanager"
          },
        ]
      },
      {
        name = "null"
      },
    ]
    templates = ["/etc/alertmanager/config/*.tmpl"]
  }

  additional_prometheus_rules = {
    groups = [
      {
        name = "linklynx-runtime-slo"
        rules = [
          {
            alert = "LinkLynxApiErrorRateHigh"
            expr  = "sum(rate(api_error_total[5m])) / clamp_min(sum(rate(api_request_total[5m])), 1) > 0.05 and sum(rate(api_request_total[5m])) > 0"
            for   = "5m"
            labels = {
              severity   = "warning"
              category   = "slo"
              dependency = "api"
            }
            annotations = {
              summary = "API error rate is above 5%"
              runbook = "docs/runbooks/observability-standard-operations-runbook.md"
            }
          },
          {
            alert = "LinkLynxApiLatencyP95High"
            expr  = "histogram_quantile(0.95, sum(rate(api_request_latency_ms_bucket[5m])) by (le)) > 500"
            for   = "15m"
            labels = {
              severity   = "warning"
              category   = "slo"
              dependency = "api"
            }
            annotations = {
              summary = "API P95 latency is above 500ms"
              runbook = "docs/runbooks/observability-standard-operations-runbook.md"
            }
          },
          {
            alert = "LinkLynxWsDisconnectSurge"
            expr  = "increase(ws_disconnect_total[10m]) > 50"
            for   = "10m"
            labels = {
              severity   = "warning"
              category   = "slo"
              dependency = "ws"
            }
            annotations = {
              summary = "WebSocket disconnects surged above the initial baseline"
              runbook = "docs/runbooks/observability-standard-operations-runbook.md"
            }
          },
          {
            alert = "LinkLynxDependencyProbeDown"
            expr  = "min_over_time(probe_success{dependency!=\"\"}[5m]) < 1"
            for   = "5m"
            labels = {
              severity = "critical"
              category = "dependency"
            }
            annotations = {
              summary = "A dependency reachability probe has been failing for 5 minutes"
              runbook = "docs/runbooks/observability-standard-operations-runbook.md"
            }
          },
        ]
      },
    ]
  }

  slo_dashboard_json = jsonencode({
    annotations = {
      list = []
    }
    editable      = true
    graphTooltip  = 1
    schemaVersion = 39
    style         = "dark"
    tags          = ["linklynx", var.environment, "slo"]
    templating    = { list = [] }
    time          = { from = "now-6h", to = "now" }
    timepicker    = {}
    timezone      = "browser"
    title         = "LinkLynx ${upper(var.environment)} standard SLO baseline"
    uid           = "linklynx-${var.environment}-slo"
    version       = 1
    panels = [
      {
        datasource = {
          type = "prometheus"
          uid  = "prometheus"
        }
        fieldConfig = {
          defaults = {
            color = {
              mode = "palette-classic"
            }
            unit = "reqps"
          }
          overrides = []
        }
        gridPos = {
          h = 8
          w = 6
          x = 0
          y = 0
        }
        id = 1
        options = {
          legend = {
            displayMode = "list"
            placement   = "bottom"
          }
          tooltip = {
            mode = "single"
          }
        }
        targets = [
          {
            expr  = "sum(rate(api_request_total[5m]))"
            refId = "A"
          },
        ]
        title = "API request rate"
        type  = "timeseries"
      },
      {
        datasource = {
          type = "prometheus"
          uid  = "prometheus"
        }
        fieldConfig = {
          defaults = {
            color = {
              mode = "palette-classic"
            }
            unit = "percentunit"
          }
          overrides = []
        }
        gridPos = {
          h = 8
          w = 6
          x = 6
          y = 0
        }
        id = 2
        options = {
          legend = {
            displayMode = "list"
            placement   = "bottom"
          }
          tooltip = {
            mode = "single"
          }
        }
        targets = [
          {
            expr  = "sum(rate(api_error_total[5m])) / clamp_min(sum(rate(api_request_total[5m])), 1)"
            refId = "A"
          },
        ]
        title = "API error rate"
        type  = "timeseries"
      },
      {
        datasource = {
          type = "prometheus"
          uid  = "prometheus"
        }
        fieldConfig = {
          defaults = {
            color = {
              mode = "palette-classic"
            }
            unit = "ms"
          }
          overrides = []
        }
        gridPos = {
          h = 8
          w = 6
          x = 0
          y = 8
        }
        id = 3
        options = {
          legend = {
            displayMode = "list"
            placement   = "bottom"
          }
          tooltip = {
            mode = "single"
          }
        }
        targets = [
          {
            expr  = "histogram_quantile(0.95, sum(rate(api_request_latency_ms_bucket[5m])) by (le))"
            refId = "A"
          },
          {
            expr  = "histogram_quantile(0.99, sum(rate(api_request_latency_ms_bucket[5m])) by (le))"
            refId = "B"
          },
        ]
        title = "API latency P95 / P99"
        type  = "timeseries"
      },
      {
        datasource = {
          type = "prometheus"
          uid  = "prometheus"
        }
        fieldConfig = {
          defaults = {
            color = {
              mode = "palette-classic"
            }
            unit = "short"
          }
          overrides = []
        }
        gridPos = {
          h = 8
          w = 6
          x = 6
          y = 8
        }
        id = 4
        options = {
          legend = {
            displayMode = "list"
            placement   = "bottom"
          }
          tooltip = {
            mode = "single"
          }
        }
        targets = [
          {
            expr  = "sum(ws_connections_active)"
            refId = "A"
          },
        ]
        title = "WS active connections"
        type  = "timeseries"
      },
      {
        datasource = {
          type = "prometheus"
          uid  = "prometheus"
        }
        fieldConfig = {
          defaults = {
            color = {
              mode = "palette-classic"
            }
            unit = "short"
          }
          overrides = []
        }
        gridPos = {
          h = 8
          w = 6
          x = 0
          y = 16
        }
        id = 5
        options = {
          legend = {
            displayMode = "list"
            placement   = "bottom"
          }
          tooltip = {
            mode = "single"
          }
        }
        targets = [
          {
            expr  = "sum(increase(ws_disconnect_total[5m]))"
            refId = "A"
          },
        ]
        title = "WS disconnects / 5m"
        type  = "timeseries"
      },
      {
        datasource = {
          type = "prometheus"
          uid  = "prometheus"
        }
        fieldConfig = {
          defaults = {
            color = {
              mode = "thresholds"
            }
            max = 1
            min = 0
            thresholds = {
              mode  = "absolute"
              steps = [{ color = "red", value = 0 }, { color = "green", value = 1 }]
            }
          }
          overrides = []
        }
        gridPos = {
          h = 8
          w = 6
          x = 6
          y = 16
        }
        id = 6
        options = {
          colorMode   = "background"
          graphMode   = "none"
          justifyMode = "auto"
          orientation = "auto"
          reduceOptions = {
            calcs  = ["lastNotNull"]
            fields = ""
            values = false
          }
          textMode = "value_and_name"
        }
        targets = [
          {
            expr         = "probe_success{dependency!=\"\"}"
            instant      = true
            legendFormat = "{{dependency}}"
            refId        = "A"
          },
        ]
        title = "Dependency probe success"
        type  = "stat"
      },
      {
        gridPos = {
          h = 7
          w = 12
          x = 0
          y = 24
        }
        id = 7
        options = {
          content = join("\n", [
            "Standard observability baseline",
            "",
            "- Metrics: Prometheus",
            "- Logs: Loki via Grafana Alloy",
            "- Alerts: Alertmanager -> Discord",
            "- Dependency probes: API / Cloud SQL / Dragonfly / Scylla / Redpanda / NATS",
            "- Runbook: `docs/runbooks/observability-standard-operations-runbook.md`",
            "- Contract metrics: `docs/runbooks/observability-v0-structured-logs-metrics-runbook.md`",
          ])
          mode = "markdown"
        }
        title = "Baseline notes"
        type  = "text"
      },
    ]
  })

  dependency_dashboard_json = jsonencode({
    annotations = {
      list = []
    }
    editable      = true
    graphTooltip  = 1
    schemaVersion = 39
    style         = "dark"
    tags          = ["linklynx", var.environment, "dependency"]
    templating    = { list = [] }
    time          = { from = "now-6h", to = "now" }
    timepicker    = {}
    timezone      = "browser"
    title         = "LinkLynx ${upper(var.environment)} dependency probes"
    uid           = "linklynx-${var.environment}-deps"
    version       = 1
    panels = [
      {
        datasource = {
          type = "prometheus"
          uid  = "prometheus"
        }
        fieldConfig = {
          defaults = {
            color = {
              mode = "palette-classic"
            }
            max = 1
            min = 0
          }
          overrides = []
        }
        gridPos = {
          h = 10
          w = 12
          x = 0
          y = 0
        }
        id = 1
        options = {
          legend = {
            displayMode = "table"
            placement   = "bottom"
          }
          tooltip = {
            mode = "single"
          }
        }
        targets = [
          {
            expr         = "probe_success{dependency!=\"\"}"
            legendFormat = "{{dependency}} {{instance}}"
            refId        = "A"
          },
        ]
        title = "Probe success"
        type  = "timeseries"
      },
      {
        datasource = {
          type = "prometheus"
          uid  = "prometheus"
        }
        fieldConfig = {
          defaults = {
            color = {
              mode = "palette-classic"
            }
            unit = "s"
          }
          overrides = []
        }
        gridPos = {
          h = 10
          w = 12
          x = 0
          y = 10
        }
        id = 2
        options = {
          legend = {
            displayMode = "table"
            placement   = "bottom"
          }
          tooltip = {
            mode = "single"
          }
        }
        targets = [
          {
            expr         = "avg_over_time(probe_duration_seconds{dependency!=\"\"}[5m])"
            legendFormat = "{{dependency}} {{instance}}"
            refId        = "A"
          },
        ]
        title = "Probe duration (5m avg)"
        type  = "timeseries"
      },
    ]
  })
}

resource "kubernetes_secret_v1" "alertmanager_discord_webhook" {
  metadata {
    name      = local.alertmanager_secret_name
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    "webhook-url" = var.discord_webhook_url
  }

  type = "Opaque"
}

resource "helm_release" "loki" {
  name             = var.loki_release_name
  namespace        = var.namespace
  repository       = "https://grafana-community.github.io/helm-charts"
  chart            = "loki"
  version          = trimspace(var.loki_chart_version) != "" ? trimspace(var.loki_chart_version) : null
  create_namespace = false
  wait             = true
  atomic           = true
  cleanup_on_fail  = true
  timeout          = 900
  max_history      = 3
  values = [yamlencode({
    deploymentMode = "SingleBinary"
    commonLabels   = local.common_labels
    loki = {
      auth_enabled = false
      commonConfig = {
        replication_factor = 1
      }
      storage = {
        type = "filesystem"
      }
      schemaConfig = {
        configs = [
          {
            from         = "2024-04-01"
            store        = "tsdb"
            object_store = "filesystem"
            schema       = "v13"
            index = {
              prefix = "loki_index_"
              period = "24h"
            }
          },
        ]
      }
      limits_config = {
        retention_period = var.loki_retention_period
      }
      compactor = {
        retention_enabled    = true
        delete_request_store = "filesystem"
      }
    }
    singleBinary = {
      replicas = 1
      persistence = {
        enabled = true
        size    = var.loki_storage_size
      }
      resources = {
        requests = {
          cpu    = "250m"
          memory = "512Mi"
        }
        limits = {
          cpu    = "1"
          memory = "2Gi"
        }
      }
    }
    read         = { replicas = 0 }
    write        = { replicas = 0 }
    backend      = { replicas = 0 }
    chunksCache  = { enabled = false }
    resultsCache = { enabled = false }
    minio        = { enabled = false }
    monitoring = {
      dashboards = {
        enabled = true
        labels = {
          grafana_dashboard = "1"
        }
      }
      rules = {
        enabled = true
      }
      serviceMonitor = {
        enabled = true
        labels = {
          release = var.kube_prometheus_stack_release_name
        }
      }
    }
  })]
}

resource "helm_release" "kube_prometheus_stack" {
  name             = var.kube_prometheus_stack_release_name
  namespace        = var.namespace
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  version          = trimspace(var.kube_prometheus_stack_chart_version) != "" ? trimspace(var.kube_prometheus_stack_chart_version) : null
  create_namespace = false
  wait             = true
  atomic           = true
  cleanup_on_fail  = true
  timeout          = 900
  max_history      = 3
  values = [yamlencode({
    commonLabels = local.common_labels
    defaultRules = {
      appNamespacesTarget = local.monitored_app_namespace_regex
    }
    grafana = {
      enabled = true
      persistence = {
        enabled = true
        size    = var.grafana_storage_size
      }
      additionalDataSources = [
        {
          name     = "Loki"
          type     = "loki"
          uid      = "loki"
          url      = local.loki_gateway_url
          access   = "proxy"
          editable = false
          jsonData = {}
        },
      ]
      sidecar = {
        dashboards = {
          enabled         = true
          searchNamespace = "ALL"
        }
        datasources = {
          enabled                  = true
          defaultDatasourceEnabled = true
          isDefaultDatasource      = true
          uid                      = "prometheus"
        }
      }
      service = {
        type = "ClusterIP"
      }
    }
    alertmanager = {
      enabled = true
      config  = local.alertmanager_config
      alertmanagerSpec = {
        replicas = 1
        secrets  = [local.alertmanager_secret_name]
        storage = {
          volumeClaimTemplate = {
            spec = {
              accessModes = ["ReadWriteOnce"]
              resources = {
                requests = {
                  storage = var.alertmanager_storage_size
                }
              }
            }
          }
        }
      }
    }
    prometheus = {
      prometheusSpec = {
        retention = var.prometheus_retention
        storageSpec = {
          volumeClaimTemplate = {
            spec = {
              accessModes = ["ReadWriteOnce"]
              resources = {
                requests = {
                  storage = var.prometheus_storage_size
                }
              }
            }
          }
        }
      }
    }
    additionalPrometheusRulesMap = {
      "linklynx-runtime-slo" = local.additional_prometheus_rules
    }
  })]

  depends_on = [kubernetes_secret_v1.alertmanager_discord_webhook, helm_release.loki]
}

resource "helm_release" "blackbox_exporter" {
  name             = var.blackbox_release_name
  namespace        = var.namespace
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "prometheus-blackbox-exporter"
  version          = trimspace(var.blackbox_chart_version) != "" ? trimspace(var.blackbox_chart_version) : null
  create_namespace = false
  wait             = true
  atomic           = true
  cleanup_on_fail  = true
  timeout          = 600
  max_history      = 3
  values = [yamlencode({
    releaseLabel = true
    commonLabels = local.common_labels
    config = {
      modules = {
        http_2xx = {
          prober  = "http"
          timeout = "5s"
          http = {
            preferred_ip_protocol = "ip4"
            valid_http_versions   = ["HTTP/1.1", "HTTP/2.0"]
          }
        }
        tcp_connect = {
          prober  = "tcp"
          timeout = "5s"
        }
      }
    }
    serviceMonitor = {
      enabled = length(local.blackbox_targets) > 0
      selfMonitor = {
        enabled = true
        labels = {
          release = var.kube_prometheus_stack_release_name
        }
      }
      defaults = {
        interval      = "30s"
        scrapeTimeout = "10s"
        labels = {
          release = var.kube_prometheus_stack_release_name
        }
      }
      targets = local.blackbox_targets
    }
  })]

  depends_on = [helm_release.kube_prometheus_stack]
}

resource "helm_release" "alloy" {
  name             = var.alloy_release_name
  namespace        = var.namespace
  repository       = "https://grafana.github.io/helm-charts"
  chart            = "alloy"
  version          = trimspace(var.alloy_chart_version) != "" ? trimspace(var.alloy_chart_version) : null
  create_namespace = false
  wait             = true
  atomic           = true
  cleanup_on_fail  = true
  timeout          = 600
  max_history      = 3
  values = [yamlencode({
    crds = {
      create = false
    }
    alloy = {
      configMap = {
        content = <<-EOT
          logging {
            level  = "info"
            format = "logfmt"
          }

          discovery.kubernetes "pod" {
            role = "pod"

            selectors {
              role  = "pod"
              field = "spec.nodeName=" + coalesce(sys.env("HOSTNAME"), constants.hostname)
            }
          }

          discovery.relabel "pod_logs" {
            targets = discovery.kubernetes.pod.targets

            rule {
              source_labels = ["__meta_kubernetes_namespace"]
              action        = "replace"
              target_label  = "namespace"
            }

            rule {
              source_labels = ["__meta_kubernetes_pod_name"]
              action        = "replace"
              target_label  = "pod"
            }

            rule {
              source_labels = ["__meta_kubernetes_pod_container_name"]
              action        = "replace"
              target_label  = "container"
            }

            rule {
              source_labels = ["__meta_kubernetes_pod_label_app_kubernetes_io_name"]
              action        = "replace"
              target_label  = "app"
            }

            rule {
              source_labels = ["__meta_kubernetes_namespace", "__meta_kubernetes_pod_container_name"]
              action        = "replace"
              target_label  = "job"
              separator     = "/"
              replacement   = "$1"
            }

            rule {
              source_labels = ["__meta_kubernetes_pod_uid", "__meta_kubernetes_pod_container_name"]
              action        = "replace"
              target_label  = "__path__"
              separator     = "/"
              replacement   = "/var/log/pods/*$1/*.log"
            }

            rule {
              source_labels = ["__meta_kubernetes_pod_container_id"]
              action        = "replace"
              target_label  = "container_runtime"
              regex         = `^(\S+):\/\/.+$`
              replacement   = "$1"
            }
          }

          loki.source.kubernetes "pod_logs" {
            targets    = discovery.relabel.pod_logs.output
            forward_to = [loki.process.pod_logs.receiver]
          }

          loki.process "pod_logs" {
            stage.static_labels {
              values = {
                cluster     = "${var.environment}"
                environment = "${var.environment}"
              }
            }

            forward_to = [loki.write.default.receiver]
          }

          loki.write "default" {
            endpoint {
              url = "${local.loki_push_url}"
            }
          }
        EOT
      }
      enableReporting = false
      resources = {
        requests = {
          cpu    = "100m"
          memory = "256Mi"
        }
        limits = {
          cpu    = "500m"
          memory = "512Mi"
        }
      }
    }
    controller = {
      type = "daemonset"
    }
    serviceMonitor = {
      enabled = true
      additionalLabels = {
        release = var.kube_prometheus_stack_release_name
      }
    }
  })]

  depends_on = [helm_release.loki]
}

resource "kubernetes_config_map_v1" "slo_dashboard" {
  metadata {
    name      = "linklynx-standard-slo-dashboard"
    namespace = var.namespace
    labels    = local.grafana_dashboard_labels
  }

  data = {
    "linklynx-standard-slo-dashboard.json" = local.slo_dashboard_json
  }

  depends_on = [helm_release.kube_prometheus_stack]
}

resource "kubernetes_config_map_v1" "dependency_dashboard" {
  metadata {
    name      = "linklynx-dependency-probes-dashboard"
    namespace = var.namespace
    labels    = local.grafana_dashboard_labels
  }

  data = {
    "linklynx-dependency-probes-dashboard.json" = local.dependency_dashboard_json
  }

  depends_on = [helm_release.kube_prometheus_stack]
}
