.PHONY: setup format lint test validate coverage coverage-check

COVERAGE_MIN_LINES ?= 80

setup:
	cargo fetch --locked

format:
	cargo fmt --all

lint:
	cargo fmt --all -- --check
	cargo clippy --workspace --all-targets --all-features -- -D warnings

test:
	cargo test --workspace

coverage:
	@command -v cargo-llvm-cov >/dev/null 2>&1 || (echo "cargo-llvm-cov is required. Install it with: cargo install cargo-llvm-cov --locked" && exit 1)
	cargo llvm-cov --workspace --all-features --summary-only

coverage-check:
	@command -v cargo-llvm-cov >/dev/null 2>&1 || (echo "cargo-llvm-cov is required. Install it with: cargo install cargo-llvm-cov --locked" && exit 1)
	cargo llvm-cov --workspace --all-features --summary-only --fail-under-lines $(COVERAGE_MIN_LINES)

validate: format lint test
