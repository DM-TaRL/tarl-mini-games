import json
import copy

def split_mixed_assessment(input_filepath, output_filepath):
    # Target IDs
    anouar_id = "stu_1780967877464_7804"
    ahmad_id = "stu_1780967494964_3113"
    test_id = "test_1781091763213_4cfhvjq"
    
    # Mini-games explicitly completed by Ahmad
    ahmad_game_types = ["order_numbers", "decompose_number", "write_number_in_letters"]

    # Load the raw assessment database
    with open(input_filepath, 'r', encoding='utf-8') as file:
        data = json.load(file)

    if anouar_id in data and test_id in data[anouar_id]:
        anouar_test_entry = data[anouar_id][test_id]
        anouar_mini_games = anouar_test_entry.get("miniGames", {})

        # Ensure Ahmad has a record structure in the root dictionary
        if ahmad_id not in data:
            data[ahmad_id] = {}

        # Initialize Ahmad's test session entry if it doesn't exist
        if test_id not in data[ahmad_id]:
            data[ahmad_id][test_id] = {
                "classId": anouar_test_entry.get("classId"),
                "schoolId": anouar_test_entry.get("schoolId"),
                "deviceInfo": anouar_test_entry.get("deviceInfo"),
                "startedAt": anouar_test_entry.get("startedAt"),
                "language": anouar_test_entry.get("language", "ar"),
                "session_status": "incomplete",
                "miniGames": {}
            }

        if "miniGames" not in data[ahmad_id][test_id]:
            data[ahmad_id][test_id]["miniGames"] = {}

        ahmad_mini_games = data[ahmad_id][test_id]["miniGames"]

        # Transfer designated logs from Anouar's array to Ahmad's array
        moved_games_count = 0
        for game_type in ahmad_game_types:
            if game_type in anouar_mini_games:
                ahmad_mini_games[game_type] = anouar_mini_games.pop(game_type)
                moved_games_count += 1

        print("✂️ Assessment session split completed successfully!")
        print(f" -> Transferred {moved_games_count} mini-games to Ahmad ({ahmad_id})")
        print(f" -> Retained remaining games (including choose_answer and identify_place_value) for Anouar ({anouar_id})")
        
    else:
        print(f"⚠️ Error: Target session {test_id} not found under Anouar's student ID.")

    # Save the updated database back to disk
    with open(output_filepath, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    # Point this to your main database payload file
    INPUT_FILE = 'cleaned_assessments_data.json'
    OUTPUT_FILE = 'cleaned_assessments_data_v2.json'
    
    split_mixed_assessment(INPUT_FILE, OUTPUT_FILE)