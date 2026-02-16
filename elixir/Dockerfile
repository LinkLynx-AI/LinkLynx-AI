FROM elixir:1.16-alpine AS builder

RUN apk add --no-cache build-base

WORKDIR /app

RUN mix local.hex --force && mix local.rebar --force

COPY mix.exs ./
RUN mix deps.get --only prod
RUN MIX_ENV=prod mix deps.compile

COPY config config
COPY lib lib

RUN MIX_ENV=prod mix compile
RUN MIX_ENV=prod mix release

FROM alpine:3.19

RUN apk add --no-cache libstdc++ openssl ncurses-libs

WORKDIR /app

COPY --from=builder /app/_build/prod/rel/linklynx ./

ENV PHX_HOST=localhost
ENV PORT=4000

EXPOSE 4000

CMD ["bin/linklynx", "start"]
