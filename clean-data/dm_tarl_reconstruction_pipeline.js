#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { detectWeakSkills } = require("../dist/utils/weak-skill-detector.js");
const {
  buildFuzzyInputsFromResults,
} = require("../dist/utils/features-aggregator.js");
const { inferFuzzyGrade } = require("../dist/utils/fuzzy-evaluator.js");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_ASSESSMENTS = path.join(
  ROOT,
  "clean-data",
  "cleaned_assessments_data_v2.json",
);
const DEFAULT_TEST_DEFINITIONS = path.join(
  ROOT,
  "clean-data",
  "dm-tarl-default-rtdb-test_definitions-export.json",
);
const DEFAULT_OUTDIR = path.join(ROOT, "outputs_reconstructed");

const AXES = [
  "arithmetic_fluency",
  "number_sense",
  "sequential_thinking",
  "comparison_skill",
  "visual_matching",
  "audio_recognition",
];

const SLOW_WEAKNESS_TYPES = new Set(["SlowResponse"]);
const SLOW_MISTAKE_TYPES = new Set(["SlowButCorrect"]);

function parseArgs(argv) {
  const args = {
    assessments: DEFAULT_ASSESSMENTS,
    testDefinitions: DEFAULT_TEST_DEFINITIONS,
    outdir: DEFAULT_OUTDIR,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--assessments" && next)
      ((args.assessments = path.resolve(next)), i++);
    else if (arg === "--test-definitions" && next)
      ((args.testDefinitions = path.resolve(next)), i++);
    else if (arg === "--outdir" && next)
      ((args.outdir = path.resolve(next)), i++);
    else if (arg === "--help") {
      console.log(
        "Usage: node clean-data/dm_tarl_reconstruction_pipeline.js [--assessments file] [--test-definitions file] [--outdir dir]",
      );
      process.exit(0);
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeJson(value) {
  if (value === undefined || value === null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return normalizeText(value);
  }
  return normalizeText(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value).replace(/â€“/g, "-").replace(/–/g, "-");
}

function csvEscape(value) {
  if (value === undefined || value === null) return "";
  const text = normalizeText(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows, columns) {
  const lines = [columns.join(",")];
  for (const row of rows)
    lines.push(columns.map((col) => csvEscape(row[col])).join(","));
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

function asAttempts(gameData) {
  if (Array.isArray(gameData)) return gameData.filter(Boolean);
  if (gameData && Array.isArray(gameData.attempts))
    return gameData.attempts.filter(Boolean);
  return [];
}

function normalizeMiniGames(rawMiniGames) {
  const normalized = {};
  for (const [gameType, gameData] of Object.entries(rawMiniGames || {})) {
    normalized[gameType] = asAttempts(gameData);
  }
  return normalized;
}

function countLogs(miniGames) {
  let count = 0;
  for (const attempts of Object.values(miniGames)) {
    for (const attempt of attempts) {
      if (Array.isArray(attempt && attempt.logs)) count += attempt.logs.length;
    }
  }
  return count;
}

function gameHasLogs(attempts) {
  return attempts.some(
    (attempt) =>
      Array.isArray(attempt && attempt.logs) && attempt.logs.length > 0,
  );
}

function latestTimestamp(values) {
  let latest = null;
  for (const value of values) {
    if (!value) continue;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) continue;
    if (!latest || ms > latest.ms) latest = { value, ms };
  }
  return latest;
}

function earliestTimestamp(values) {
  let earliest = null;
  for (const value of values) {
    if (!value) continue;
    const ms = typeof value === "number" ? value : Date.parse(value);
    if (!Number.isFinite(ms)) continue;
    if (!earliest || ms < earliest.ms) {
      earliest = {
        value:
          typeof value === "number" ? new Date(value).toISOString() : value,
        ms,
      };
    }
  }
  return earliest;
}

function getTestConfig(testId, testDefinitions) {
  const definition = testDefinitions[testId] || {};
  return Array.isArray(definition.miniGames)
    ? definition.miniGames
        .filter((entry) => entry && entry.gameType)
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    : [];
}

// A "session" is one completed/attempted run of a test: either the legacy
// assessment object itself (flat schema), or one entry under test.attempts
// (new schema: assessments/{uid}/{testId}/attempts/{attemptId}/). sessionId
// encodes the attempt ("testId::attemptId") so every row stays traceable back
// to its parent test without adding a new column to the CSV outputs.
function getSessionsForRecon(assessmentId, test) {
  const attempts = test.attempts;
  if (attempts && typeof attempts === "object" && !Array.isArray(attempts)) {
    return Object.entries(attempts)
      .filter(
        ([, sessionData]) => sessionData && typeof sessionData === "object",
      )
      .map(([attemptId, sessionData]) => ({
        sessionId: `${assessmentId}::${attemptId}`,
        sessionData,
      }));
  }
  return [{ sessionId: assessmentId, sessionData: test }];
}

function reconstructStatus(test, miniGames, testConfig) {
  const totalGames =
    testConfig.length ||
    Number(test.totalGames) ||
    Object.keys(miniGames).length;
  const finalGame = testConfig.length
    ? testConfig[testConfig.length - 1].gameType
    : "";
  const numGamesPassed = Number(test.numGamesPassed);
  const lastCompletedGame = test.lastCompletedGame || "";
  const hasLogs = Object.values(miniGames).some(gameHasLogs);

  if (test.finished === true) {
    return {
      assessment_status: "completed_original",
      completion_confidence: 1,
      completed_original_flag: 1,
      completed_reconstructed_flag: 0,
      completion_reason: "finished=true",
      total_games: totalGames,
      final_game: finalGame,
    };
  }
  if (
    Number.isFinite(numGamesPassed) &&
    totalGames > 0 &&
    numGamesPassed === totalGames
  ) {
    return {
      assessment_status: "completed_reconstructed",
      completion_confidence: 0.95,
      completed_original_flag: 0,
      completed_reconstructed_flag: 1,
      completion_reason: "numGamesPassed equals configured mini-game count",
      total_games: totalGames,
      final_game: finalGame,
    };
  }
  if (lastCompletedGame && finalGame && lastCompletedGame === finalGame) {
    return {
      assessment_status: "completed_reconstructed",
      completion_confidence: 0.9,
      completed_original_flag: 0,
      completed_reconstructed_flag: 1,
      completion_reason: "lastCompletedGame equals final configured mini-game",
      total_games: totalGames,
      final_game: finalGame,
    };
  }
  if (hasLogs) {
    return {
      assessment_status: "partial",
      completion_confidence: 0.5,
      completed_original_flag: 0,
      completed_reconstructed_flag: 0,
      completion_reason:
        "interaction logs exist but completion criteria not met",
      total_games: totalGames,
      final_game: finalGame,
    };
  }
  return {
    assessment_status: "empty",
    completion_confidence: 0,
    completed_original_flag: 0,
    completed_reconstructed_flag: 0,
    completion_reason: "no interaction logs and no completion evidence",
    total_games: totalGames,
    final_game: finalGame,
  };
}

function completionTimes(test, miniGames, status) {
  const started = earliestTimestamp([
    test.startedAt,
    test.createdAt,
    ...Object.values(miniGames).flatMap((attempts) =>
      attempts.map((attempt) => attempt && attempt.startedAt),
    ),
  ]);
  const latestFinished = latestTimestamp([
    ...Object.values(miniGames).flatMap((attempts) =>
      attempts.map((attempt) => attempt && attempt.finishedAt),
    ),
  ]);
  const originalFinished = latestTimestamp([test.finishedAt]);
  const useReconstructed =
    status.assessment_status === "completed_reconstructed";
  const estimatedFinished =
    useReconstructed && latestFinished
      ? latestFinished
      : originalFinished || latestFinished;
  return {
    started_at: started ? started.value : "",
    estimated_finished_at: estimatedFinished ? estimatedFinished.value : "",
    estimated_finished_at_is_reconstructed:
      useReconstructed && latestFinished ? 1 : 0,
    estimated_duration_ms:
      started && estimatedFinished
        ? Math.max(0, estimatedFinished.ms - started.ms)
        : "",
    estimated_duration_ms_is_reconstructed:
      useReconstructed && latestFinished ? 1 : 0,
  };
}

function weakSkillRow(studentId, assessmentId, status, weakSkill) {
  const mistakeType = weakSkill.mistakeType || "";
  const weaknessType = weakSkill.weaknessType || "";
  return {
    student_id: studentId,
    assessment_id: assessmentId,
    assessment_status: status,
    weakness_type: weaknessType,
    mistake_type: mistakeType,
    skill:
      weakSkill.skillSubtype ||
      weakSkill.questionType ||
      weakSkill.operation ||
      weakSkill.comparisonType ||
      weakSkill.orderDirection ||
      "",
    game_type: weakSkill.gameType || "",
    supporting_item_count: weakSkill.count || 1,
    operation: weakSkill.operation || "",
    skill_subtype: weakSkill.skillSubtype || "",
    question_type: weakSkill.questionType || "",
    format: weakSkill.format || "",
    num_digits: weakSkill.numDigits || "",
    complexity_level: weakSkill.complexityLevel || "",
    difficulty_zone: weakSkill.difficultyZone || "",
    examples: safeJson(weakSkill.examples),
    expected: safeJson(weakSkill.expected),
    given: safeJson(weakSkill.given),
    operations_expected: safeJson(weakSkill.operationsExpected),
    operations_used: safeJson(weakSkill.operationsUsed),
  };
}

function shouldKeepWeakSkill(weakSkill) {
  return (
    !SLOW_WEAKNESS_TYPES.has(weakSkill.weaknessType || "") &&
    !SLOW_MISTAKE_TYPES.has(weakSkill.mistakeType || "")
  );
}

function fuzzyStateLabel(masteryScore) {
  if (!Number.isFinite(masteryScore)) return "";
  if (masteryScore < 2.5) return "emerging";
  if (masteryScore < 4.5) return "developing";
  return "proficient";
}

function buildFuzzyProfile(miniGames, testConfig, assessmentStatus) {
  const fuzzyStatus =
    assessmentStatus === "completed_original" ||
    assessmentStatus === "completed_reconstructed"
      ? "full_assessment"
      : assessmentStatus === "partial"
        ? "partial_assessment"
        : "";
  if (!fuzzyStatus || countLogs(miniGames) === 0) return null;

  const includedGameTypes = testConfig.length
    ? testConfig.map((entry) => entry.gameType)
    : Object.keys(miniGames);
  const fuzzyInputs = buildFuzzyInputsFromResults(
    miniGames,
    includedGameTypes,
    {},
  );
  const inferred = inferFuzzyGrade(
    fuzzyInputs.axes,
    fuzzyInputs.coverage,
    testConfig,
    true,
  );
  const evidenceCount = countLogs(miniGames);
  return {
    fuzzy_status: fuzzyStatus,
    mastery_score: inferred.inferredGrade,
    fuzzy_state: fuzzyStateLabel(inferred.inferredGrade),
    evidence_count: evidenceCount,
    fuzzy_confidence: inferred.confidence,
    axes: fuzzyInputs.axes,
    coverage: fuzzyInputs.coverage,
    memberships: inferred.memberships,
    rule_fires: inferred.ruleFiring,
  };
}

function maxAssessmentDepthByStudent(assessmentRows) {
  const byStudent = new Map();
  for (const row of assessmentRows) {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, []);
    byStudent.get(row.student_id).push(row);
  }
  const repeatedRows = [];
  let maxDepth = 0;
  for (const [studentId, rows] of byStudent.entries()) {
    const depth = rows.length;
    maxDepth = Math.max(maxDepth, depth);
    if (depth > 1) {
      repeatedRows.push({
        student_id: studentId,
        assessment_depth: depth,
        assessment_path: Array.from({ length: depth }, (_, idx) =>
          String.fromCharCode("A".charCodeAt(0) + idx),
        ).join("->"),
        assessment_ids: rows
          .slice()
          .sort((a, b) =>
            String(a.started_at).localeCompare(String(b.started_at)),
          )
          .map((row) => row.assessment_id)
          .join("|"),
      });
    }
  }
  return { repeatedRows, maxDepth };
}

function run() {
  const args = parseArgs(process.argv);
  const assessments = readJson(args.assessments);
  const testDefinitions = readJson(args.testDefinitions);
  fs.mkdirSync(args.outdir, { recursive: true });

  const assessmentRows = [];
  const summaryRows = [];
  const weakRows = [];
  const fuzzyProfileRows = [];
  const fuzzyAxisRows = [];

  for (const [studentId, tests] of Object.entries(assessments || {})) {
    if (
      !tests ||
      typeof tests !== "object" ||
      String(studentId).startsWith("_")
    )
      continue;
    for (const [assessmentId, test] of Object.entries(tests)) {
      if (!test || typeof test !== "object") continue;

      // Test config is per-test, looked up once and reused across all
      // sessions (attempts) found under this test.
      const testConfig = getTestConfig(assessmentId, testDefinitions);
      const sessions = getSessionsForRecon(assessmentId, test);

      for (const { sessionId, sessionData } of sessions) {
        const miniGames = normalizeMiniGames(sessionData.miniGames);
        const status = reconstructStatus(sessionData, miniGames, testConfig);
        const times = completionTimes(sessionData, miniGames, status);
        const itemInteractions = countLogs(miniGames);
        const fuzzyProfile = buildFuzzyProfile(
          miniGames,
          testConfig,
          status.assessment_status,
        );

        let weakSkillEvents = [];
        if (itemInteractions > 0) {
          weakSkillEvents =
            detectWeakSkills(miniGames).filter(shouldKeepWeakSkill);
          for (const weakSkill of weakSkillEvents) {
            weakRows.push(
              weakSkillRow(
                studentId,
                sessionId,
                status.assessment_status,
                weakSkill,
              ),
            );
          }
        }

        if (fuzzyProfile) {
          fuzzyProfileRows.push({
            student_id: studentId,
            assessment_id: sessionId,
            assessment_status: status.assessment_status,
            fuzzy_status: fuzzyProfile.fuzzy_status,
            mastery_score: fuzzyProfile.mastery_score,
            fuzzy_state: fuzzyProfile.fuzzy_state,
            evidence_count: fuzzyProfile.evidence_count,
            fuzzy_confidence: fuzzyProfile.fuzzy_confidence,
            rule_fires: safeJson(fuzzyProfile.rule_fires),
          });
          for (const axis of AXES) {
            const membership =
              (fuzzyProfile.memberships && fuzzyProfile.memberships[axis]) ||
              {};
            fuzzyAxisRows.push({
              student_id: studentId,
              assessment_id: sessionId,
              assessment_status: status.assessment_status,
              fuzzy_status: fuzzyProfile.fuzzy_status,
              axis,
              mastery_score: fuzzyProfile.mastery_score,
              fuzzy_state: fuzzyProfile.fuzzy_state,
              evidence_count: fuzzyProfile.evidence_count,
              fuzzy_score: fuzzyProfile.axes[axis],
              fuzzy_coverage: fuzzyProfile.coverage[axis],
              membership_low: membership.low,
              membership_medium: membership.medium,
              membership_high: membership.high,
            });
          }
        }

        const baseAssessment = {
          student_id: studentId,
          assessment_id: sessionId,
          assessment_status: status.assessment_status,
          completion_confidence: status.completion_confidence,
          completed_original_flag: status.completed_original_flag,
          completed_reconstructed_flag: status.completed_reconstructed_flag,
          completion_reason: status.completion_reason,
          num_games_passed: sessionData.numGamesPassed ?? "",
          total_games: status.total_games,
          final_game: status.final_game,
          last_completed_game: sessionData.lastCompletedGame || "",
          item_interactions: itemInteractions,
          weak_skill_count: weakSkillEvents.length,
          fuzzy_status: fuzzyProfile ? fuzzyProfile.fuzzy_status : "",
          mastery_score: fuzzyProfile ? fuzzyProfile.mastery_score : "",
          fuzzy_state: fuzzyProfile ? fuzzyProfile.fuzzy_state : "",
          evidence_count: fuzzyProfile ? fuzzyProfile.evidence_count : "",
          ...times,
        };
        assessmentRows.push(baseAssessment);
        summaryRows.push(baseAssessment);
      }
    }
  }

  const statusCounts = assessmentRows.reduce((acc, row) => {
    acc[row.assessment_status] = (acc[row.assessment_status] || 0) + 1;
    return acc;
  }, {});
  const { repeatedRows, maxDepth } =
    maxAssessmentDepthByStudent(assessmentRows);
  const fullAssessmentCount = assessmentRows.filter((row) =>
    ["completed_original", "completed_reconstructed"].includes(
      row.assessment_status,
    ),
  ).length;
  const itemLevelAssessmentCount = assessmentRows.filter((row) =>
    ["completed_original", "completed_reconstructed", "partial"].includes(
      row.assessment_status,
    ),
  ).length;

  const auditRows = [
    { metric: "total_assessments", value: assessmentRows.length },
    {
      metric: "completed_original",
      value: statusCounts.completed_original || 0,
    },
    {
      metric: "completed_reconstructed",
      value: statusCounts.completed_reconstructed || 0,
    },
    { metric: "partial", value: statusCounts.partial || 0 },
    { metric: "empty", value: statusCounts.empty || 0 },
    {
      metric: "total_item_interactions",
      value: assessmentRows.reduce(
        (sum, row) => sum + Number(row.item_interactions || 0),
        0,
      ),
    },
    { metric: "total_weak_skill_events", value: weakRows.length },
    { metric: "total_fuzzy_profiles", value: fuzzyProfileRows.length },
    {
      metric: "students_with_repeated_assessments",
      value: repeatedRows.length,
    },
    { metric: "maximum_assessment_depth_per_student", value: maxDepth },
    {
      metric: "assessment_level_analysis_assessments",
      value: fullAssessmentCount,
    },
    {
      metric: "item_level_analysis_assessments",
      value: itemLevelAssessmentCount,
    },
  ];

  writeCsv(
    path.join(args.outdir, "assessment_reconstruction.csv"),
    assessmentRows,
    [
      "student_id",
      "assessment_id",
      "assessment_status",
      "completion_confidence",
      "completed_original_flag",
      "completed_reconstructed_flag",
      "completion_reason",
      "num_games_passed",
      "total_games",
      "final_game",
      "last_completed_game",
      "item_interactions",
      "weak_skill_count",
      "fuzzy_status",
      "mastery_score",
      "fuzzy_state",
      "evidence_count",
      "started_at",
      "estimated_finished_at",
      "estimated_finished_at_is_reconstructed",
      "estimated_duration_ms",
      "estimated_duration_ms_is_reconstructed",
    ],
  );
  writeCsv(path.join(args.outdir, "assessment_summary.csv"), summaryRows, [
    "student_id",
    "assessment_id",
    "assessment_status",
    "completion_reason",
    "num_games_passed",
    "total_games",
    "last_completed_game",
    "item_interactions",
    "weak_skill_count",
    "fuzzy_status",
    "mastery_score",
    "started_at",
    "estimated_finished_at",
  ]);
  writeCsv(path.join(args.outdir, "weak_skill_events.csv"), weakRows, [
    "student_id",
    "assessment_id",
    "assessment_status",
    "weakness_type",
    "mistake_type",
    "skill",
    "game_type",
    "supporting_item_count",
    "operation",
    "skill_subtype",
    "question_type",
    "format",
    "num_digits",
    "complexity_level",
    "difficulty_zone",
    "examples",
    "expected",
    "given",
    "operations_expected",
    "operations_used",
  ]);
  writeCsv(path.join(args.outdir, "fuzzy_profiles.csv"), fuzzyProfileRows, [
    "student_id",
    "assessment_id",
    "assessment_status",
    "fuzzy_status",
    "mastery_score",
    "fuzzy_state",
    "evidence_count",
    "fuzzy_confidence",
    "rule_fires",
  ]);
  writeCsv(path.join(args.outdir, "fuzzy_axis_state.csv"), fuzzyAxisRows, [
    "student_id",
    "assessment_id",
    "assessment_status",
    "fuzzy_status",
    "axis",
    "mastery_score",
    "fuzzy_state",
    "evidence_count",
    "fuzzy_score",
    "fuzzy_coverage",
    "membership_low",
    "membership_medium",
    "membership_high",
  ]);
  writeCsv(path.join(args.outdir, "repeated_assessments.csv"), repeatedRows, [
    "student_id",
    "assessment_depth",
    "assessment_path",
    "assessment_ids",
  ]);
  writeCsv(
    path.join(args.outdir, "reconstruction_audit_report.csv"),
    auditRows,
    ["metric", "value"],
  );

  const markdown = [
    "# DM-TARL reconstruction audit",
    "",
    `Input assessments: ${args.assessments}`,
    `Test definitions: ${args.testDefinitions}`,
    "",
    "| Metric | Value |",
    "|---|---:|",
    ...auditRows.map((row) => `| ${row.metric} | ${row.value} |`),
    "",
    "## Analytics inclusion policy",
    "",
    "- Assessment-level analyses: completed_original + completed_reconstructed.",
    "- Item-level, weak-skill, template, and interaction analyses: completed_original + completed_reconstructed + partial.",
    "- Empty assessments are retained in reconstruction tables for auditability but excluded from evidence-driven analytics.",
    "- SlowResponse and SlowButCorrect are excluded from mistake-focused weak-skill events.",
    "",
  ].join("\n");
  fs.writeFileSync(
    path.join(args.outdir, "reconstruction_audit_report.md"),
    markdown,
    "utf8",
  );

  console.log("DM-TARL reconstruction pipeline complete.");
  for (const row of auditRows) console.log(`${row.metric}: ${row.value}`);
  console.log(`Outputs written to: ${args.outdir}`);
}

run();
