.PHONY: setup install format lint test validate

setup:
	@if [ -f pnpm-lock.yaml ]; then \
		CI=true pnpm install --frozen-lockfile; \
	else \
		CI=true pnpm install; \
	fi

install: setup

format:
	pnpm run format

lint:
	pnpm run lint
	pnpm run format:check

test:
	pnpm run test

validate: format lint test
