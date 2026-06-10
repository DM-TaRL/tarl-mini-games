import json

def clean_assessment_data(input_filepath, output_filepath):
    # List of student IDs used for testing that should be completely removed
    test_student_ids = {
        "stu_1770774269822_9740",
        "stu_1781048279747_6522",
        "stu_1781051082481_6727"
    }

    # Load the raw JSON data
    with open(input_filepath, 'r', encoding='utf-8') as file:
        raw_data = json.load(file)

    cleaned_data = {}
    total_raw_tests = 0
    total_kept_tests = 0
    total_testing_sessions_removed = 0

    # Iterate through each student and their tests
    for student_id, tests in raw_data.items():
        # Condition 0: Exclude the developer's test accounts
        if student_id in test_student_ids:
            total_testing_sessions_removed += len(tests)
            continue
            
        cleaned_tests = {}
        
        for test_id, test_data in tests.items():
            total_raw_tests += 1
            
            # Condition 1: The test successfully completed
            is_finished = test_data.get('finished', False)
            
            # Condition 2: The test is incomplete, but has valid mini-game logs
            has_started = False
            mini_games = test_data.get('miniGames', {})
            
            if isinstance(mini_games, dict):
                # Check if any of the game arrays actually contain logs
                for game_name, game_logs in mini_games.items():
                    # UPDATED: Check for both list and dict to handle Firebase sparse array quirks
                    if isinstance(game_logs, (list, dict)) and len(game_logs) > 0:
                        has_started = True
                        break
            
            # Keep the test if it passes either condition
            if is_finished or has_started:
                cleaned_tests[test_id] = test_data
                total_kept_tests += 1

        # Only add the student to the final output if they have at least one valid test
        if cleaned_tests:
            cleaned_data[student_id] = cleaned_tests

    # Save the cleaned data to the new file
    with open(output_filepath, 'w', encoding='utf-8') as file:
        json.dump(cleaned_data, file, indent=2, ensure_ascii=False)

    # Print a quick summary of the cleaning process
    print("🧹 Data cleaning complete!")
    print(f"Total developer test sessions removed: {total_testing_sessions_removed}")
    print(f"Total raw student test sessions evaluated: {total_raw_tests}")
    print(f"Total valid student test sessions kept: {total_kept_tests}")
    print(f"Total empty/unstarted student sessions removed: {total_raw_tests - total_kept_tests}")
    print(f"Cleaned data saved to -> {output_filepath}")

# --- Execution ---
if __name__ == "__main__":
    # Replace these filenames with your actual local file paths
    INPUT_FILE = 'dm-tarl-default-rtdb-assessments-export.json'
    OUTPUT_FILE = 'cleaned_assessments_data.json'
    
    clean_assessment_data(INPUT_FILE, OUTPUT_FILE)