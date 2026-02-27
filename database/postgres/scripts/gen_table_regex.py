#!/usr/bin/env python3
"""Generate PostgreSQL artifacts (regex + tbls docs) via tbls."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import ParseResult, urlparse, urlunparse

EXCLUDED_TABLES = {"_sqlx_migrations"}


@dataclass(frozen=True)
class TblsOutput:
    payload: dict[str, object]
    mode: str


@dataclass(frozen=True)
class SourceConfig:
    mode: str
    dsn: str
    source_label: str
    table_names: list[str]
    temp_db_name: str | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate DB artifacts by inspecting schema with tbls."
    )
    parser.add_argument(
        "--dsn",
        default="postgres://postgres:password@localhost:5432/linklynx?sslmode=disable",
        help="DSN used when local tbls command is available (default: %(default)s)",
    )
    parser.add_argument(
        "--docker-dsn",
        default="postgres://postgres:password@postgres:5432/linklynx?sslmode=disable",
        help="DSN used by dockerized tbls fallback (default: %(default)s)",
    )
    parser.add_argument(
        "--docker-image",
        default="ghcr.io/k1low/tbls:latest",
        help="Docker image for tbls fallback (default: %(default)s)",
    )
    parser.add_argument(
        "--output",
        default="database/postgres/generated/table_names.regex",
        help="Output path for generated regex file (default: %(default)s)",
    )
    parser.add_argument(
        "--doc-path",
        default=None,
        help="Output directory for tbls docs/ER (optional)",
    )
    parser.add_argument(
        "--er-format",
        default="svg",
        help="tbls ER format (png, jpg, svg, mermaid) (default: %(default)s)",
    )
    parser.add_argument(
        "--schema",
        default="database/postgres/schema.sql",
        help="Schema snapshot path used for empty-db bootstrap (default: %(default)s)",
    )
    return parser.parse_args()


def run_cmd(
    cmd: list[str],
    error_message: str,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=False,
        input=input_text,
    )
    if result.returncode != 0:
        stderr = result.stderr.strip()
        stdout = result.stdout.strip()
        detail = stderr or stdout or "no output"
        print(f"[ERROR] {error_message}: {detail}", file=sys.stderr)
        raise SystemExit(1)
    return result


def detect_compose_network() -> str:
    result = run_cmd(
        ["docker", "compose", "ps", "postgres", "--format", "{{.Networks}}"],
        "failed to resolve docker compose network for postgres",
    )
    networks = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if not networks:
        print(
            "[ERROR] docker compose network not found. start DB with `make db-up` first",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return networks[-1].split(",")[0].strip()


def run_tbls_out_json_with_local(
    dsn: str,
) -> TblsOutput | None:
    local_tbls = shutil.which("tbls")
    if local_tbls is None:
        return None
    result = run_cmd(
        [local_tbls, "out", "--format", "json", "--dsn", dsn],
        "tbls out failed",
    )
    return TblsOutput(payload=json.loads(result.stdout), mode="local")


def run_tbls_out_json_with_docker(
    docker_dsn: str,
    docker_image: str,
) -> TblsOutput:
    if shutil.which("docker") is None:
        print(
            "[ERROR] tbls command is not installed and docker is unavailable",
            file=sys.stderr,
        )
        raise SystemExit(1)

    network = detect_compose_network()
    cmd = [
        "docker",
        "run",
        "--rm",
        "--network",
        network,
        docker_image,
        "out",
        "--format",
        "json",
        "--dsn",
        docker_dsn,
    ]
    result = run_cmd(cmd, "dockerized tbls out failed")
    return TblsOutput(payload=json.loads(result.stdout), mode="docker")


def run_tbls_out_json(
    dsn: str,
    docker_dsn: str,
    docker_image: str,
) -> TblsOutput:
    local_result = run_tbls_out_json_with_local(dsn)
    if local_result is not None:
        return local_result
    return run_tbls_out_json_with_docker(
        docker_dsn=docker_dsn,
        docker_image=docker_image,
    )


def extract_table_names(tbls_json: dict[str, object]) -> list[str]:
    raw_tables = tbls_json.get("tables")
    if raw_tables is None:
        return []
    if not isinstance(raw_tables, list):
        print("[ERROR] tbls output has unexpected 'tables' shape", file=sys.stderr)
        raise SystemExit(1)

    names: set[str] = set()
    for table in raw_tables:
        if not isinstance(table, dict):
            continue
        name = table.get("name")
        if isinstance(name, str) and name:
            if "." in name:
                _, unqualified_name = name.split(".", 1)
                if unqualified_name not in EXCLUDED_TABLES:
                    names.add(unqualified_name)
            else:
                if name not in EXCLUDED_TABLES:
                    names.add(name)
    return sorted(names)


def build_regex(names: list[str]) -> tuple[str, str]:
    alternatives = "|".join(re.escape(name) for name in names)
    table_names_regex = rf"^(?:{alternatives})$"
    qualified_table_names_regex = rf"^(?:public\.)?(?:{alternatives})$"
    return table_names_regex, qualified_table_names_regex


def replace_database_name_in_dsn(dsn: str, database_name: str) -> str:
    parsed = urlparse(dsn)
    if not parsed.scheme or not parsed.netloc:
        print(f"[ERROR] invalid dsn format: {dsn}", file=sys.stderr)
        raise SystemExit(1)

    updated = ParseResult(
        scheme=parsed.scheme,
        netloc=parsed.netloc,
        path=f"/{database_name}",
        params=parsed.params,
        query=parsed.query,
        fragment=parsed.fragment,
    )
    return urlunparse(updated)


def load_schema_to_temp_db(
    schema_path: Path,
) -> str:
    if not schema_path.exists():
        print(f"[ERROR] schema file not found: {schema_path}", file=sys.stderr)
        raise SystemExit(1)

    schema_sql = schema_path.read_text(encoding="utf-8")
    if not schema_sql.strip():
        print(f"[ERROR] schema file is empty: {schema_path}", file=sys.stderr)
        raise SystemExit(1)

    temp_db_name = f"tbls_gen_{int(time.time())}_{os.getpid()}"
    create_sql = f'CREATE DATABASE "{temp_db_name}";'
    run_cmd(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "postgres",
            "psql",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-c",
            create_sql,
        ],
        "failed to create temporary database for tbls bootstrap",
    )

    run_cmd(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "postgres",
            "psql",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "postgres",
            "-d",
            temp_db_name,
        ],
        "failed to load schema.sql into temporary database",
        input_text=schema_sql,
    )
    return temp_db_name


def drop_temp_db(temp_db_name: str) -> None:
    drop_sql = f'DROP DATABASE IF EXISTS "{temp_db_name}";'
    run_cmd(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "postgres",
            "psql",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-c",
            drop_sql,
        ],
        "failed to drop temporary database used for tbls bootstrap",
    )


def bootstrap_tables_from_schema(
    schema_path: Path,
    docker_dsn: str,
    docker_image: str,
) -> SourceConfig:
    temp_db_name = load_schema_to_temp_db(schema_path)
    temp_docker_dsn = replace_database_name_in_dsn(docker_dsn, temp_db_name)
    temp_tbls = run_tbls_out_json_with_docker(
        docker_dsn=temp_docker_dsn,
        docker_image=docker_image,
    )
    return SourceConfig(
        mode="docker",
        dsn=temp_docker_dsn,
        source_label=f"tbls (docker bootstrap from {schema_path})",
        table_names=extract_table_names(temp_tbls.payload),
        temp_db_name=temp_db_name,
    )


def resolve_source(
    schema_path: Path,
    dsn: str,
    docker_dsn: str,
    docker_image: str,
) -> SourceConfig:
    tbls_output = run_tbls_out_json(
        dsn=dsn,
        docker_dsn=docker_dsn,
        docker_image=docker_image,
    )
    table_names = extract_table_names(tbls_output.payload)
    if table_names:
        effective_dsn = dsn if tbls_output.mode == "local" else docker_dsn
        return SourceConfig(
            mode=tbls_output.mode,
            dsn=effective_dsn,
            source_label=f"tbls ({tbls_output.mode})",
            table_names=table_names,
        )

    if shutil.which("docker") is None:
        print(
            "[ERROR] no tables found in current DB and docker is unavailable for bootstrap",
            file=sys.stderr,
        )
        raise SystemExit(1)

    return bootstrap_tables_from_schema(
        schema_path=schema_path,
        docker_dsn=docker_dsn,
        docker_image=docker_image,
    )


def generate_tbls_doc(
    source: SourceConfig,
    docker_image: str,
    doc_path: Path,
    er_format: str,
) -> None:
    doc_path_abs = doc_path.resolve()
    doc_path_abs.mkdir(parents=True, exist_ok=True)
    if source.mode == "local":
        local_tbls = shutil.which("tbls")
        if local_tbls is None:
            print("[ERROR] local tbls command not found", file=sys.stderr)
            raise SystemExit(1)
        run_cmd(
            [
                local_tbls,
                "doc",
                source.dsn,
                str(doc_path_abs),
                "--force",
                "--er-format",
                er_format,
                "--exclude",
                ",".join(sorted(EXCLUDED_TABLES)),
            ],
            "tbls doc failed",
        )
        return

    network = detect_compose_network()
    workspace_root = Path.cwd().resolve()
    run_cmd(
        [
            "docker",
            "run",
            "--rm",
            "--network",
            network,
            "-v",
            f"{workspace_root}:{workspace_root}",
            "-w",
            str(workspace_root),
            docker_image,
            "doc",
            source.dsn,
            str(doc_path_abs),
            "--force",
            "--er-format",
            er_format,
            "--exclude",
            ",".join(sorted(EXCLUDED_TABLES)),
        ],
        "dockerized tbls doc failed",
    )


def main() -> int:
    args = parse_args()
    output_path = Path(args.output)
    schema_path = Path(args.schema)
    doc_path = Path(args.doc_path) if args.doc_path else None

    source: SourceConfig | None = None
    try:
        source = resolve_source(
            schema_path=schema_path,
            dsn=args.dsn,
            docker_dsn=args.docker_dsn,
            docker_image=args.docker_image,
        )
        if not source.table_names:
            print(
                "[ERROR] no tables found from tbls source",
                file=sys.stderr,
            )
            return 1

        table_names_regex, qualified_table_names_regex = build_regex(source.table_names)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_lines = [
            "# Generated by database/postgres/scripts/gen_table_regex.py",
            f"# Source: {source.source_label}",
            f"TABLE_NAMES_REGEX='{table_names_regex}'",
            f"QUALIFIED_TABLE_NAMES_REGEX='{qualified_table_names_regex}'",
            f"TABLE_NAMES='{' '.join(source.table_names)}'",
            "",
        ]
        output_path.write_text("\n".join(output_lines), encoding="utf-8")
        print(
            f"[OK] generated {output_path} ({len(source.table_names)} tables) using {source.source_label}"
        )

        if doc_path is not None:
            generate_tbls_doc(
                source=source,
                docker_image=args.docker_image,
                doc_path=doc_path,
                er_format=args.er_format,
            )
            print(
                f"[OK] generated tbls docs at {doc_path.resolve()} using {source.source_label}"
            )

        return 0
    finally:
        if source is not None and source.temp_db_name is not None:
            drop_temp_db(source.temp_db_name)


if __name__ == "__main__":
    raise SystemExit(main())
