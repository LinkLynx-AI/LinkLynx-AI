.PHONY: setup install install-dev ensure-dev-tools format lint test validate

VENV_DIR ?= .venv
PYTHON_BIN ?= $(shell \
	for cmd in python3.13 python3.12 python3.11 python3.10 python3; do \
		if command -v $$cmd >/dev/null 2>&1; then \
			major=$$($$cmd -c 'import sys; print(sys.version_info.major)' 2>/dev/null || true); \
			minor=$$($$cmd -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || true); \
			if [ "$$major" = "3" ] && [ "$$minor" -ge 10 ] && [ "$$minor" -le 13 ]; then \
				echo $$cmd; \
				exit 0; \
			fi; \
		fi; \
	done)
PYTHON ?= $(shell if [ -x $(VENV_DIR)/bin/python ]; then echo $(VENV_DIR)/bin/python; else echo $(PYTHON_BIN); fi)

setup:
	@if [ -z "$(PYTHON_BIN)" ]; then \
		echo "Python 3.10 から 3.13 のいずれかが必要です。python3.10+ をインストールしてください。"; \
		exit 1; \
	fi
	$(PYTHON_BIN) -m venv $(VENV_DIR)
	$(VENV_DIR)/bin/python -m pip install --upgrade pip
	$(VENV_DIR)/bin/python -m pip install -r requirements.txt -r requirements-dev.txt

install:
	@if [ -z "$(PYTHON)" ]; then \
		echo "Python 3.10 から 3.13 のいずれかが必要です。python3.10+ をインストールしてください。"; \
		exit 1; \
	fi
	$(PYTHON) -m pip install -r requirements.txt

install-dev:
	@if [ -z "$(PYTHON)" ]; then \
		echo "Python 3.10 から 3.13 のいずれかが必要です。python3.10+ をインストールしてください。"; \
		exit 1; \
	fi
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
