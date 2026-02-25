.PHONY: install install-dev ensure-dev-tools format lint test validate

PYTHON ?= $(shell if [ -x .venv/bin/python ]; then echo .venv/bin/python; else echo python3; fi)

install:
	$(PYTHON) -m pip install -r requirements.txt

install-dev:
	$(PYTHON) -m pip install -r requirements.txt -r requirements-dev.txt

ensure-dev-tools:
	@$(PYTHON) -m black --version >/dev/null 2>&1 || $(PYTHON) -m pip install -r requirements-dev.txt
	@$(PYTHON) -m ruff --version >/dev/null 2>&1 || $(PYTHON) -m pip install -r requirements-dev.txt

format: ensure-dev-tools
	$(PYTHON) -m black .
	$(PYTHON) -m ruff check . --fix

lint: ensure-dev-tools
	$(PYTHON) -m black . --check
	$(PYTHON) -m ruff check .

test:
	$(PYTHON) -m unittest discover -s tests -p "test_*.py"

validate: format lint test
