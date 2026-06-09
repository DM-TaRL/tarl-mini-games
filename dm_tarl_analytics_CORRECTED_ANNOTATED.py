#!/usr/bin/env python3
"""
DM-TaRL / Arithia corrected analytics pipeline.

This script replaces the old one-game-one-skill analytics pipeline with a
four-layer data architecture:

1. item_level_evidence:
   Item-axis rows from real mini-game logs. Multi-axis games produce one row
   per axis contribution.

2. fuzzy_axis_state:
   Saved learner-state values from the finished Firebase assessment.

3. weak_skill_events:
   Saved mistake-pattern events from weakSkills, with slow-only events removed
   for the current mistake-focused analysis.

4. test_level_summary:
   One row per finished assessment.

The modeling sections are intentionally cautious. The ability model below is
an IRT-like/PFA-lite logistic model, not full classic PFA, because classic PFA
requires prior success/failure opportunity counts. BKT, ARM, and SPM are kept
as exploratory pilot analyses and avoid strong claims from sparse data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import warnings
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

try:
    from scipy.optimize import minimize
except Exception:  # pragma: no cover - fallback keeps extraction runnable.
    minimize = None


warnings.filterwarnings("ignore", category=RuntimeWarning)


# ============================================================================
# SECTION 1: CONSTANTS AND CORRECTED AXIS PROJECTION
# ============================================================================

AXES = [
    "arithmetic_fluency",
    "number_sense",
    "sequential_thinking",
    "comparison_skill",
    "visual_matching",
    "audio_recognition",
]

# This is the high-level app-aligned projection only. It is not the sole source
# of evidence. Fine-grained item fields and weakSkills preserve the details that
# the old SKILL_MAP collapsed away.
AXIS_WEIGHTS: Dict[str, Dict[str, float]] = {
    "vertical_operations": {"arithmetic_fluency": 1.0},
    "choose_answer": {
        "arithmetic_fluency": 0.6,
        "number_sense": 0.2,
        "sequential_thinking": 0.2,
    },
    "find_compositions": {
        "arithmetic_fluency": 0.6,
        "number_sense": 0.4,
    },
    "multi_step_problem": {
        "arithmetic_fluency": 0.5,
        "sequential_thinking": 0.5,
    },
    "find_previous_next_number": {"sequential_thinking": 1.0},
    "order_numbers": {"sequential_thinking": 1.0},
    "compare_numbers": {"comparison_skill": 1.0},
    "tap_matching_pairs": {"visual_matching": 1.0},
    "identify_place_value": {"number_sense": 1.0},
    "decompose_number": {"number_sense": 1.0},
    "write_number_in_letters": {"number_sense": 1.0},
    "what_number_do_you_hear": {"audio_recognition": 1.0},
    "read_number_aloud": {"number_sense": 1.0},
}

GAME_ALIASES = {
    "multi_step_problems": "multi_step_problem",
}

OP_TEXT = {
    "+": "Addition",
    "add": "Addition",
    "addition": "Addition",
    "-": "Subtraction",
    "sub": "Subtraction",
    "subtraction": "Subtraction",
    "x": "Multiplication",
    "*": "Multiplication",
    "mul": "Multiplication",
    "multiplication": "Multiplication",
    "times": "Multiplication",
    "/": "Division",
    "div": "Division",
    "division": "Division",
    "divide": "Division",
}

ITEM_COLUMNS = [
    "student_id",
    "test_id",
    "game_type",
    "attempt_idx",
    "log_idx",
    "item_key",
    "axis",
    "axis_weight",
    "fine_skill",
    "operation",
    "skill_subtype",
    "question_type",
    "format",
    "correct",
    "time_spent_ms",
    "answer_time_category",
    "is_slow",
    "mistake_type",
    "num_digits",
    "complexity_level",
    "difficulty_zone",
    "sequence_length",
    "started_at",
    "finished_at",
    "question",
    "selected",
    "correct_answer",
    "answered",
    "expected",
    "given",
    "comparison_type",
    "order_direction",
    "operations_expected",
    "operations_used",
]

FUZZY_COLUMNS = [
    "student_id",
    "test_id",
    "axis",
    "fuzzy_score",
    "fuzzy_coverage",
    "membership_low",
    "membership_medium",
    "membership_high",
    "fuzzy_confidence",
    "evaluated_grade",
    "fuzzy_rule_fires",
]

WEAK_COLUMNS = [
    "student_id",
    "test_id",
    "game_type",
    "mistake_type",
    "weakness_type",
    "operation",
    "skill_subtype",
    "question_type",
    "format",
    "num_digits",
    "complexity_level",
    "comparison_type",
    "order_direction",
    "sequence_length",
    "difficulty_zone",
    "count",
    "examples",
    "expected",
    "given",
    "operations_expected",
    "operations_used",
]

TEST_COLUMNS = [
    "student_id",
    "test_id",
    "evaluated_grade",
    "fuzzy_confidence",
    "total_score",
    "num_games_passed",
    "total_duration_ms",
    "finished_at",
    "observed_game_count",
    "weak_skill_count_raw",
    "weak_skill_count_mistakes_only",
]


# ============================================================================
# SECTION 2: SMALL ROBUST HELPERS
# ============================================================================

def as_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return [v for v in value if v is not None]
    return []


def as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def canonical_game_type(game_type: str, warnings_seen: set[str]) -> str:
    if game_type in GAME_ALIASES:
        canonical = GAME_ALIASES[game_type]
        if game_type not in warnings_seen:
            print(f"WARNING: game type '{game_type}' found; treating it as '{canonical}'.")
            warnings_seen.add(game_type)
        return canonical
    return game_type


def is_slow_log(log: Dict[str, Any]) -> bool:
    return str(log.get("answerTimeCategory", "")).lower() == "slow"


def is_slow_weak_skill(ws: Dict[str, Any]) -> bool:
    return ws.get("weaknessType") == "SlowResponse" or ws.get("mistakeType") == "SlowButCorrect"


def safe_json(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=True, sort_keys=True)
    return str(value)


def stable_item_key(game_type: str, attempt_idx: int, log_idx: int, log: Dict[str, Any]) -> str:
    # The key is deterministic for ordering/auditing, but it is not treated as a
    # stable conceptual item ID. It uses meaningful attributes when available.
    meaningful = {
        "question": log.get("question"),
        "number": log.get("number"),
        "target": log.get("target"),
        "left": log.get("left"),
        "right": log.get("right"),
        "correctAnswer": log.get("correctAnswer"),
        "expected": log.get("expected"),
        "correctOrder": log.get("correctOrder"),
        "direction": log.get("direction"),
        "options": log.get("options"),
    }
    payload = json.dumps(meaningful, ensure_ascii=True, sort_keys=True, default=str)
    digest = hashlib.md5(payload.encode("utf-8")).hexdigest()[:10]
    return f"{game_type}|attempt={attempt_idx}|log={log_idx}|{digest}"


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


def num_digits_from_values(values: Iterable[Any]) -> Optional[int]:
    nums: List[int] = []
    for value in values:
        if isinstance(value, bool) or value is None:
            continue
        if isinstance(value, (int, float)) and not math.isnan(float(value)):
            nums.append(abs(int(value)))
        elif isinstance(value, str) and value.strip().lstrip("-").isdigit():
            nums.append(abs(int(value.strip())))
        elif isinstance(value, list):
            for nested in value:
                nested_digits = num_digits_from_values([nested])
                if nested_digits is not None:
                    nums.append(10 ** (nested_digits - 1))
        elif isinstance(value, dict):
            for nested in value.values():
                nested_digits = num_digits_from_values([nested])
                if nested_digits is not None:
                    nums.append(10 ** (nested_digits - 1))
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


def difficulty_zone_for_number(number: Any) -> Optional[str]:
    if not isinstance(number, int):
        return None
    start = (number // 10) * 10
    return f"{start}-{start + 9}"


def parse_vertical_question(log: Dict[str, Any]) -> Tuple[Optional[int], Optional[str], Optional[int]]:
    op = normalize_operation(log.get("operation") or log.get("operationUsed"))
    question = str(log.get("question") or "")
    nums = extract_numbers(question)
    if op is None:
        op = normalize_operation(question)
    if len(nums) >= 2:
        return nums[0], op, nums[1]
    return None, op, None


def classify_vertical_subskill(op: Optional[str], a: Optional[int], b: Optional[int]) -> Optional[str]:
    if op is None:
        return None
    if a is None or b is None:
        return {
            "Addition": "SimpleAddition",
            "Subtraction": "SimpleSubtraction",
            "Multiplication": "SingleStepMultiplication",
            "Division": "SingleStepDivision",
        }.get(op)

    a_digits = [int(x) for x in str(abs(a))]
    b_digits = [int(x) for x in str(abs(b)).zfill(len(a_digits))]

    if op == "Addition":
        return "AdditionWithCarry" if any(x + y >= 10 for x, y in zip(a_digits, b_digits)) else "SimpleAddition"
    if op == "Subtraction":
        return "SubtractionWithBorrow" if any(x < y for x, y in zip(a_digits, b_digits)) else "SimpleSubtraction"
    if op == "Multiplication":
        return "MultiStepMultiplication" if abs(a) > 9 or abs(b) > 9 else "SingleStepMultiplication"
    if op == "Division":
        if b == 0:
            return "DivisionByZeroInvalid"
        if a % b != 0:
            return "DivisionWithRemainder"
        return "MultiStepDivision" if abs(a) > abs(b) * 10 else "SingleStepDivision"
    return None


def comparison_type(left: Any, right: Any) -> Optional[str]:
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        if left > right:
            return "Greater"
        if left < right:
            return "Less"
        return "Equal"
    return None


def classify_comparison_mistake(correct_sign: Any, selected_sign: Any, is_correct: bool) -> Optional[str]:
    if is_correct:
        return None
    correct = str(correct_sign or "")
    selected = str(selected_sign or "")
    if (correct, selected) in {(">", "<"), ("<", ">")}:
        return "ReversedSign"
    if correct == "=":
        return "FailedEquality"
    return "WrongSign" if correct and selected else "UnknownMistake"


def classify_ordering_mistake(correct_order: Any, selected_order: Any, direction: Any, is_correct: bool) -> Optional[str]:
    if is_correct:
        return None
    correct = as_list(correct_order)
    selected = as_list(selected_order)
    if not selected or len(selected) < len(correct):
        return "IncompleteAnswer"
    if selected == list(reversed(correct)):
        return "ReversedDescending" if direction == "asc" else "ReversedAscending"
    wrong_positions = sum(c != s for c, s in zip(correct, selected))
    if wrong_positions == 1:
        return "OneMisplacedNumber"
    if wrong_positions > 1:
        return "MultipleMisplacements"
    return "UnknownMistake"


def classify_previous_next_mistake(question: Any, expected: Any, given: Any, is_correct: bool) -> Optional[str]:
    if is_correct:
        return None
    exp = as_list(expected)
    got = as_list(given)
    q = question if isinstance(question, int) else None
    if len(exp) >= 2 and len(got) >= 2:
        prev_ok = got[0] == exp[0]
        next_ok = got[1] == exp[1]
        if not prev_ok and next_ok:
            return "MissingPrevious"
        if prev_ok and not next_ok:
            return "MissingNext"
        if q is not None and (q % 10 == 0 or q % 10 == 9):
            return "TensTransitionMistake"
        if any(isinstance(a, int) and isinstance(b, int) and abs(a - b) == 1 for a, b in zip(exp, got)):
            return "OffByOne"
        return "RangeUncertainty"
    return "UnknownMistake"


def classify_decomposition_mistake(expected: Any, given: Any, is_correct: bool) -> Optional[str]:
    if is_correct:
        return None
    exp = as_list(expected)
    got = as_list(given)
    if not got:
        return "IncompleteAnswer"
    if exp and len(exp) != len(got):
        return "WrongNumberOfParts"
    if exp != got:
        return "IncorrectValues"
    return "UnknownMistake"


def classify_text_number_mistake(number: Any, expected: Any, given: Any, is_correct: bool) -> Optional[str]:
    if is_correct:
        return None
    given_text = str(given or "").strip().lower()
    expected_text = str(expected or number or "").strip().lower()
    if given_text and given_text == expected_text:
        return "RepeatedWritingMistake"
    if num_digits_from_values([number]) != num_digits_from_values(extract_numbers(given_text)):
        return "DigitLengthMistake"
    return "UnknownMistake"


# ============================================================================
# SECTION 3: FINE-GRAINED ITEM EVIDENCE
# ============================================================================

def extract_item_evidence(game_type: str, log: Dict[str, Any]) -> Dict[str, Any]:
    correct = bool(log.get("isCorrect"))
    ev: Dict[str, Any] = {
        "axis_weights": AXIS_WEIGHTS.get(game_type, {}),
        "fine_skill": game_type,
        "operation": None,
        "skill_subtype": None,
        "question_type": None,
        "format": None,
        "mistake_type": None,
        "num_digits": None,
        "complexity_level": None,
        "difficulty_zone": None,
        "sequence_length": None,
        "comparison_type": None,
        "order_direction": None,
        "operations_expected": None,
        "operations_used": None,
    }

    if game_type == "vertical_operations":
        a, op, b = parse_vertical_question(log)
        ev.update(
            fine_skill="vertical_operation_fluency",
            operation=op,
            skill_subtype=classify_vertical_subskill(op, a, b),
            question_type="VerticalOperation",
            format="Vertical",
            mistake_type=None if correct else "ComputationError",
            num_digits=num_digits_from_values([a, b, log.get("correctAnswer"), log.get("answered")]),
        )

    elif game_type == "choose_answer":
        options = as_list(log.get("options"))
        correct_option = next((str(o.get("text", "")) for o in options if isinstance(o, dict) and o.get("correct")), "")
        selected = str(log.get("selected") or "")
        question = str(log.get("question") or "")
        expected_ops = extract_operations(correct_option or question)
        used_ops = extract_operations(selected)
        mismatch = bool(expected_ops) and set(expected_ops) != set(used_ops)
        mistake = None if correct else ("MisidentifiedOperation" if mismatch else "ComputationError")
        ev.update(
            fine_skill="operation_identification_from_context",
            operation="+".join(expected_ops) if expected_ops else None,
            skill_subtype="MultiStepProblem" if len(expected_ops) > 1 else "OneStepProblem",
            question_type="WordProblem",
            format="Horizontal",
            mistake_type=mistake,
            num_digits=num_digits_from_values(extract_numbers(correct_option) + extract_numbers(question)),
            operations_expected="|".join(expected_ops) if expected_ops else None,
            operations_used="|".join(used_ops) if used_ops else None,
        )

    elif game_type == "find_compositions":
        target = log.get("target") or log.get("number")
        ev.update(
            fine_skill="number_composition",
            operation=normalize_operation(log.get("operation")),
            skill_subtype="Composition",
            question_type="Composition",
            format="Horizontal",
            mistake_type=None if correct else (log.get("errorType") or "CompositionError"),
            num_digits=num_digits_from_values([target, log.get("expected"), log.get("given")]),
        )

    elif game_type == "multi_step_problem":
        question = log.get("question")
        ops = extract_operations(question) or [normalize_operation(log.get("operation"))]
        ops = [op for op in ops if op]
        ev.update(
            fine_skill="multi_step_problem_solving",
            operation="+".join(ops) if ops else None,
            skill_subtype="MultiStepProblem",
            question_type="WordProblem",
            format="Mixed",
            mistake_type=None if correct else "ComputationError",
            num_digits=num_digits_from_values(extract_numbers(question) + extract_numbers(log.get("expected"))),
            operations_expected="|".join(ops) if ops else None,
        )

    elif game_type == "compare_numbers":
        left, right = log.get("left"), log.get("right")
        comp = comparison_type(left, right)
        ev.update(
            fine_skill="number_comparison",
            skill_subtype=comp,
            question_type="Comparison",
            format="Horizontal",
            mistake_type=classify_comparison_mistake(log.get("correctSign"), log.get("selectedSign"), correct),
            num_digits=num_digits_from_values([left, right]),
            comparison_type=comp,
        )

    elif game_type == "order_numbers":
        nums = as_list(log.get("numbers"))
        direction = log.get("direction")
        ev.update(
            fine_skill="number_ordering",
            skill_subtype=f"Ordering_{direction}" if direction else "Ordering",
            question_type="Ordering",
            format="Visual",
            mistake_type=classify_ordering_mistake(log.get("correctOrder"), log.get("selectedOrder"), direction, correct),
            num_digits=num_digits_from_values(nums),
            sequence_length=len(nums) if nums else None,
            order_direction=direction,
        )

    elif game_type == "find_previous_next_number":
        q = log.get("question")
        ev.update(
            fine_skill="previous_next_number",
            skill_subtype="PreviousAndNext",
            question_type="Sequence",
            format="Horizontal",
            mistake_type=classify_previous_next_mistake(q, log.get("expected"), log.get("given"), correct),
            num_digits=num_digits_from_values([q]),
            difficulty_zone=difficulty_zone_for_number(q),
        )

    elif game_type == "identify_place_value":
        ev.update(
            fine_skill="place_value_identification",
            skill_subtype="PlaceValue",
            question_type="PlaceValue",
            format="Visual",
            mistake_type=None if correct else "PlaceValueMisidentification",
            num_digits=num_digits_from_values([log.get("number")]),
        )

    elif game_type == "decompose_number":
        ev.update(
            fine_skill="number_decomposition",
            skill_subtype="Decomposition",
            question_type="Decomposition",
            format="Visual",
            mistake_type=classify_decomposition_mistake(log.get("expected"), log.get("given"), correct),
            num_digits=num_digits_from_values([log.get("number"), log.get("expected"), log.get("given")]),
        )

    elif game_type == "write_number_in_letters":
        given = log.get("given") or log.get("selected") or log.get("transcript")
        ev.update(
            fine_skill="number_writing",
            skill_subtype="WrittenNumberProduction",
            question_type="NumberWriting",
            format="Mixed",
            mistake_type=classify_text_number_mistake(log.get("number"), log.get("expected"), given, correct),
            num_digits=num_digits_from_values([log.get("number")]),
        )

    elif game_type == "what_number_do_you_hear":
        ev.update(
            fine_skill="auditory_number_recognition",
            skill_subtype="HeardNumberChoice",
            question_type="AudioRecognition",
            format="Audio",
            mistake_type=None if correct else "AudioNumberRecognitionError",
            num_digits=num_digits_from_values([log.get("correctAnswer"), log.get("question"), log.get("selected")]),
        )

    elif game_type == "read_number_aloud":
        ev.update(
            fine_skill="oral_number_reading",
            skill_subtype="ReadNumberAloud",
            question_type="OralReading",
            format="Audio",
            mistake_type=None if correct else "SpeechNumberReadingError",
            num_digits=num_digits_from_values([log.get("number"), log.get("parsed"), log.get("question")]),
        )

    elif game_type == "tap_matching_pairs":
        ev.update(
            fine_skill="number_word_matching",
            skill_subtype="MatchingPairs",
            question_type="VisualMatching",
            format="Visual",
            mistake_type=None if correct else "MatchingPairError",
        )

    ev["complexity_level"] = complexity_from_digits(ev.get("num_digits"))
    return ev


# ============================================================================
# SECTION 4: FOUR CORE TABLES
# ============================================================================

def weak_skill_row(student_id: str, test_id: str, ws: Dict[str, Any]) -> Dict[str, Any]:
    game_type = ws.get("gameType")
    mistake_type = ws.get("mistakeType")
    weakness_type = ws.get("weaknessType")
    if not mistake_type and weakness_type == "WrongAnswer":
        if game_type == "vertical_operations":
            mistake_type = "ComputationError"
        elif game_type == "identify_place_value":
            mistake_type = "PlaceValueMisidentification"
        else:
            mistake_type = "WrongAnswer"
    operation = ws.get("operation") or ws.get("operationType")
    operations_expected = ws.get("operationsExpected") or ws.get("expectedOperations")
    operations_used = ws.get("operationsUsed") or ws.get("usedOperations")
    return {
        "student_id": student_id,
        "test_id": test_id,
        "game_type": game_type,
        "mistake_type": mistake_type,
        "weakness_type": weakness_type,
        "operation": operation,
        "skill_subtype": ws.get("skillSubtype") or ws.get("skill_subtype") or ws.get("subtype"),
        "question_type": ws.get("questionType"),
        "format": ws.get("format"),
        "num_digits": ws.get("numDigits"),
        "complexity_level": ws.get("complexityLevel"),
        "comparison_type": ws.get("comparisonType"),
        "order_direction": ws.get("orderDirection") or ws.get("direction"),
        "sequence_length": ws.get("sequenceLength"),
        "difficulty_zone": ws.get("difficultyZone"),
        "count": ws.get("count", 1),
        "examples": safe_json(ws.get("examples")),
        "expected": safe_json(ws.get("expected")),
        "given": safe_json(ws.get("given")),
        "operations_expected": safe_json(operations_expected),
        "operations_used": safe_json(operations_used),
    }


def flatten_assessments(assessments: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    item_rows: List[Dict[str, Any]] = []
    fuzzy_rows: List[Dict[str, Any]] = []
    weak_rows: List[Dict[str, Any]] = []
    test_rows: List[Dict[str, Any]] = []
    warnings_seen: set[str] = set()
    raw_weak_count = 0
    skipped_slow_weak_count = 0
    total_assessments = 0
    finished_assessments = 0

    for student_id, tests in (assessments or {}).items():
        if not isinstance(tests, dict) or str(student_id).startswith("_"):
            continue

        for test_id, test in tests.items():
            if not isinstance(test, dict):
                continue
            total_assessments += 1
            if not test.get("finished"):
                continue
            finished_assessments += 1

            mini_games = as_dict(test.get("miniGames"))
            raw_weak_skills = [ws for ws in as_list(test.get("weakSkills")) if isinstance(ws, dict)]
            raw_weak_count += len(raw_weak_skills)
            mistake_weak_skills = [ws for ws in raw_weak_skills if not is_slow_weak_skill(ws)]
            skipped_slow_weak_count += len(raw_weak_skills) - len(mistake_weak_skills)

            test_rows.append(
                {
                    "student_id": student_id,
                    "test_id": test_id,
                    "evaluated_grade": test.get("evaluatedGrade"),
                    "fuzzy_confidence": test.get("fuzzyConfidence"),
                    "total_score": test.get("totalScore"),
                    "num_games_passed": test.get("numGamesPassed"),
                    "total_duration_ms": test.get("totalDurationMs"),
                    "finished_at": test.get("finishedAt"),
                    "observed_game_count": len(mini_games),
                    "weak_skill_count_raw": len(raw_weak_skills),
                    "weak_skill_count_mistakes_only": len(mistake_weak_skills),
                }
            )

            fuzzy_inputs = as_dict(test.get("fuzzyInputs"))
            fuzzy_coverage = as_dict(test.get("fuzzyCoverage"))
            fuzzy_memberships = as_dict(test.get("fuzzyMemberships"))
            fuzzy_rule_fires = test.get("fuzzyRuleFires")

            for axis in AXES:
                membership = as_dict(fuzzy_memberships.get(axis))
                fuzzy_rows.append(
                    {
                        "student_id": student_id,
                        "test_id": test_id,
                        "axis": axis,
                        "fuzzy_score": fuzzy_inputs.get(axis),
                        "fuzzy_coverage": fuzzy_coverage.get(axis),
                        "membership_low": membership.get("low"),
                        "membership_medium": membership.get("medium"),
                        "membership_high": membership.get("high"),
                        "fuzzy_confidence": test.get("fuzzyConfidence"),
                        "evaluated_grade": test.get("evaluatedGrade"),
                        "fuzzy_rule_fires": safe_json(fuzzy_rule_fires),
                    }
                )

            for ws in mistake_weak_skills:
                weak_rows.append(weak_skill_row(student_id, test_id, ws))

            for raw_game_type, game_data in mini_games.items():
                game_type = canonical_game_type(str(raw_game_type), warnings_seen)
                if game_type == "division_game":
                    print("WARNING: 'division_game' found in data; this is not expected and will be ignored.")
                    continue

                if isinstance(game_data, dict) and isinstance(game_data.get("attempts"), list):
                    attempts = as_list(game_data.get("attempts"))
                else:
                    attempts = as_list(game_data)

                for attempt_idx, attempt in enumerate(attempts):
                    if not isinstance(attempt, dict):
                        continue
                    started_at = attempt.get("startedAt") or test.get("createdAt")
                    finished_at = attempt.get("finishedAt") or test.get("finishedAt")
                    for log_idx, log in enumerate(as_list(attempt.get("logs"))):
                        if not isinstance(log, dict):
                            continue
                        ev = extract_item_evidence(game_type, log)
                        base = {
                            "student_id": student_id,
                            "test_id": test_id,
                            "game_type": game_type,
                            "attempt_idx": attempt_idx,
                            "log_idx": log_idx,
                            "item_key": stable_item_key(game_type, attempt_idx, log_idx, log),
                            "fine_skill": ev.get("fine_skill"),
                            "operation": ev.get("operation"),
                            "skill_subtype": ev.get("skill_subtype"),
                            "question_type": ev.get("question_type"),
                            "format": ev.get("format"),
                            "correct": int(bool(log.get("isCorrect"))),
                            "time_spent_ms": log.get("timeSpentMs"),
                            "answer_time_category": log.get("answerTimeCategory"),
                            "is_slow": int(is_slow_log(log)),
                            "mistake_type": ev.get("mistake_type"),
                            "num_digits": ev.get("num_digits"),
                            "complexity_level": ev.get("complexity_level"),
                            "difficulty_zone": ev.get("difficulty_zone"),
                            "sequence_length": ev.get("sequence_length"),
                            "started_at": started_at,
                            "finished_at": finished_at,
                            "question": safe_json(log.get("question")),
                            "selected": safe_json(log.get("selected")),
                            "correct_answer": safe_json(log.get("correctAnswer")),
                            "answered": safe_json(log.get("answered")),
                            "expected": safe_json(log.get("expected")),
                            "given": safe_json(log.get("given")),
                            "comparison_type": ev.get("comparison_type"),
                            "order_direction": ev.get("order_direction"),
                            "operations_expected": ev.get("operations_expected"),
                            "operations_used": ev.get("operations_used"),
                        }
                        weights = ev.get("axis_weights") or {}
                        if not weights:
                            row = dict(base)
                            row["axis"] = "unknown"
                            row["axis_weight"] = 0.0
                            item_rows.append(row)
                        for axis, weight in weights.items():
                            row = dict(base)
                            row["axis"] = axis
                            row["axis_weight"] = float(weight)
                            item_rows.append(row)

    metadata = {
        "total_assessments": total_assessments,
        "finished_assessments": finished_assessments,
        "raw_weak_count": raw_weak_count,
        "skipped_slow_weak_count": skipped_slow_weak_count,
        "warnings_seen": sorted(warnings_seen),
    }

    return (
        pd.DataFrame(item_rows, columns=ITEM_COLUMNS),
        pd.DataFrame(fuzzy_rows, columns=FUZZY_COLUMNS),
        pd.DataFrame(weak_rows, columns=WEAK_COLUMNS),
        pd.DataFrame(test_rows, columns=TEST_COLUMNS),
        metadata,
    )


# ============================================================================
# SECTION 5: SUMMARIES
# ============================================================================

def build_axis_summary(items: pd.DataFrame, fuzzy: pd.DataFrame) -> pd.DataFrame:
    observed_axes = set(items.loc[items["axis"].isin(AXES), "axis"]) if not items.empty else set()
    rows: List[Dict[str, Any]] = []
    for axis in AXES:
        axis_items = items[items["axis"] == axis] if not items.empty else pd.DataFrame()
        fuzzy_axis = fuzzy[fuzzy["axis"] == axis] if not fuzzy.empty else pd.DataFrame()
        rows.append(
            {
                "axis": axis,
                "rows": len(axis_items),
                "weighted_item_contributions": axis_items["axis_weight"].sum() if not axis_items.empty else 0.0,
                "students": axis_items["student_id"].nunique() if not axis_items.empty else 0,
                "accuracy": axis_items["correct"].mean() if not axis_items.empty else np.nan,
                "slow_rate": axis_items["is_slow"].mean() if not axis_items.empty else np.nan,
                "fuzzy_score_mean": fuzzy_axis["fuzzy_score"].mean() if not fuzzy_axis.empty else np.nan,
                "evidence_layer": "item-observed" if axis in observed_axes else "fuzzy-only",
            }
        )
    return pd.DataFrame(rows)


def build_fuzzy_axis_summary(fuzzy: pd.DataFrame) -> pd.DataFrame:
    if fuzzy.empty:
        return pd.DataFrame(columns=["axis", "students", "tests", "mean_fuzzy_score", "mean_coverage", "mean_confidence"])
    return (
        fuzzy.groupby("axis")
        .agg(
            students=("student_id", "nunique"),
            tests=("test_id", "nunique"),
            mean_fuzzy_score=("fuzzy_score", "mean"),
            mean_coverage=("fuzzy_coverage", "mean"),
            mean_confidence=("fuzzy_confidence", "mean"),
        )
        .reset_index()
    )


def build_mistake_summary(weak: pd.DataFrame) -> pd.DataFrame:
    if weak.empty:
        return pd.DataFrame(columns=["game_type", "mistake_type", "events", "weighted_count"])
    return (
        weak.groupby(["game_type", "mistake_type"], dropna=False)
        .agg(events=("mistake_type", "size"), weighted_count=("count", "sum"))
        .reset_index()
        .sort_values(["weighted_count", "events"], ascending=False)
    )


# ============================================================================
# SECTION 6: IRT-LIKE / PFA-LITE ABILITY MODEL
# ============================================================================

class IRTLikeAbilityModel:
    """
    A small weighted logistic ability-item model.

    This is not full classic PFA. It does not include prior success and failure
    opportunity counts. The axis_weight contributes to the likelihood so that
    multi-axis games contribute proportionally to their projected axes.
    """

    def __init__(self, df: pd.DataFrame, max_iterations: int = 80):
        self.df = df.copy()
        self.students = sorted(self.df["student_id"].dropna().unique())
        self.items = sorted(self.df["item_key"].dropna().unique())
        self.max_iterations = max_iterations
        self.theta = np.zeros(len(self.students))
        self.delta = np.zeros(len(self.items))
        self.success = False
        self.message = ""
        self.student_index = {student: i for i, student in enumerate(self.students)}
        self.item_index = {item: i for i, item in enumerate(self.items)}

    def negative_likelihood(self, params: np.ndarray) -> float:
        n_s = len(self.students)
        theta = params[:n_s]
        delta = params[n_s:]
        ll = 0.0
        for row in self.df.itertuples(index=False):
            s_idx = self.student_index[getattr(row, "student_id")]
            i_idx = self.item_index[getattr(row, "item_key")]
            weight = float(getattr(row, "axis_weight") or 1.0)
            y = int(getattr(row, "correct"))
            logodds = np.clip(theta[s_idx] - delta[i_idx], -50, 50)
            p = 1.0 / (1.0 + np.exp(-logodds))
            ll += weight * (y * np.log(p + 1e-10) + (1 - y) * np.log(1 - p + 1e-10))
        penalty = 0.02 * float(np.sum(params * params))
        return -ll + penalty

    def fit(self) -> bool:
        if minimize is None:
            self.message = "scipy is unavailable"
            return False
        params_init = np.concatenate([self.theta, self.delta])
        bounds = [(-5, 5)] * len(self.students) + [(-5, 5)] * len(self.items)
        result = minimize(
            self.negative_likelihood,
            params_init,
            method="L-BFGS-B",
            bounds=bounds,
            options={"maxiter": self.max_iterations, "ftol": 1e-5},
        )
        self.success = bool(result.success)
        self.message = str(result.message)
        if self.success:
            n_s = len(self.students)
            self.theta = result.x[:n_s]
            self.delta = result.x[n_s:]
        return self.success


def run_irt_axis_models(items: pd.DataFrame, min_students: int = 3, min_responses: int = 10) -> Tuple[pd.DataFrame, Dict[str, str]]:
    rows: List[Dict[str, Any]] = []
    skipped: Dict[str, str] = {}
    if items.empty:
        return pd.DataFrame(), {"all": "no item-level evidence"}

    for axis in AXES:
        axis_df = items[items["axis"] == axis].copy()
        n_students = axis_df["student_id"].nunique()
        n_responses = len(axis_df)
        if n_students < min_students:
            skipped[axis] = f"too few students ({n_students})"
            continue
        if n_responses < min_responses:
            skipped[axis] = f"too few responses ({n_responses})"
            continue
        if axis_df["correct"].nunique() < 2:
            skipped[axis] = "no variation in correctness"
            continue
        model = IRTLikeAbilityModel(axis_df)
        success = model.fit()
        rows.append(
            {
                "axis": axis,
                "students": n_students,
                "responses": n_responses,
                "items": axis_df["item_key"].nunique(),
                "accuracy": axis_df["correct"].mean(),
                "weighted_responses": axis_df["axis_weight"].sum(),
                "model_success": success,
                "model_message": model.message,
                "theta_mean": float(np.mean(model.theta)) if success else np.nan,
                "theta_sd": float(np.std(model.theta)) if success else np.nan,
                "delta_mean": float(np.mean(model.delta)) if success else np.nan,
                "delta_sd": float(np.std(model.delta)) if success else np.nan,
            }
        )
        if not success:
            skipped[axis] = model.message or "model did not converge"
    return pd.DataFrame(rows), skipped


# ============================================================================
# SECTION 7: EXPLORATORY BKT
# ============================================================================

class BKTModel:
    def __init__(self, p_init: float = 0.3, p_learn: float = 0.2, p_slip: float = 0.1, p_guess: float = 0.1):
        self.p_init = p_init
        self.p_learn = p_learn
        self.p_slip = p_slip
        self.p_guess = p_guess

    def forward(self, observations: Sequence[int]) -> List[float]:
        p_mastered = self.p_init
        curve = [p_mastered]
        for correct in observations:
            if correct:
                numerator = (1 - self.p_slip) * p_mastered
                denominator = numerator + self.p_guess * (1 - p_mastered)
            else:
                numerator = self.p_slip * p_mastered
                denominator = numerator + (1 - self.p_guess) * (1 - p_mastered)
            posterior = numerator / (denominator + 1e-10)
            p_mastered = posterior + (1 - posterior) * self.p_learn
            curve.append(float(p_mastered))
        return curve


def ordered_items(items: pd.DataFrame) -> pd.DataFrame:
    if items.empty:
        return items
    ordered = items.copy()
    for col in ["started_at", "finished_at"]:
        ordered[col] = ordered[col].fillna("")
    return ordered.sort_values(["student_id", "test_id", "started_at", "finished_at", "attempt_idx", "log_idx"])


def run_bkt_axis_models(items: pd.DataFrame, min_students: int = 3, min_sequences: int = 3, min_sequence_len: int = 2) -> Tuple[pd.DataFrame, Dict[str, str], Dict[str, List[float]]]:
    rows: List[Dict[str, Any]] = []
    skipped: Dict[str, str] = {}
    sample_curves: Dict[str, List[float]] = {}
    bkt = BKTModel()
    items = ordered_items(items)

    for axis in AXES:
        axis_df = items[items["axis"] == axis]
        sequences: List[List[int]] = []
        for _, group in axis_df.groupby(["student_id", "test_id"]):
            obs = group["correct"].astype(int).tolist()
            if len(obs) >= min_sequence_len:
                sequences.append(obs)
        unique_students = axis_df["student_id"].nunique()
        if unique_students < min_students:
            skipped[axis] = f"too few students ({unique_students})"
            continue
        if len(sequences) < min_sequences:
            skipped[axis] = f"too few repeated sequences ({len(sequences)})"
            continue
        final_masteries = []
        lengths = []
        first_curve = None
        for seq in sequences:
            curve = bkt.forward(seq)
            final_masteries.append(curve[-1])
            lengths.append(len(seq))
            if first_curve is None:
                first_curve = curve
        sample_curves[axis] = first_curve or []
        rows.append(
            {
                "axis": axis,
                "students": unique_students,
                "sequences": len(sequences),
                "mean_sequence_length": float(np.mean(lengths)),
                "mean_final_mastery": float(np.mean(final_masteries)),
                "median_final_mastery": float(np.median(final_masteries)),
                "note": "Exploratory fixed-parameter BKT; not a robust learning-rate estimate.",
            }
        )
    return pd.DataFrame(rows), skipped, sample_curves


# ============================================================================
# SECTION 8: ARM AND SPM FROM MISTAKE-FOCUSED EVIDENCE
# ============================================================================

def run_arm(weak: pd.DataFrame, min_support: float = 0.10, min_confidence: float = 0.60) -> pd.DataFrame:
    columns = ["antecedent", "consequent", "support", "confidence", "count", "basket_count"]
    if weak.empty:
        return pd.DataFrame(columns=columns)

    baskets: List[set[str]] = []
    for _, group in weak.groupby(["student_id", "test_id"]):
        signatures = {
            f"{row.game_type}:{row.mistake_type}"
            for row in group.itertuples(index=False)
            if row.game_type and row.mistake_type
        }
        if signatures:
            baskets.append(signatures)

    basket_count = len(baskets)
    if basket_count == 0:
        return pd.DataFrame(columns=columns)

    item_counts = Counter()
    pair_counts = Counter()
    for basket in baskets:
        for item in basket:
            item_counts[item] += 1
        for a, b in combinations(sorted(basket), 2):
            pair_counts[(a, b)] += 1

    rows: List[Dict[str, Any]] = []
    for (a, b), count in pair_counts.items():
        for antecedent, consequent in [(a, b), (b, a)]:
            support = count / basket_count
            confidence = count / item_counts[antecedent]
            if support >= min_support and confidence >= min_confidence:
                rows.append(
                    {
                        "antecedent": antecedent,
                        "consequent": consequent,
                        "support": support,
                        "confidence": confidence,
                        "count": count,
                        "basket_count": basket_count,
                    }
                )
    return pd.DataFrame(rows, columns=columns).sort_values(["support", "confidence"], ascending=False) if rows else pd.DataFrame(columns=columns)


def run_spm(items: pd.DataFrame, min_count: int = 2) -> pd.DataFrame:
    columns = ["pattern", "count", "student_count", "support_students"]
    if items.empty:
        return pd.DataFrame(columns=columns)

    mistake_items = items[
        items["mistake_type"].notna()
        & (items["mistake_type"] != "")
        & (items["mistake_type"] != "SlowButCorrect")
    ].copy()
    if mistake_items.empty:
        return pd.DataFrame(columns=columns)

    # Multi-axis games duplicate the same item event. For SPM we keep one event
    # per logged mistake before constructing chains.
    mistake_items = mistake_items.drop_duplicates(
        ["student_id", "test_id", "game_type", "attempt_idx", "log_idx", "mistake_type"]
    )
    mistake_items = ordered_items(mistake_items)

    pattern_counts = Counter()
    pattern_students: Dict[str, set[str]] = defaultdict(set)
    all_students = mistake_items["student_id"].nunique()

    for (student_id, test_id), group in mistake_items.groupby(["student_id", "test_id"]):
        signatures = [f"{r.game_type}:{r.mistake_type}" for r in group.itertuples(index=False)]
        for current, nxt in zip(signatures, signatures[1:]):
            pattern = f"{current} -> {nxt}"
            pattern_counts[pattern] += 1
            pattern_students[pattern].add(str(student_id))

    rows = [
        {
            "pattern": pattern,
            "count": count,
            "student_count": len(pattern_students[pattern]),
            "support_students": len(pattern_students[pattern]) / all_students if all_students else np.nan,
        }
        for pattern, count in pattern_counts.items()
        if count >= min_count
    ]
    return pd.DataFrame(rows, columns=columns).sort_values(["count", "student_count"], ascending=False) if rows else pd.DataFrame(columns=columns)


# ============================================================================
# SECTION 9: VISUALIZATION
# ============================================================================

def create_corrected_figure(
    outpath: Path,
    axis_summary: pd.DataFrame,
    fuzzy_summary: pd.DataFrame,
    mistake_summary: pd.DataFrame,
    bkt_results: pd.DataFrame,
    bkt_curves: Dict[str, List[float]],
) -> None:
    panels: List[str] = []
    if not axis_summary.empty and axis_summary["rows"].sum() > 0:
        panels.append("item_axis")
    if not fuzzy_summary.empty:
        panels.append("fuzzy_axis")
    if not mistake_summary.empty:
        panels.append("mistakes")
    if not bkt_results.empty and bkt_curves:
        panels.append("bkt")

    if not panels:
        return

    cols = 2 if len(panels) > 1 else 1
    rows = int(math.ceil(len(panels) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(7 * cols, 4.8 * rows))
    axes_list = np.atleast_1d(axes).ravel()

    for ax, panel in zip(axes_list, panels):
        if panel == "item_axis":
            data = axis_summary[axis_summary["rows"] > 0].copy()
            ax.barh(data["axis"], data["accuracy"] * 100, color="#4878a8")
            ax.set_title("Item-level axis performance")
            ax.set_xlabel("Accuracy (%)")
            ax.set_xlim(0, 100)
            ax.grid(axis="x", alpha=0.25)
        elif panel == "fuzzy_axis":
            data = fuzzy_summary.sort_values("mean_fuzzy_score")
            ax.barh(data["axis"], data["mean_fuzzy_score"], color="#6a9f58")
            ax.set_title("Saved fuzzy axis scores")
            ax.set_xlabel("Mean fuzzy score")
            ax.set_xlim(0, 100)
            ax.grid(axis="x", alpha=0.25)
        elif panel == "mistakes":
            data = mistake_summary.head(10).copy()
            labels = data["game_type"].astype(str) + ": " + data["mistake_type"].astype(str)
            ax.barh(labels[::-1], data["weighted_count"].iloc[::-1], color="#b66b5d")
            ax.set_title("Top mistake-focused weak skill events")
            ax.set_xlabel("Saved count")
            ax.grid(axis="x", alpha=0.25)
        elif panel == "bkt":
            for axis, curve in list(bkt_curves.items())[:5]:
                ax.plot(range(len(curve)), curve, marker="o", label=axis)
            ax.axhline(0.8, color="#a33", linestyle="--", alpha=0.5)
            ax.set_ylim(0, 1)
            ax.set_title("Exploratory BKT sample curves")
            ax.set_xlabel("Attempt index")
            ax.set_ylabel("P(mastered)")
            ax.legend(fontsize=8)
            ax.grid(alpha=0.25)

    for ax in axes_list[len(panels):]:
        ax.remove()

    fig.suptitle("DM-TaRL corrected analytics: item, fuzzy, mistake, and exploratory model evidence", fontsize=13)
    fig.tight_layout()
    fig.savefig(outpath, dpi=300, bbox_inches="tight")
    plt.close(fig)


# ============================================================================
# SECTION 10: SAVING AND REPORTING
# ============================================================================

def save_outputs(
    outdir: Path,
    items: pd.DataFrame,
    fuzzy: pd.DataFrame,
    weak: pd.DataFrame,
    tests: pd.DataFrame,
    axis_summary: pd.DataFrame,
    fuzzy_summary: pd.DataFrame,
    mistake_summary: pd.DataFrame,
    pfa_axis_results: pd.DataFrame,
    bkt_axis_results: pd.DataFrame,
    arm_rules: pd.DataFrame,
    spm_sequences: pd.DataFrame,
) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    tables = {
        "item_level_evidence": items,
        "fuzzy_axis_state": fuzzy,
        "weak_skill_events": weak,
        "test_level_summary": tests,
        "axis_summary": axis_summary,
        "fuzzy_axis_summary": fuzzy_summary,
        "mistake_summary": mistake_summary,
        "pfa_axis_results": pfa_axis_results,
        "bkt_axis_results": bkt_axis_results,
        "arm_mistake_rules": arm_rules,
        "spm_mistake_sequences": spm_sequences,
    }

    for name, df in tables.items():
        df.to_csv(outdir / f"{name}.csv", index=False)

    with pd.ExcelWriter(outdir / "analysis_audit_tables.xlsx") as writer:
        for name, df in tables.items():
            df.to_excel(writer, sheet_name=name[:31], index=False)


def print_report(
    metadata: Dict[str, Any],
    items: pd.DataFrame,
    fuzzy: pd.DataFrame,
    weak: pd.DataFrame,
    tests: pd.DataFrame,
    axis_summary: pd.DataFrame,
    mistake_summary: pd.DataFrame,
    pfa_axis_results: pd.DataFrame,
    pfa_skipped: Dict[str, str],
    bkt_axis_results: pd.DataFrame,
    bkt_skipped: Dict[str, str],
    arm_rules: pd.DataFrame,
    spm_sequences: pd.DataFrame,
    outdir: Path,
) -> None:
    raw_weak = int(tests["weak_skill_count_raw"].sum()) if not tests.empty else 0
    mistake_weak = int(tests["weak_skill_count_mistakes_only"].sum()) if not tests.empty else 0
    observed_games = sorted(items["game_type"].dropna().unique()) if not items.empty else []
    fuzzy_only_axes = axis_summary.loc[axis_summary["evidence_layer"] == "fuzzy-only", "axis"].tolist()

    print("\n" + "=" * 80)
    print("DM-TARL CORRECTED ANALYTICS REPORT")
    print("=" * 80)

    print("\nA. Extraction audit")
    print(f"  Finished assessments:        {metadata['finished_assessments']}")
    print(f"  Unique students:             {tests['student_id'].nunique() if not tests.empty else 0}")
    print(f"  Observed game types:         {', '.join(observed_games) if observed_games else 'none'}")
    print(f"  Item evidence rows:          {len(items)}")
    print(f"  Fuzzy axis rows:             {len(fuzzy)}")
    print(f"  Weak skills raw:             {raw_weak}")
    print(f"  Weak skills after filtering: {mistake_weak}")
    print(f"  Slow-only weak skills skipped: {metadata['skipped_slow_weak_count']}")

    print("\nB. Axis evidence")
    if axis_summary.empty:
        print("  No axis evidence available.")
    else:
        printable = axis_summary[["axis", "rows", "students", "accuracy", "slow_rate", "evidence_layer"]].copy()
        print(printable.to_string(index=False, formatters={"accuracy": "{:.3f}".format, "slow_rate": "{:.3f}".format}))
    if fuzzy_only_axes:
        print(f"  Fuzzy-only axes in this export: {', '.join(fuzzy_only_axes)}")
        if "visual_matching" in fuzzy_only_axes:
            print("  Note: visual_matching is fuzzy-only here; no tap_matching_pairs item logs were observed.")

    print("\nC. Mistake evidence")
    if mistake_summary.empty:
        print("  No mistake-focused weak skill events after slow-response filtering.")
    else:
        print(mistake_summary.head(10).to_string(index=False))

    print("\nD. Model status")
    print(f"  IRT-like/PFA-lite modeled axes: {', '.join(pfa_axis_results['axis']) if not pfa_axis_results.empty else 'none'}")
    if pfa_skipped:
        print("  IRT-like/PFA-lite skipped axes:")
        for axis, reason in pfa_skipped.items():
            print(f"    - {axis}: {reason}")

    print(f"  BKT modeled axes: {', '.join(bkt_axis_results['axis']) if not bkt_axis_results.empty else 'none'}")
    if bkt_skipped:
        print("  BKT skipped axes:")
        for axis, reason in bkt_skipped.items():
            print(f"    - {axis}: {reason}")

    if arm_rules.empty:
        print("  ARM: No stable co-occurrence rules emerged at the chosen thresholds in this pilot sample.")
    else:
        print(f"  ARM: {len(arm_rules)} mistake co-occurrence rules met the thresholds.")

    if spm_sequences.empty:
        print("  SPM: No recurring mistake trajectories emerged at the chosen threshold, likely due to limited pilot size and sparse repeated mistakes.")
    else:
        print(f"  SPM: {len(spm_sequences)} repeated mistake trajectories met the threshold.")

    print("\nE. Scientific caveats")
    print("  - Pilot sample size is small; the current finished assessment count is 21 in the provided export.")
    print("  - Sparse repeated mistakes limit ARM and SPM sensitivity.")
    print("  - visual_matching may be fuzzy-only if tap_matching_pairs logs are absent.")
    print("  - ARM/SPM null findings are not evidence that skills are independent or errors are random.")
    print("  - BKT trajectories are exploratory in this pilot sample and should not be interpreted as robust learning-rate estimates.")
    print("  - The ability model is IRT-like/PFA-lite, not full classic PFA with prior success/failure counts.")

    print(f"\nSaved corrected outputs to: {outdir}")


# ============================================================================
# SECTION 11: CLI ENTRYPOINT
# ============================================================================

def main() -> None:
    parser = argparse.ArgumentParser(description="Corrected DM-TaRL analytics pipeline.")
    parser.add_argument("--assessments", required=True, help="Path to Firebase assessments JSON export.")
    parser.add_argument("--outdir", default="outputs_corrected", help="Directory for corrected outputs.")
    args = parser.parse_args()

    assessments_path = Path(args.assessments)
    outdir = Path(args.outdir)

    print("=" * 80)
    print("DM-TaRL corrected analytics pipeline")
    print("=" * 80)
    print(f"Loading assessments from: {assessments_path}")

    with assessments_path.open("r", encoding="utf-8") as f:
        assessments = json.load(f)

    items, fuzzy, weak, tests, metadata = flatten_assessments(assessments)

    axis_summary = build_axis_summary(items, fuzzy)
    fuzzy_summary = build_fuzzy_axis_summary(fuzzy)
    mistake_summary = build_mistake_summary(weak)
    pfa_axis_results, pfa_skipped = run_irt_axis_models(items)
    bkt_axis_results, bkt_skipped, bkt_curves = run_bkt_axis_models(items)
    arm_rules = run_arm(weak)
    spm_sequences = run_spm(items)

    save_outputs(
        outdir,
        items,
        fuzzy,
        weak,
        tests,
        axis_summary,
        fuzzy_summary,
        mistake_summary,
        pfa_axis_results,
        bkt_axis_results,
        arm_rules,
        spm_sequences,
    )
    create_corrected_figure(
        outdir / "ANALYTICS_CORRECTED_RESULTS.png",
        axis_summary,
        fuzzy_summary,
        mistake_summary,
        bkt_axis_results,
        bkt_curves,
    )
    print_report(
        metadata,
        items,
        fuzzy,
        weak,
        tests,
        axis_summary,
        mistake_summary,
        pfa_axis_results,
        pfa_skipped,
        bkt_axis_results,
        bkt_skipped,
        arm_rules,
        spm_sequences,
        outdir,
    )


if __name__ == "__main__":
    main()
