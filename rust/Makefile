.PHONY: setup format lint test validate coverage coverage-check

COVERAGE_MIN_LINES ?= 45
CARGO_BIN_PATH ?= $(HOME)/.cargo/bin
LLVM_COV_PATH := $(CARGO_BIN_PATH):$(PATH)
BREW_LLVM_COV ?= /opt/homebrew/opt/llvm/bin/llvm-cov
BREW_LLVM_PROFDATA ?= /opt/homebrew/opt/llvm/bin/llvm-profdata

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
	@PATH="$(LLVM_COV_PATH)" command -v cargo-llvm-cov >/dev/null 2>&1 || (echo "cargo-llvm-cov is required. Install it with: cargo install cargo-llvm-cov --locked" && exit 1)
	@if [ -x "$(BREW_LLVM_COV)" ] && [ -x "$(BREW_LLVM_PROFDATA)" ]; then \
		PATH="$(LLVM_COV_PATH)" LLVM_COV="$(BREW_LLVM_COV)" LLVM_PROFDATA="$(BREW_LLVM_PROFDATA)" cargo llvm-cov --workspace --all-features --summary-only; \
	else \
		PATH="$(LLVM_COV_PATH)" cargo llvm-cov --workspace --all-features --summary-only; \
	fi

coverage-check:
	@PATH="$(LLVM_COV_PATH)" command -v cargo-llvm-cov >/dev/null 2>&1 || (echo "cargo-llvm-cov is required. Install it with: cargo install cargo-llvm-cov --locked" && exit 1)
	@if [ -x "$(BREW_LLVM_COV)" ] && [ -x "$(BREW_LLVM_PROFDATA)" ]; then \
		PATH="$(LLVM_COV_PATH)" LLVM_COV="$(BREW_LLVM_COV)" LLVM_PROFDATA="$(BREW_LLVM_PROFDATA)" cargo llvm-cov --workspace --all-features --summary-only --fail-under-lines $(COVERAGE_MIN_LINES); \
	else \
		PATH="$(LLVM_COV_PATH)" cargo llvm-cov --workspace --all-features --summary-only --fail-under-lines $(COVERAGE_MIN_LINES); \
	fi

validate: format lint test coverage-check
