#!/usr/bin/env python3
"""
Simple DM-TaRL Assessment Audit
Counts: total assessments, finished vs partial, total interactions
Handles nested structure: student_id -> test_id -> miniGames
"""

import json
import sys
from collections import defaultdict

def iter_sessions(test_id, test_data):
    """Yield (session_id, session_data) pairs for one test entry.

    Supports both:
      - legacy schema: test_data itself IS the session
        (finished/miniGames/... live directly on it)
      - new schema: test_data has an 'attempts' dict at
        assessments/{uid}/{testId}/attempts/{attemptId}/, where each
        attempt carries its own finished/miniGames/... fields

    session_id encodes the attempt for traceability ("testId::attemptId")
    without needing a separate column downstream.
    """
    attempts = test_data.get('attempts')
    if isinstance(attempts, dict) and attempts:
        for attempt_id, attempt_data in attempts.items():
            if not isinstance(attempt_data, dict):
                continue
            yield f"{test_id}::{attempt_id}", attempt_data
    else:
        yield test_id, test_data


def audit_assessments(json_file):
    """Audit assessment data."""
    
    print("=" * 80)
    print("DM-TaRL Assessment Audit")
    print("=" * 80)
    
    # Load data
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Counters
    total_assessments = 0
    finished_count = 0
    partial_count = 0
    total_interactions = 0
    legacy_schema_tests = 0
    new_schema_tests = 0
    
    students = set()
    game_types = defaultdict(int)
    games_per_assessment = defaultdict(int)  # Track how many games per assessment
    
    # Data is: student_id -> test_id -> assessment_data
    for student_id, tests in data.items():
        students.add(student_id)
        
        for test_id, test_data in tests.items():
            attempts = test_data.get('attempts')
            if isinstance(attempts, dict) and attempts:
                new_schema_tests += 1
            else:
                legacy_schema_tests += 1

            for session_id, session_data in iter_sessions(test_id, test_data):
                total_assessments += 1

                # Check if finished
                is_finished = session_data.get('finished', False)
                if is_finished:
                    finished_count += 1
                else:
                    partial_count += 1

                # Count interactions from miniGames
                mini_games = session_data.get('miniGames', {})
                games_in_assessment = 0

                for game_type, game_instances in mini_games.items():
                    if not isinstance(game_instances, list):
                        continue
                    for game_instance in game_instances:
                        if game_instance is None:
                            continue
                        games_in_assessment += 1
                        game_types[game_type] += 1

                        # Count questions/logs as interactions
                        logs = game_instance.get('logs', [])
                        interactions = len(logs)
                        total_interactions += interactions

                games_per_assessment[games_in_assessment] += 1
    
    # Report
    print(f"\nTotal Assessments (sessions):  {total_assessments}")
    print(f"  - Finished:          {finished_count}")
    print(f"  - Partial:           {partial_count}")
    print(f"\nSchema breakdown (per test, not per session):")
    print(f"  - Legacy (flat):     {legacy_schema_tests}")
    print(f"  - New (attempts):    {new_schema_tests}")
    print(f"\nTotal Interactions:    {total_interactions}")
    print(f"Unique Students:       {len(students)}")
    
    if total_assessments > 0:
        print(f"Avg interactions/assessment: {total_interactions / total_assessments:.1f}")
    
    print(f"\nGames per Assessment Distribution:")
    for num_games in sorted(games_per_assessment.keys()):
        count = games_per_assessment[num_games]
        print(f"  {num_games} games: {count} assessments")
    
    if game_types:
        print(f"\nGame Type Distribution (total across all assessments):")
        total_game_instances = sum(game_types.values())
        for game, count in sorted(game_types.items(), key=lambda x: x[1], reverse=True):
            pct = 100 * count / total_game_instances
            print(f"  {game:30s} {count:4d} ({pct:5.1f}%)")
    
    print("\n" + "=" * 80)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python count_assessments.py <path_to_assessments.json>")
        sys.exit(1)
    
    audit_assessments(sys.argv[1])