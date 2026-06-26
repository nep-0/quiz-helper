#!/usr/bin/env python3
"""Validate Quiz Question Bank JSON files against the bundled schema."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_SCHEMA = SCRIPT_DIR.parent / "references" / "quiz-bank.schema.json"


def load_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path}: invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc
    except OSError as exc:
        raise ValueError(f"{path}: cannot read file: {exc}") from exc


def format_path(path: str) -> str:
    if path == "$":
        return "$"
    return path


def validate_with_jsonschema(document: Any, schema: dict[str, Any]) -> list[str]:
    try:
        import jsonschema
    except ImportError:
        return [
            "jsonschema package is not installed; skipped JSON Schema validation "
            "and ran semantic checks only"
        ]

    validator_cls = jsonschema.validators.validator_for(schema)
    validator_cls.check_schema(schema)
    validator = validator_cls(schema)

    errors: list[str] = []
    for error in sorted(validator.iter_errors(document), key=lambda item: list(item.absolute_path)):
        location = "$"
        for part in error.absolute_path:
            location += f"[{part!r}]" if isinstance(part, int) else f".{part}"
        errors.append(f"{format_path(location)}: {error.message}")
    return errors


def validate_bank(document: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(document, dict):
        return ["$: expected a question bank object"]

    questions = document.get("questions")
    if not isinstance(questions, list):
        return errors

    question_ids: set[str] = set()
    section_ids: set[str] = set()

    sections = document.get("sections", [])
    if isinstance(sections, list):
        for index, section in enumerate(sections):
            if not isinstance(section, dict):
                continue
            section_id = section.get("id")
            if isinstance(section_id, str):
                if section_id in section_ids:
                    errors.append(f"$.sections[{index}].id: duplicate section id {section_id!r}")
                section_ids.add(section_id)

    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            continue

        question_id = question.get("id")
        if isinstance(question_id, str):
            if question_id in question_ids:
                errors.append(f"$.questions[{index}].id: duplicate question id {question_id!r}")
            question_ids.add(question_id)

        option_ids: set[str] = set()
        options = question.get("options")
        if isinstance(options, list):
            for option_index, option in enumerate(options):
                if not isinstance(option, dict):
                    continue
                option_id = option.get("id")
                if isinstance(option_id, str):
                    if option_id in option_ids:
                        errors.append(
                            f"$.questions[{index}].options[{option_index}].id: "
                            f"duplicate option id {option_id!r}"
                        )
                    option_ids.add(option_id)

        answer = question.get("answer")
        correct_ids = answer.get("correctOptionIds") if isinstance(answer, dict) else None
        if isinstance(correct_ids, list):
            for answer_index, correct_id in enumerate(correct_ids):
                if isinstance(correct_id, str) and correct_id not in option_ids:
                    errors.append(
                        f"$.questions[{index}].answer.correctOptionIds[{answer_index}]: "
                        f"{correct_id!r} is not present in this question's options"
                    )

            question_type = question.get("type")
            if question_type in {"single_choice", "true_false"} and len(correct_ids) != 1:
                errors.append(
                    f"$.questions[{index}].answer.correctOptionIds: "
                    f"{question_type} questions must have exactly one correct option"
                )

        section_id = question.get("sectionId")
        if isinstance(section_id, str) and section_ids and section_id not in section_ids:
            errors.append(f"$.questions[{index}].sectionId: unknown section id {section_id!r}")

    if isinstance(sections, list):
        for section_index, section in enumerate(sections):
            if not isinstance(section, dict):
                continue
            question_ids_in_section = section.get("questionIds")
            if not isinstance(question_ids_in_section, list):
                continue
            for question_ref_index, question_id in enumerate(question_ids_in_section):
                if isinstance(question_id, str) and question_id not in question_ids:
                    errors.append(
                        f"$.sections[{section_index}].questionIds[{question_ref_index}]: "
                        f"unknown question id {question_id!r}"
                    )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate one or more Quiz Question Bank JSON files."
    )
    parser.add_argument("files", nargs="+", type=Path, help="Question bank JSON files to validate")
    parser.add_argument(
        "--schema",
        type=Path,
        default=DEFAULT_SCHEMA,
        help=f"Schema path, defaults to {DEFAULT_SCHEMA}",
    )
    args = parser.parse_args()

    try:
        schema = load_json(args.schema)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 2

    had_error = False
    had_warning = False
    for file_path in args.files:
        try:
            document = load_json(file_path)
        except ValueError as exc:
            print(exc, file=sys.stderr)
            had_error = True
            continue

        schema_messages = validate_with_jsonschema(document, schema)
        semantic_errors = validate_bank(document)
        warnings = [message for message in schema_messages if message.startswith("jsonschema package")]
        errors = [message for message in schema_messages if message not in warnings] + semantic_errors

        if warnings:
            had_warning = True
            for warning in warnings:
                print(f"{file_path}: warning: {warning}", file=sys.stderr)

        if errors:
            had_error = True
            print(f"{file_path}: invalid", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
        else:
            print(f"{file_path}: valid")

    if had_error:
        return 1
    return 0 if not had_warning else 0


if __name__ == "__main__":
    raise SystemExit(main())
