#!/usr/bin/env python3
"""
DM-TaRL / Arithia item template extraction.

This script maps procedurally generated runtime log items to reusable
pedagogical item templates. It deliberately avoids using exact generated
numbers as conceptual item IDs. Exact runtime fields are preserved in audit
columns, while analytics should group by item_template_id and config_context_id.

Run:
  python dm_tarl_extract_item_templates.py --assessments cleaned_assessments_data_v3.json --test-definitions dm-tarl-default-rtdb-test_definitions-export.json --taxonomy DM_TARL_TEMPLATE_TAXONOMY.json --outdir outputs_templates
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd


AXES = [
    "arithmetic_fluency",
    "number_sense",
    "sequential_thinking",
    "comparison_skill",
    "visual_matching",
    "audio_recognition",
]

GAME_ALIASES = {"multi_step_problems": "multi_step_problem"}

OP_TEXT = {
    "+": "Addition",
    "add": "Addition",
    "addition": "Addition",
    "-": "Subtraction",
    "sub": "Subtraction",
    "subtraction": "Subtraction",
    "x": "Multiplication",
    "*": "Multiplication",
    "×": "Multiplication",
    "mul": "Multiplication",
    "multiplication": "Multiplication",
    "times": "Multiplication",
    "/": "Division",
    "÷": "Division",
    "div": "Division",
    "division": "Division",
    "divide": "Division",
}

OUTPUT_COLUMNS = [
    "student_id",
    "test_id",
    "game_type",
    "attempt_idx",
    "log_idx",
    "axis",
    "axis_weight",
    "fine_skill",
    "item_template_id",
    "template_label",
    "config_context_id",
    "operation",
    "operations_expected",
    "operations_used",
    "skill_subtype",
    "question_type",
    "format",
    "num_digits",
    "complexity_level",
    "boundary_type",
    "difficulty_zone",
    "sequence_length",
    "comparison_type",
    "order_direction",
    "decomposition_parts",
    "has_zero_place",
    "place_value_pattern",
    "num_options",
    "num_steps",
    "num_pairs",
    "display_time",
    "max_number_range",
    "min_num_compositions",
    "correct",
    "time_spent_ms",
    "answer_time_category",
    "is_slow",
    "mistake_type",
    "started_at",
    "finished_at",
    "session_finished",
    "definition_order",
    "config_found",
    "config_source",
    "sparse_template",
    "template_attempts",
    "template_students",
    "runtime_question",
    "runtime_selected",
    "runtime_answered",
    "runtime_correct_answer",
    "runtime_expected",
    "runtime_given",
    "runtime_options",
    "runtime_numbers",
    "runtime_left",
    "runtime_right",
    "runtime_number",
    "config_json",
]


def as_list(value: Any) -> List[Any]:
    return [v for v in value if v is not None] if isinstance(value, list) else []


def as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def safe_json(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def clean_part(value: Any, default: str = "unknown") -> str:
    if value is None or value == "":
        return default
    if isinstance(value, float) and math.isnan(value):
        return default
    text = str(value)
    text = text.replace(" ", "-").replace("|", "-").replace("/", "-")
    return re.sub(r"[^A-Za-z0-9_.:-]+", "-", text).strip("-") or default


def canonical_game_type(game_type: str) -> str:
    return GAME_ALIASES.get(game_type, game_type)


def extract_numbers(text: Any) -> List[int]:
    return [int(x) for x in re.findall(r"-?\d+", str(text or ""))]


def normalize_operation(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in OP_TEXT:
        return OP_TEXT[text]
    for token, operation in OP_TEXT.items():
        if token and token in text:
            return operation
    return None


def extract_operations(text: Any) -> List[str]:
    low = str(text or "").lower()
    found: List[str] = []
    for token, operation in OP_TEXT.items():
        if token and token in low and operation not in found:
            found.append(operation)
    return found


def join_ops(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, list):
        ops = [str(v) for v in value if v is not None]
    else:
        ops = [str(value)]
    return "-".join(clean_part(v) for v in ops) if ops else None


def num_digits_from_values(values: Iterable[Any]) -> Optional[int]:
    nums: List[int] = []
    for value in values:
        if value is None or isinstance(value, bool):
            continue
        if isinstance(value, int):
            nums.append(abs(value))
        elif isinstance(value, float) and not math.isnan(value):
            nums.append(abs(int(value)))
        elif isinstance(value, str) and value.strip().lstrip("-").isdigit():
            nums.append(abs(int(value.strip())))
        elif isinstance(value, list):
            nested = num_digits_from_values(value)
            if nested is not None:
                nums.append(10 ** max(nested - 1, 0))
        elif isinstance(value, dict):
            nested = num_digits_from_values(value.values())
            if nested is not None:
                nums.append(10 ** max(nested - 1, 0))
    if not nums:
        return None
    return max(len(str(n)) for n in nums)


def complexity_from_digits(num_digits: Optional[int]) -> Optional[str]:
    if num_digits is None:
        return None
    if num_digits <= 1:
        return "very-easy"
    if num_digits == 2:
        return "easy"
    if num_digits == 3:
        return "medium"
    return "hard"


def difficulty_zone(number: Any) -> Optional[str]:
    if not isinstance(number, int):
        return None
    start = (number // 10) * 10
    return f"{start}-{start + 9}"


def boundary_type(number: Any, expected: Any = None, given: Any = None) -> Optional[str]:
    if not isinstance(number, int):
        return None
    if number <= 10:
        return "low_number_edge"
    if number % 100 in {0, 1, 98, 99}:
        return "hundreds_transition"
    exp = as_list(expected)
    got = as_list(given)
    crosses_tens = False
    values = [v for v in exp + got if isinstance(v, int)]
    if len(values) >= 2:
        crosses_tens = len({v // 10 for v in values}) > 1
    if number % 10 in {0, 9} or crosses_tens:
        return "tens_transition"
    return "normal_range"


def place_value_pattern(number: Any) -> Optional[str]:
    if not isinstance(number, int):
        return None
    digits = list(str(abs(number)))
    unique = set(digits)
    if len(unique) == 1:
        return "all_digits_same"
    if len(unique) < len(digits):
        return "has_repeated_digits"
    return "all_digits_distinct"


def decomposition_parts(expected: Any, given: Any = None) -> Optional[int]:
    if isinstance(expected, list):
        return len(expected)
    if isinstance(given, list):
        return len(given)
    return None


def has_zero_place(expected: Any, number: Any = None) -> Optional[bool]:
    if isinstance(expected, list):
        return any(v == 0 for v in expected if isinstance(v, int))
    if isinstance(number, int):
        return "0" in str(abs(number))
    return None


def comparison_type(left: Any, right: Any) -> Optional[str]:
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        if left > right:
            return "Greater"
        if left < right:
            return "Less"
        return "Equal"
    return None


def parse_vertical(log: Dict[str, Any]) -> Tuple[Optional[int], Optional[str], Optional[int]]:
    question = str(log.get("question") or "")
    nums = extract_numbers(question)
    op = normalize_operation(log.get("operation") or log.get("operationUsed") or question)
    return (nums[0] if len(nums) > 0 else None, op, nums[1] if len(nums) > 1 else None)


def vertical_subtype(operation: Optional[str], a: Optional[int], b: Optional[int]) -> Optional[str]:
    if operation is None:
        return None
    if a is None or b is None:
        return {
            "Addition": "SimpleAddition",
            "Subtraction": "SimpleSubtraction",
            "Multiplication": "SingleStepMultiplication",
            "Division": "SingleStepDivision",
        }.get(operation)
    a_digits = [int(x) for x in str(abs(a))]
    b_digits = [int(x) for x in str(abs(b)).zfill(len(a_digits))]
    if operation == "Addition":
        return "AdditionWithCarry" if any(x + y >= 10 for x, y in zip(a_digits, b_digits)) else "SimpleAddition"
    if operation == "Subtraction":
        return "SubtractionWithBorrow" if any(x < y for x, y in zip(a_digits, b_digits)) else "SimpleSubtraction"
    if operation == "Multiplication":
        return "MultiStepMultiplication" if abs(a) > 9 or abs(b) > 9 else "SingleStepMultiplication"
    if operation == "Division":
        if b == 0:
            return "DivisionByZeroInvalid"
        if a % b != 0:
            return "DivisionWithRemainder"
        return "MultiStepDivision" if abs(a) > abs(b) * 10 else "SingleStepDivision"
    return None


def classify_mistake(game_type: str, log: Dict[str, Any], dims: Dict[str, Any]) -> Optional[str]:
    if bool(log.get("isCorrect")):
        return None
    if game_type in {"vertical_operations", "multi_step_problem"}:
        return "ComputationError"
    if game_type == "choose_answer":
        expected = set(str(dims.get("operations_expected") or "").split("-")) - {""}
        used = set(str(dims.get("operations_used") or "").split("-")) - {""}
        return "MisidentifiedOperation" if expected and expected != used else "ComputationError"
    if game_type == "compare_numbers":
        correct = str(log.get("correctSign") or "")
        selected = str(log.get("selectedSign") or "")
        if (correct, selected) in {(">", "<"), ("<", ">")}:
            return "ReversedSign"
        if correct == "=":
            return "FailedEquality"
        return "WrongSign"
    if game_type == "order_numbers":
        correct = as_list(log.get("correctOrder"))
        selected = as_list(log.get("selectedOrder"))
        if not selected or len(selected) < len(correct):
            return "IncompleteAnswer"
        if selected == list(reversed(correct)):
            return "ReversedDescending" if log.get("direction") == "asc" else "ReversedAscending"
        wrong = sum(a != b for a, b in zip(correct, selected))
        return "OneMisplacedNumber" if wrong == 1 else "MultipleMisplacements"
    if game_type == "find_previous_next_number":
        bt = dims.get("boundary_type")
        return "TensTransitionMistake" if bt in {"tens_transition", "hundreds_transition"} else "RangeUncertainty"
    if game_type == "identify_place_value":
        return "PlaceValueMisidentification"
    if game_type == "decompose_number":
        exp = as_list(log.get("expected"))
        got = as_list(log.get("given"))
        if not got:
            return "IncompleteAnswer"
        if exp and len(exp) != len(got):
            return "WrongNumberOfParts"
        return "IncorrectValues"
    if game_type == "what_number_do_you_hear":
        return "AudioNumberRecognitionError"
    if game_type == "write_number_in_letters":
        return "UnknownWritingMistake"
    if game_type == "read_number_aloud":
        return "SpeechNumberReadingError"
    if game_type == "tap_matching_pairs":
        return "MatchingPairError"
    return "UnknownMistake"


def load_test_definition_index(test_definitions: Dict[str, Any]) -> Dict[str, Dict[str, Dict[str, Any]]]:
    index: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for test_id, definition in (test_definitions or {}).items():
        definition = as_dict(definition)
        games = {}
        for entry in as_list(definition.get("miniGames")):
            entry = as_dict(entry)
            game_type = canonical_game_type(str(entry.get("gameType") or ""))
            if not game_type:
                continue
            games[game_type] = {
                "config": as_dict(entry.get("config")),
                "order": entry.get("order"),
                "language": definition.get("language"),
                "source": "test_definition",
            }
        index[test_id] = games
    return index


def load_default_config_index(mini_games_path: Path = Path("src/config/mini-games.json")) -> Dict[str, Dict[str, Any]]:
    if not mini_games_path.exists():
        return {}
    with mini_games_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    defaults = {}
    for game_type, entry in as_dict(data.get("miniGames")).items():
        grade_config = as_dict(as_dict(as_dict(entry).get("defaultConfig")).get("gradeConfig"))
        defaults[canonical_game_type(game_type)] = {
            "config": as_dict(grade_config.get("default")),
            "order": None,
            "language": None,
            "source": "default_config",
        }
    return defaults


def get_config(
    test_id: str,
    game_type: str,
    test_definition_index: Dict[str, Dict[str, Dict[str, Any]]],
    default_config_index: Dict[str, Dict[str, Any]],
) -> Tuple[Dict[str, Any], Optional[int], Optional[str], bool, str]:
    joined = as_dict(test_definition_index.get(test_id)).get(game_type)
    if joined:
        return as_dict(joined.get("config")), joined.get("order"), joined.get("language"), True, str(joined.get("source"))
    fallback = default_config_index.get(game_type)
    if fallback:
        return as_dict(fallback.get("config")), fallback.get("order"), fallback.get("language"), False, str(fallback.get("source"))
    return {}, None, None, False, "missing"


def config_context_id(game_type: str, config: Dict[str, Any]) -> str:
    max_range = config.get("maxNumberRange")
    ops = join_ops(config.get("operationsAllowed"))
    if game_type == "vertical_operations":
        return (
            f"vertical_operations__cfg_range{clean_part(max_range)}__ops_{clean_part(ops)}"
            f"__carry{clean_part(config.get('allowCarry'))}__borrow{clean_part(config.get('allowBorrow'))}"
            f"__mulstep{clean_part(config.get('allowMultiStepMul'))}__divstep{clean_part(config.get('allowMultiStepDiv'))}"
        )
    if game_type == "choose_answer":
        return f"choose_answer__cfg_range{clean_part(max_range)}__ops_{clean_part(ops)}__options{clean_part(config.get('numOptions'))}"
    if game_type == "multi_step_problem":
        return f"multi_step_problem__cfg_range{clean_part(max_range)}__steps{clean_part(config.get('numSteps'))}__ops_{clean_part(ops)}"
    if game_type == "find_compositions":
        return f"find_compositions__cfg_range{clean_part(max_range)}__op{clean_part(config.get('operation'))}__min{clean_part(config.get('minNumCompositions'))}"
    if game_type == "order_numbers":
        return f"order_numbers__cfg_range{clean_part(max_range)}__maxseq{clean_part(config.get('maxNumbersInSequence'))}"
    if game_type == "tap_matching_pairs":
        return f"tap_matching_pairs__cfg_range{clean_part(max_range)}__pairs{clean_part(config.get('numPairs'))}"
    if game_type == "read_number_aloud":
        return f"read_number_aloud__cfg_range{clean_part(max_range)}__display{clean_part(config.get('displayTime'))}s"
    return f"{game_type}__cfg_range{clean_part(max_range)}"


def base_dimensions(game_type: str, log: Dict[str, Any], config: Dict[str, Any], language: Optional[str]) -> Dict[str, Any]:
    dims: Dict[str, Any] = {
        "operation": None,
        "operations_expected": None,
        "operations_used": None,
        "skill_subtype": None,
        "question_type": None,
        "format": None,
        "num_digits": None,
        "complexity_level": None,
        "boundary_type": None,
        "difficulty_zone": None,
        "sequence_length": None,
        "comparison_type": None,
        "order_direction": None,
        "decomposition_parts": None,
        "has_zero_place": None,
        "place_value_pattern": None,
        "num_options": None,
        "num_steps": config.get("numSteps"),
        "num_pairs": config.get("numPairs"),
        "display_time": config.get("displayTime"),
        "max_number_range": config.get("maxNumberRange"),
        "min_num_compositions": config.get("minNumCompositions"),
        "language": language,
    }

    if game_type == "vertical_operations":
        a, op, b = parse_vertical(log)
        digits = num_digits_from_values([a, b, log.get("correctAnswer"), log.get("answered")])
        dims.update(
            operation=op,
            skill_subtype=vertical_subtype(op, a, b),
            question_type="VerticalOperation",
            format="Vertical",
            num_digits=digits,
        )
    elif game_type == "choose_answer":
        options = as_list(log.get("options"))
        correct_option = next((str(o.get("text", "")) for o in options if isinstance(o, dict) and o.get("correct")), "")
        selected = str(log.get("selected") or "")
        expected_ops = extract_operations(correct_option or log.get("question"))
        used_ops = extract_operations(selected)
        dims.update(
            operation=join_ops(expected_ops),
            operations_expected=join_ops(expected_ops),
            operations_used=join_ops(used_ops),
            skill_subtype="MultiStepProblem" if len(expected_ops) > 1 else "OneStepProblem",
            question_type="MultiStepProblem" if len(expected_ops) > 1 else "OneStepProblem",
            format="Horizontal",
            num_digits=num_digits_from_values(extract_numbers(correct_option) + extract_numbers(log.get("question"))),
            num_options=len(options) or config.get("numOptions"),
        )
    elif game_type == "multi_step_problem":
        ops = extract_operations(log.get("question")) or extract_operations(log.get("operation")) or as_list(config.get("operationsAllowed"))
        dims.update(
            operation=join_ops(ops),
            operations_expected=join_ops(ops),
            skill_subtype="MultiStepProblem",
            question_type="WordProblem",
            format="Mixed",
            num_digits=num_digits_from_values(extract_numbers(log.get("question")) + extract_numbers(log.get("expected"))),
        )
    elif game_type == "find_compositions":
        target = log.get("target") or log.get("number")
        op = normalize_operation(log.get("operation") or config.get("operation"))
        dims.update(
            operation=op,
            skill_subtype="Composition",
            question_type="Composition",
            format="Horizontal",
            num_digits=num_digits_from_values([target, log.get("expected"), log.get("given")]),
        )
    elif game_type == "find_previous_next_number":
        q = log.get("question")
        dims.update(
            skill_subtype="PreviousAndNext",
            question_type="Sequence",
            format="Horizontal",
            num_digits=num_digits_from_values([q]),
            boundary_type=boundary_type(q, log.get("expected"), log.get("given")),
            difficulty_zone=difficulty_zone(q),
        )
    elif game_type == "order_numbers":
        nums = as_list(log.get("numbers"))
        dims.update(
            skill_subtype=f"Ordering_{log.get('direction')}" if log.get("direction") else "Ordering",
            question_type="Ordering",
            format="Visual",
            num_digits=num_digits_from_values(nums),
            sequence_length=len(nums) if nums else config.get("maxNumbersInSequence"),
            order_direction=log.get("direction"),
        )
    elif game_type == "compare_numbers":
        comp = comparison_type(log.get("left"), log.get("right"))
        dims.update(
            skill_subtype=comp,
            question_type="Comparison",
            format="Horizontal",
            num_digits=num_digits_from_values([log.get("left"), log.get("right")]),
            comparison_type=comp,
        )
    elif game_type == "tap_matching_pairs":
        dims.update(
            skill_subtype="MatchingPairs",
            question_type="VisualMatching",
            format="Visual",
            num_digits=num_digits_from_values([log.get("pair"), log.get("expected"), log.get("selected")]),
            num_pairs=config.get("numPairs"),
        )
    elif game_type == "what_number_do_you_hear":
        options = as_list(log.get("options"))
        dims.update(
            skill_subtype="HeardNumberChoice",
            question_type="AudioRecognition",
            format="Audio",
            num_digits=num_digits_from_values([log.get("question"), log.get("correctAnswer"), log.get("selected")]),
            num_options=len(options) or config.get("numOptions"),
        )
    elif game_type == "decompose_number":
        expected = log.get("expected")
        dims.update(
            skill_subtype="Decomposition",
            question_type="Decomposition",
            format="Visual",
            num_digits=num_digits_from_values([log.get("number")]),
            decomposition_parts=decomposition_parts(expected, log.get("given")),
            has_zero_place=has_zero_place(expected, log.get("number")),
        )
    elif game_type == "write_number_in_letters":
        dims.update(
            skill_subtype="WrittenNumberProduction",
            question_type="NumberWriting",
            format="Mixed",
            num_digits=num_digits_from_values([log.get("number")]),
        )
    elif game_type == "identify_place_value":
        number = log.get("number")
        dims.update(
            skill_subtype="PlaceValue",
            question_type="PlaceValue",
            format="Visual",
            num_digits=num_digits_from_values([number]),
            place_value_pattern=place_value_pattern(number),
        )
    elif game_type == "read_number_aloud":
        dims.update(
            skill_subtype="ReadNumberAloud",
            question_type="OralReading",
            format="Audio",
            num_digits=num_digits_from_values([log.get("number"), log.get("parsed"), log.get("question")]),
        )

    dims["complexity_level"] = complexity_from_digits(dims.get("num_digits"))
    return dims


def template_id(game_type: str, dims: Dict[str, Any]) -> str:
    d = lambda key: clean_part(dims.get(key))
    digits = f"{d('num_digits')}digits"
    if game_type == "vertical_operations":
        return f"vertical_operations__{d('skill_subtype')}__{digits}"
    if game_type == "choose_answer":
        return f"choose_answer__{d('operations_expected')}__{d('question_type')}__{digits}__{d('num_options')}options"
    if game_type == "multi_step_problem":
        return f"multi_step_problem__{d('operations_expected')}__{d('num_steps')}steps__{digits}"
    if game_type == "find_compositions":
        return f"find_compositions__{d('operation')}__{digits}__min{d('min_num_compositions')}parts"
    if game_type == "find_previous_next_number":
        return f"find_previous_next_number__{digits}__{d('boundary_type')}"
    if game_type == "order_numbers":
        return f"order_numbers__{d('order_direction')}__seq{d('sequence_length')}__{digits}"
    if game_type == "compare_numbers":
        return f"compare_numbers__{d('comparison_type')}__{digits}"
    if game_type == "tap_matching_pairs":
        return f"tap_matching_pairs__{digits}__{d('num_pairs')}pairs"
    if game_type == "what_number_do_you_hear":
        return f"what_number_do_you_hear__{digits}__{d('num_options')}options"
    if game_type == "decompose_number":
        return f"decompose_number__{digits}__{d('decomposition_parts')}parts__zero{d('has_zero_place')}"
    if game_type == "write_number_in_letters":
        return f"write_number_in_letters__{digits}__lang{d('language')}"
    if game_type == "identify_place_value":
        return f"identify_place_value__{digits}__{d('place_value_pattern')}"
    if game_type == "read_number_aloud":
        return f"read_number_aloud__{digits}__display{d('display_time')}s"
    return f"{game_type}__{d('fine_skill')}__{digits}"


def template_label(game_type: str, dims: Dict[str, Any]) -> str:
    parts = [game_type.replace("_", " ")]
    for key in ["skill_subtype", "operation", "question_type", "comparison_type", "order_direction", "boundary_type"]:
        if dims.get(key):
            parts.append(str(dims[key]))
    if dims.get("num_digits") is not None:
        parts.append(f"{dims['num_digits']} digits")
    if dims.get("sequence_length") is not None:
        parts.append(f"sequence {dims['sequence_length']}")
    return " | ".join(parts)


def iter_test_sessions(
    test_key: str, test: Dict[str, Any]
) -> Iterable[Tuple[str, str, Dict[str, Any]]]:
    """Yield (config_test_id, output_test_id, session) for one test entry.

    Supports both:
      - legacy schema: the test object itself IS the session
        (finished/miniGames/... live directly on it)
      - new schema: assessments/{uid}/{testId}/attempts/{attemptId}/, where
        each attempt carries its own finished/miniGames/... fields

    config_test_id is always the bare test definition id (never suffixed),
    used to join against test_definition_index for configs. output_test_id
    is what lands in the test_id output column - suffixed with
    "::attemptId" for new-schema sessions so each attempt stays traceable
    back to its parent test, mirroring the same convention already used in
    dm_tarl_reconstruction_pipeline.js.
    """
    attempts = test.get("attempts")
    if isinstance(attempts, dict) and attempts:
        for attempt_id, session in attempts.items():
            if not isinstance(session, dict):
                continue
            config_test_id = str(session.get("testId") or test.get("testId") or test_key)
            yield config_test_id, f"{config_test_id}::{attempt_id}", session
    else:
        config_test_id = str(test.get("testId") or test_key)
        yield config_test_id, config_test_id, test


def build_rows(
    assessments: Dict[str, Any],
    test_definition_index: Dict[str, Dict[str, Dict[str, Any]]],
    default_config_index: Dict[str, Dict[str, Any]],
    taxonomy: Dict[str, Any],
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    total_tests = 0
    finished_tests = 0
    config_misses = 0
    alias_count = Counter()
    observed_games = Counter()
    rules = as_dict(taxonomy.get("template_rules"))
    legacy_schema_tests = 0
    new_schema_tests = 0

    for student_id, tests in (assessments or {}).items():
        if not isinstance(tests, dict) or str(student_id).startswith("_"):
            continue
        for test_key, test in tests.items():
            if not isinstance(test, dict):
                continue

            if isinstance(test.get("attempts"), dict) and test.get("attempts"):
                new_schema_tests += 1
            else:
                legacy_schema_tests += 1

            for config_test_id, output_test_id, session in iter_test_sessions(test_key, test):
                total_tests += 1
                # Item-level logs are real evidence even when the overall
                # session never reached "finished" (technical dropout,
                # student disengagement, etc.) - keep the status as a
                # column instead of discarding the data outright. Callers
                # who want finished-only assessments can filter on
                # session_finished afterwards.
                session_finished = bool(
                    session.get("finished") is True or session.get("session_status") == "complete"
                )
                if session_finished:
                    finished_tests += 1
                test_id = output_test_id
                mini_games = as_dict(session.get("miniGames"))
                for raw_game_type, game_data in mini_games.items():
                    game_type = canonical_game_type(str(raw_game_type))
                    if raw_game_type != game_type:
                        alias_count[f"{raw_game_type}->{game_type}"] += 1
                    observed_games[game_type] += 1
                    rule = as_dict(rules.get(game_type))
                    axis_projection = as_dict(rule.get("axis_projection"))
                    fine_skill = rule.get("fine_skill") or game_type
                    config, order, language, config_found, config_source = get_config(
                        config_test_id, game_type, test_definition_index, default_config_index
                    )
                    if not config_found:
                        config_misses += 1

                    attempts = as_list(game_data.get("attempts")) if isinstance(game_data, dict) else as_list(game_data)
                    for attempt_idx, attempt in enumerate(attempts):
                        if not isinstance(attempt, dict):
                            continue
                        for log_idx, log in enumerate(as_list(attempt.get("logs"))):
                            if not isinstance(log, dict):
                                continue
                            dims = base_dimensions(game_type, log, config, language)
                            dims["fine_skill"] = fine_skill
                            item_template_id = template_id(game_type, dims)
                            mistake_type = classify_mistake(game_type, log, dims)
                            base = {
                                "student_id": student_id,
                                "test_id": test_id,
                                "game_type": game_type,
                                "attempt_idx": attempt_idx,
                                "log_idx": log_idx,
                                "_runtime_event_key": f"{student_id}|{test_id}|{game_type}|{attempt_idx}|{log_idx}",
                                "fine_skill": fine_skill,
                                "item_template_id": item_template_id,
                                "template_label": template_label(game_type, dims),
                                "config_context_id": config_context_id(game_type, config),
                                "correct": int(bool(log.get("isCorrect"))),
                                "time_spent_ms": log.get("timeSpentMs"),
                                "answer_time_category": log.get("answerTimeCategory"),
                                "is_slow": int(str(log.get("answerTimeCategory", "")).lower() == "slow"),
                                "mistake_type": mistake_type,
                                "started_at": attempt.get("startedAt") or session.get("startedAt") or test.get("createdAt"),
                                "finished_at": attempt.get("finishedAt") or session.get("finishedAt"),
                                "session_finished": session_finished,
                                "definition_order": order,
                                "config_found": int(config_found),
                                "config_source": config_source,
                                "sparse_template": None,
                                "template_attempts": None,
                                "template_students": None,
                                "runtime_question": safe_json(log.get("question")),
                                "runtime_selected": safe_json(log.get("selected")),
                                "runtime_answered": safe_json(log.get("answered")),
                                "runtime_correct_answer": safe_json(log.get("correctAnswer")),
                                "runtime_expected": safe_json(log.get("expected")),
                                "runtime_given": safe_json(log.get("given")),
                                "runtime_options": safe_json(log.get("options")),
                                "runtime_numbers": safe_json(log.get("numbers")),
                                "runtime_left": safe_json(log.get("left")),
                                "runtime_right": safe_json(log.get("right")),
                                "runtime_number": safe_json(log.get("number")),
                                "config_json": safe_json(config),
                            }
                            for key in [
                                "operation",
                                "operations_expected",
                                "operations_used",
                                "skill_subtype",
                                "question_type",
                                "format",
                                "num_digits",
                                "complexity_level",
                                "boundary_type",
                                "difficulty_zone",
                                "sequence_length",
                                "comparison_type",
                                "order_direction",
                                "decomposition_parts",
                                "has_zero_place",
                                "place_value_pattern",
                                "num_options",
                                "num_steps",
                                "num_pairs",
                                "display_time",
                                "max_number_range",
                                "min_num_compositions",
                            ]:
                                base[key] = dims.get(key)

                            if axis_projection:
                                for axis, weight in axis_projection.items():
                                    row = dict(base)
                                    row["axis"] = axis
                                    row["axis_weight"] = weight
                                    rows.append(row)
                            else:
                                row = dict(base)
                                row["axis"] = "unknown"
                                row["axis_weight"] = 0.0
                                rows.append(row)

    evidence = pd.DataFrame(rows)
    if not evidence.empty:
        counts = (
            evidence.groupby("item_template_id")
            .agg(template_attempts=("_runtime_event_key", "nunique"), template_students=("student_id", "nunique"))
            .reset_index()
        )
        evidence = evidence.drop(columns=["template_attempts", "template_students", "sparse_template"]).merge(
            counts, on="item_template_id", how="left"
        )
        evidence["sparse_template"] = (evidence["template_attempts"] < 5) | (evidence["template_students"] < 3)
        evidence = evidence.drop(columns=["_runtime_event_key"])
        for column in OUTPUT_COLUMNS:
            if column not in evidence.columns:
                evidence[column] = None
        evidence = evidence[OUTPUT_COLUMNS]

    if evidence.empty:
        unique_templates = 0
        non_sparse_templates = 0
        sparse_templates = 0
        non_sparse_by_axis: Dict[str, int] = {}
        partial_session_rows = 0
        students_from_partial_only = 0
    else:
        is_sparse = evidence["sparse_template"].astype(bool)
        unique_templates = int(evidence["item_template_id"].nunique())
        # sparse_template is computed per item_template_id (consistent across
        # any axis-duplicated rows for the same template), so this dedupes
        # correctly rather than counting summary rows.
        non_sparse_templates = int(evidence.loc[~is_sparse, "item_template_id"].nunique())
        sparse_templates = int(evidence.loc[is_sparse, "item_template_id"].nunique())
        non_sparse_by_axis = (
            evidence.loc[~is_sparse]
            .groupby("axis")["item_template_id"]
            .nunique()
            .to_dict()
        )
        is_finished_row = evidence["session_finished"].astype(bool)
        partial_session_rows = int((~is_finished_row).sum())
        students_with_finished = set(evidence.loc[is_finished_row, "student_id"])
        students_with_any = set(evidence["student_id"])
        students_from_partial_only = len(students_with_any - students_with_finished)

    audit = {
        "total_tests": total_tests,
        "finished_tests": finished_tests,
        "config_misses": config_misses,
        "alias_count": dict(alias_count),
        "observed_games": dict(observed_games),
        "legacy_schema_tests": legacy_schema_tests,
        "new_schema_tests": new_schema_tests,
        "unique_templates": unique_templates,
        "non_sparse_templates": non_sparse_templates,
        "sparse_templates": sparse_templates,
        "non_sparse_templates_by_axis": non_sparse_by_axis,
        "partial_session_rows": partial_session_rows,
        "students_from_partial_only": students_from_partial_only,
    }
    return evidence, audit


def build_template_summary(evidence: pd.DataFrame) -> pd.DataFrame:
    if evidence.empty:
        return pd.DataFrame()
    return (
        evidence.groupby(["item_template_id", "template_label", "game_type", "axis", "fine_skill", "config_context_id"], dropna=False)
        .agg(
            attempts=("item_template_id", "size"),
            students=("student_id", "nunique"),
            tests=("test_id", "nunique"),
            accuracy=("correct", "mean"),
            slow_rate=("is_slow", "mean"),
            sparse_template=("sparse_template", "max"),
            num_digits=("num_digits", "first"),
            complexity_level=("complexity_level", "first"),
            operation=("operation", "first"),
            skill_subtype=("skill_subtype", "first"),
            boundary_type=("boundary_type", "first"),
            comparison_type=("comparison_type", "first"),
            order_direction=("order_direction", "first"),
            sequence_length=("sequence_length", "first"),
        )
        .reset_index()
        .sort_values(["sparse_template", "attempts", "students"], ascending=[True, False, False])
    )


def build_student_template_summary(evidence: pd.DataFrame) -> pd.DataFrame:
    if evidence.empty:
        return pd.DataFrame()
    return (
        evidence.groupby(["student_id", "item_template_id", "game_type", "axis", "fine_skill"], dropna=False)
        .agg(
            attempts=("item_template_id", "size"),
            correct=("correct", "sum"),
            accuracy=("correct", "mean"),
            slow_rate=("is_slow", "mean"),
            sparse_template=("sparse_template", "max"),
        )
        .reset_index()
    )


def build_test_template_coverage(evidence: pd.DataFrame) -> pd.DataFrame:
    if evidence.empty:
        return pd.DataFrame()
    sparse_templates = (
        evidence[evidence["sparse_template"].astype(bool)]
        .groupby(["test_id", "game_type", "axis"], dropna=False)["item_template_id"]
        .nunique()
        .rename("sparse_templates")
        .reset_index()
    )
    coverage = (
        evidence.groupby(["test_id", "game_type", "axis"], dropna=False)
        .agg(
            item_axis_rows=("item_template_id", "size"),
            unique_templates=("item_template_id", "nunique"),
            students=("student_id", "nunique"),
            config_contexts=("config_context_id", "nunique"),
        )
        .reset_index()
    )
    coverage = coverage.merge(sparse_templates, on=["test_id", "game_type", "axis"], how="left")
    coverage["sparse_templates"] = coverage["sparse_templates"].fillna(0).astype(int)
    return coverage


def save_outputs(
    outdir: Path,
    evidence: pd.DataFrame,
    template_summary: pd.DataFrame,
    student_template_summary: pd.DataFrame,
    test_template_coverage: pd.DataFrame,
    audit: Dict[str, Any],
) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    evidence.to_csv(outdir / "item_template_evidence.csv", index=False)
    template_summary.to_csv(outdir / "template_summary.csv", index=False)
    student_template_summary.to_csv(outdir / "student_template_summary.csv", index=False)
    test_template_coverage.to_csv(outdir / "test_template_coverage.csv", index=False)
    with (outdir / "template_extraction_audit.json").open("w", encoding="utf-8") as f:
        json.dump(audit, f, indent=2, ensure_ascii=False)
    with pd.ExcelWriter(outdir / "template_extraction_audit.xlsx") as writer:
        evidence.to_excel(writer, sheet_name="item_template_evidence", index=False)
        template_summary.to_excel(writer, sheet_name="template_summary", index=False)
        student_template_summary.to_excel(writer, sheet_name="student_template_summary", index=False)
        test_template_coverage.to_excel(writer, sheet_name="test_template_coverage", index=False)


def print_audit(
    evidence: pd.DataFrame,
    template_summary: pd.DataFrame,
    student_template_summary: pd.DataFrame,
    test_template_coverage: pd.DataFrame,
    audit: Dict[str, Any],
    outdir: Path,
) -> None:
    print("\n" + "=" * 80)
    print("DM-TaRL item template extraction audit")
    print("=" * 80)
    print(f"Total sessions evaluated (legacy tests + individual attempts): {audit['total_tests']}")
    print(f"  - Legacy schema (flat):      {audit['legacy_schema_tests']}")
    print(f"  - New schema (attempts):     {audit['new_schema_tests']}")
    print(f"Finished assessments processed: {audit['finished_tests']}")
    print(f"Runtime item-axis rows:         {len(evidence)}")
    print(f"  - From partial (non-finished) sessions: {audit['partial_session_rows']}")
    print(f"Unique students:                {evidence['student_id'].nunique() if not evidence.empty else 0}")
    print(f"  - Students with evidence only from partial sessions: {audit['students_from_partial_only']}")
    print(f"Unique item templates identified: {audit['unique_templates']}")
    print(f"  - Non-sparse (>=5 attempts, >=3 students - robust for PFA/BKT): {audit['non_sparse_templates']}")
    print(f"  - Sparse (excluded from modeling):                              {audit['sparse_templates']}")
    if audit["non_sparse_templates_by_axis"]:
        print("  - Non-sparse templates by axis:")
        for axis in AXES:
            count = audit["non_sparse_templates_by_axis"].get(axis, 0)
            print(f"      {axis:22s} {count}")
    print(f"Config joins missed:            {audit['config_misses']}")
    if audit["alias_count"]:
        print(f"Aliases observed:               {audit['alias_count']}")
    print(f"Observed games:                 {', '.join(sorted(audit['observed_games']))}")

    if not template_summary.empty:
        sparse = template_summary[template_summary["sparse_template"].astype(bool)]
        print(f"Sparse template rows:           {len(sparse)} of {len(template_summary)} summary rows")
        print("\nTop templates:")
        print(template_summary.head(12).to_string(index=False))

    if not test_template_coverage.empty:
        print("\nTest/template coverage:")
        print(test_template_coverage.head(12).to_string(index=False))

    print("\nModeling note:")
    print("  No PFA/BKT was run. Templates with fewer than 5 attempts or fewer than 3 students are flagged sparse_template=True.")
    print("  Evidence is included from partial (non-finished) sessions too - filter on session_finished=True to restrict to completed assessments only.")
    print("  Exact generated numbers are preserved in audit columns but are not used as conceptual item IDs.")
    print(f"\nSaved outputs to: {outdir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract reusable DM-TaRL item templates from assessment logs.")
    parser.add_argument("--assessments", required=True, help="Firebase assessments JSON export.")
    parser.add_argument("--test-definitions", required=True, help="Firebase test definitions JSON export.")
    parser.add_argument("--taxonomy", required=True, help="DM-TaRL item template taxonomy JSON.")
    parser.add_argument("--outdir", default="outputs_templates", help="Output directory.")
    args = parser.parse_args()

    assessments_path = Path(args.assessments)
    test_definitions_path = Path(args.test_definitions)
    taxonomy_path = Path(args.taxonomy)
    outdir = Path(args.outdir)

    with assessments_path.open("r", encoding="utf-8") as f:
        assessments = json.load(f)
    with test_definitions_path.open("r", encoding="utf-8") as f:
        test_definitions = json.load(f)
    with taxonomy_path.open("r", encoding="utf-8") as f:
        taxonomy = json.load(f)

    test_definition_index = load_test_definition_index(test_definitions)
    default_config_index = load_default_config_index()
    evidence, audit = build_rows(assessments, test_definition_index, default_config_index, taxonomy)
    template_summary = build_template_summary(evidence)
    student_template_summary = build_student_template_summary(evidence)
    test_template_coverage = build_test_template_coverage(evidence)

    save_outputs(outdir, evidence, template_summary, student_template_summary, test_template_coverage, audit)
    print_audit(evidence, template_summary, student_template_summary, test_template_coverage, audit, outdir)


if __name__ == "__main__":
    main()