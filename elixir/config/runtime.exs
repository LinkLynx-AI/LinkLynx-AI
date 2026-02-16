import Config

config :linklynx,
  port: String.to_integer(System.get_env("PORT") || "4000")
