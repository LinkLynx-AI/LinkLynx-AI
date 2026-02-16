import Config

config :linklynx,
  port: 4000

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]
