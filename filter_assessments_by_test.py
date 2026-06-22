import json
import sys
from pathlib import Path

INPUT_FILE = "dm-tarl-default-rtdb-assessments-export-to-analyze.json"


def main():
    if len(sys.argv) < 2:
        print("Usage: python filter_assessments_by_test.py <testId>")
        sys.exit(1)

    target_test_id = sys.argv[1]

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    filtered = {}
    for student_id, assessments in data.items():
        matching = {
            key: assessment
            for key, assessment in assessments.items()
            if isinstance(assessment, dict)
            and assessment.get("testId") == target_test_id
            and assessment.get("miniGames")
        }
        if matching:
            filtered[student_id] = matching

    output_dir = Path("filtered_assessments_by_test")
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / (Path(INPUT_FILE).stem + f"__{target_test_id}.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(filtered, f, indent=2, ensure_ascii=False)

    total = sum(len(v) for v in filtered.values())
    print(f"Filtered {total} assessment(s) across {len(filtered)} student(s) -> {output_file}")


if __name__ == "__main__":
    main()
