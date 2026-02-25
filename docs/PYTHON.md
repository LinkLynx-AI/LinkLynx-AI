# Python Coding Rules

## 1. Core Principles
- Follow PEP 8 and prioritize readability.
- Type hints are required. Public functions must declare argument and return types.
- Manage dependencies in `requirements.txt` and `requirements-dev.txt`.

## 2. Format / Lint / Test
- Format: `black`
- Lint: `ruff`
- Test: `unittest`

Run commands in the `python/` directory:

```bash
make format
make lint
make test
make validate
```

## 3. Naming Conventions
- Modules, functions, variables: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

## 4. FastAPI Rules
- Keep routing layers focused on request/response mapping and validation. Do not place heavy business logic directly in route handlers.
- Keep the health check endpoint as `GET /health`.
- Keep API response JSON structures stable.

## 5. Exception Handling
- Do not swallow exceptions.
- Handle expected failures explicitly and keep error messages clear enough to identify the cause.
- Avoid broad catches of generic `Exception` unless there is a clear boundary-level reason.

## 6. Function Documentation Rule
- Function comments must use JSDoc-style tags (`@param`, `@returns`, `@throws` when applicable).
- The function summary line in the doc comment must be written in Japanese.

Example:

```python
"""
ユーザーIDでユーザー情報を取得する。
@param user_id 取得対象のユーザーID
@returns ユーザー情報。存在しない場合は None
@throws ValueError 引数が不正な場合
"""
def find_user(user_id: str) -> dict | None:
    ...
```
