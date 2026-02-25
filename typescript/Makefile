.PHONY: install format lint test validate

install:
	npm install

format:
	npm run format

lint:
	npm run lint
	npm run format:check

test:
	npm run test

validate: format lint test
