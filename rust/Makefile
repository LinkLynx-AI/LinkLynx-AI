.PHONY: format lint test validate

format:
	cargo fmt --all

lint:
	cargo fmt --all -- --check
	cargo clippy --workspace --all-targets --all-features -- -D warnings

test:
	cargo test --workspace

validate: format lint test
