defmodule Linklynx.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    port = Application.get_env(:linklynx, :port, 4000)

    children = [
      {Plug.Cowboy, scheme: :http, plug: Linklynx.Router, options: [port: port]}
    ]

    opts = [strategy: :one_for_one, name: Linklynx.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
