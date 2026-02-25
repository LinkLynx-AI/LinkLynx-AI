.PHONY: setup install format lint test validate

setup:
	@if [ -f package-lock.json ]; then \
		npm ci; \
	else \
		npm install; \
	fi

install: setup

format:
	npm run format

lint:
	npm run lint
	npm run format:check

test:
	npm run test

validate: format lint test
