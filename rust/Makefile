.PHONY: setup format lint test validate

setup:
	cargo fetch --locked

format:
	cargo fmt --all

lint:
	cargo fmt --all -- --check
	cargo clippy --workspace --all-targets --all-features -- -D warnings

test:
	cargo test --workspace

validate: format lint test
