defmodule Linklynx.Router do
  use Plug.Router

  plug :match
  plug :dispatch

  get "/" do
    send_resp(conn, 200, Jason.encode!(%{message: "LinkLynx Elixir Service"}))
  end

  get "/health" do
    send_resp(conn, 200, Jason.encode!(%{status: "healthy"}))
  end

  match _ do
    send_resp(conn, 404, "Not Found")
  end
end
