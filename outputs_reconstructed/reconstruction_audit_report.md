# DM-TARL reconstruction audit

Input assessments: C:\Users\najlae\OneDrive\Desktop\Folders\Me\PHD\dev\tarl-mini-games\clean-data\cleaned_assessments_data_v2.json
Test definitions: C:\Users\najlae\OneDrive\Desktop\Folders\Me\PHD\dev\tarl-mini-games\clean-data\dm-tarl-default-rtdb-test_definitions-export.json

| Metric | Value |
|---|---:|
| total_assessments | 49 |
| completed_original | 45 |
| completed_reconstructed | 1 |
| partial | 3 |
| empty | 0 |
| total_item_interactions | 1363 |
| total_weak_skill_events | 277 |
| total_fuzzy_profiles | 49 |
| students_with_repeated_assessments | 9 |
| maximum_assessment_depth_per_student | 6 |
| assessment_level_analysis_assessments | 46 |
| item_level_analysis_assessments | 49 |

## Analytics inclusion policy

- Assessment-level analyses: completed_original + completed_reconstructed.
- Item-level, weak-skill, template, and interaction analyses: completed_original + completed_reconstructed + partial.
- Empty assessments are retained in reconstruction tables for auditability but excluded from evidence-driven analytics.
- SlowResponse and SlowButCorrect are excluded from mistake-focused weak-skill events.
