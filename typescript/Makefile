.PHONY: setup install format lint test validate coverage coverage-check fsd-check

setup:
	@if [ -f pnpm-lock.yaml ]; then \
		CI=true pnpm install --frozen-lockfile; \
	else \
		CI=true pnpm install; \
	fi

install: setup

fsd-check:
	pnpm run fsd:check

format:
	pnpm run format

lint:
	pnpm run fsd:check
	pnpm run lint
	pnpm run format:check

test:
	pnpm run test

coverage:
	pnpm run test:coverage

coverage-check:
	pnpm run test:coverage:check

validate: format lint test
