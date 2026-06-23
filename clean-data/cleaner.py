import json

def attempt_is_valid(session_data):
    """Check whether a single session (legacy test, or one attempt under the
    new attempts/{attemptId} schema) is worth keeping: either it was
    completed, or it has at least one mini-game with real logs.
    Same two conditions as before - just extracted so they can be applied
    per-attempt as well as per-test.
    """
    is_finished = session_data.get('finished', False)

    has_started = False
    mini_games = session_data.get('miniGames', {})
    if isinstance(mini_games, dict):
        for game_name, game_logs in mini_games.items():
            # Handles both list and dict to cover Firebase sparse array quirks
            if isinstance(game_logs, (list, dict)) and len(game_logs) > 0:
                has_started = True
                break

    return is_finished or has_started


def clean_assessment_data(input_filepath, output_filepath):
    # List of student IDs used for testing that should be completely removed
    test_student_ids = {
        "stu_1770774269822_9740",
        "stu_1781048279747_6522",
        "stu_1781051082481_6727",
        "stu_1782122949454_1084",
        "stu_1782118307624_1419"
    }

    # Load the raw JSON data
    with open(input_filepath, 'r', encoding='utf-8') as file:
        raw_data = json.load(file)

    cleaned_data = {}
    total_raw_tests = 0
    total_kept_tests = 0
    total_testing_sessions_removed = 0
    legacy_schema_tests = 0
    new_schema_tests = 0
    total_attempts_evaluated = 0
    total_attempts_kept = 0

    # Iterate through each student and their tests
    for student_id, tests in raw_data.items():
        # Condition 0: Exclude the developer's test accounts
        if student_id in test_student_ids:
            total_testing_sessions_removed += len(tests)
            continue
            
        cleaned_tests = {}
        
        for test_id, test_data in tests.items():
            total_raw_tests += 1

            attempts = test_data.get('attempts')
            if isinstance(attempts, dict) and attempts:
                # New schema: assessments/{uid}/{testId}/attempts/{attemptId}/.
                # Each attempt carries its own finished/miniGames, so filter
                # at that granularity instead of the test as a whole -
                # otherwise one weak attempt would wrongly drop every good
                # attempt sitting next to it under the same test.
                new_schema_tests += 1
                kept_attempts = {}
                for attempt_id, attempt_data in attempts.items():
                    if not isinstance(attempt_data, dict):
                        continue
                    total_attempts_evaluated += 1
                    if attempt_is_valid(attempt_data):
                        kept_attempts[attempt_id] = attempt_data
                        total_attempts_kept += 1

                if kept_attempts:
                    # Keep the test with its other metadata (classId,
                    # createdAt, ...) untouched, only attempts is filtered.
                    repaired_test = dict(test_data)
                    repaired_test['attempts'] = kept_attempts
                    cleaned_tests[test_id] = repaired_test
                    total_kept_tests += 1
            else:
                # Legacy schema: the test itself is the session.
                legacy_schema_tests += 1
                total_attempts_evaluated += 1
                if attempt_is_valid(test_data):
                    cleaned_tests[test_id] = test_data
                    total_kept_tests += 1
                    total_attempts_kept += 1

        # Only add the student to the final output if they have at least one valid test
        if cleaned_tests:
            cleaned_data[student_id] = cleaned_tests

    # Save the cleaned data to the new file
    with open(output_filepath, 'w', encoding='utf-8') as file:
        json.dump(cleaned_data, file, indent=2, ensure_ascii=False)

    # Print a quick summary of the cleaning process
    print("🧹 Data cleaning complete!")
    print(f"Total developer test sessions removed: {total_testing_sessions_removed}")
    print(f"Total raw student test entries evaluated: {total_raw_tests}")
    print(f"  - Legacy schema (flat):      {legacy_schema_tests}")
    print(f"  - New schema (attempts):     {new_schema_tests}")
    print(f"Total valid student test entries kept: {total_kept_tests}")
    print(f"Total individual sessions (attempts) evaluated: {total_attempts_evaluated}")
    print(f"Total individual sessions (attempts) kept:      {total_attempts_kept}")
    print(f"Total empty/unstarted sessions removed: {total_attempts_evaluated - total_attempts_kept}")
    print(f"Cleaned data saved to -> {output_filepath}")

# --- Execution ---
if __name__ == "__main__":
    # Replace these filenames with your actual local file paths
    INPUT_FILE = 'dm-tarl-default-rtdb-assessments-export.json'
    OUTPUT_FILE = 'cleaned_assessments_data.json'
    
    clean_assessment_data(INPUT_FILE, OUTPUT_FILE)