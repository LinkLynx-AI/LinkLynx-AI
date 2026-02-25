.PHONY: setup install install-dev ensure-dev-tools format lint test validate

VENV_DIR ?= .venv
PYTHON_BIN ?= python3
PYTHON ?= $(shell if [ -x $(VENV_DIR)/bin/python ]; then echo $(VENV_DIR)/bin/python; else echo $(PYTHON_BIN); fi)

setup:
	$(PYTHON_BIN) -m venv $(VENV_DIR)
	$(VENV_DIR)/bin/python -m pip install --upgrade pip
	$(VENV_DIR)/bin/python -m pip install -r requirements.txt -r requirements-dev.txt

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
