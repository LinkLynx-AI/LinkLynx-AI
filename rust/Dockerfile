FROM rust:1.83-alpine AS builder

RUN apk add --no-cache musl-dev

WORKDIR /app

COPY . .
RUN cargo build --release -p linklynx_backend

FROM alpine:3.19

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /app/target/release/linklynx_backend /app/linklynx_backend
COPY --from=builder /app/database/scylla /app/database/scylla

EXPOSE 8080

CMD ["./linklynx_backend"]
