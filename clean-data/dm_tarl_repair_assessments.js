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
const DEFAULT_INPUT = path.join(
  ROOT,
  "clean-data",
  "cleaned_assessments_data_v2.json",
);
const DEFAULT_TEST_DEFINITIONS = path.join(
  ROOT,
  "clean-data",
  "dm-tarl-default-rtdb-test_definitions-export.json",
);
const DEFAULT_OUTPUT = path.join(
  ROOT,
  "clean-data",
  "cleaned_assessments_data_v3.json",
);
const DEFAULT_AUDIT = path.join(
  ROOT,
  "clean-data",
  "reconstruction_audit.json",
);

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    testDefinitions: DEFAULT_TEST_DEFINITIONS,
    output: DEFAULT_OUTPUT,
    audit: DEFAULT_AUDIT,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--input" && next) {
      args.input = path.resolve(next);
      i++;
    } else if (arg === "--test-definitions" && next) {
      args.testDefinitions = path.resolve(next);
      i++;
    } else if (arg === "--output" && next) {
      args.output = path.resolve(next);
      i++;
    } else if (arg === "--audit" && next) {
      args.audit = path.resolve(next);
      i++;
    } else if (arg === "--help") {
      console.log(
        "Usage: node clean-data/dm_tarl_repair_assessments.js [--input file] [--test-definitions file] [--output file] [--audit file]",
      );
      process.exit(0);
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asAttempts(gameData) {
  if (Array.isArray(gameData)) return gameData.filter(Boolean);
  if (gameData && Array.isArray(gameData.attempts)) {
    return gameData.attempts.filter(Boolean);
  }
  return [];
}

function normalizeMiniGames(rawMiniGames) {
  const normalized = {};
  for (const [gameType, gameData] of Object.entries(rawMiniGames || {})) {
    normalized[gameType] = asAttempts(gameData);
  }
  return normalized;
}

function getTestDefinition(assessmentId, assessment, testDefinitions) {
  const testId = assessment.testId || assessmentId;
  return testDefinitions[testId] || null;
}

function getConfiguredMiniGames(testDefinition) {
  if (!testDefinition || !Array.isArray(testDefinition.miniGames)) return [];
  return testDefinition.miniGames
    .filter((entry) => entry && entry.gameType)
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function hasNonEmptyLogs(miniGames, gameType) {
  return (miniGames[gameType] || []).some(
    (attempt) =>
      Array.isArray(attempt && attempt.logs) && attempt.logs.length > 0,
  );
}

function hasAnyLogs(miniGames) {
  return Object.keys(miniGames).some((gameType) =>
    hasNonEmptyLogs(miniGames, gameType),
  );
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

function allConfiguredGamesHaveLogs(miniGames, configuredMiniGames) {
  return (
    configuredMiniGames.length > 0 &&
    configuredMiniGames.every((entry) =>
      hasNonEmptyLogs(miniGames, entry.gameType),
    )
  );
}

function isAlreadyCompleted(assessment) {
  return (
    assessment.finished === true || assessment.session_status === "complete"
  );
}

// Known platform bug (test_1782070942512_t2m2dhm and similar): the runtime
// sometimes flags a session finished/complete right after the FIRST
// configured mini-game, even though the student never advanced further -
// they were stuck, not done. A session claiming completion with real
// evidence covering at most one configured game (out of several) matches
// this exact failure signature, so the flag can't be trusted as-is.
function isSuspiciousFalseCompletion(session, miniGames, configuredMiniGames) {
  if (configuredMiniGames.length <= 1) return false;
  const claimsFinished =
    session.finished === true || session.session_status === "complete";
  if (!claimsFinished) return false;

  const gamesWithLogs = configuredMiniGames.filter((entry) =>
    hasNonEmptyLogs(miniGames, entry.gameType),
  ).length;
  return gamesWithLogs <= 1;
}

function shouldRepairAsCompleted(assessment, miniGames, configuredMiniGames) {
  const expectedGames = configuredMiniGames.length;
  const lastConfiguredGame = expectedGames
    ? configuredMiniGames[expectedGames - 1].gameType
    : "";
  const gamesPassed = Number(
    assessment.numberGamesPassed ?? assessment.numGamesPassed,
  );

  const indicatorA =
    expectedGames > 0 &&
    Number.isFinite(gamesPassed) &&
    gamesPassed === expectedGames;
  const indicatorB =
    Boolean(assessment.lastCompletedGame) &&
    Boolean(lastConfiguredGame) &&
    assessment.lastCompletedGame === lastConfiguredGame;
  const indicatorC = allConfiguredGamesHaveLogs(miniGames, configuredMiniGames);

  return indicatorA || indicatorB || indicatorC;
}

function parseTimestamp(value) {
  if (value === undefined || value === null || value === "") return null;
  const ms = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return {
    ms,
    value: typeof value === "number" ? new Date(ms).toISOString() : value,
  };
}

function latestTimestamp(candidates) {
  let latest = null;
  for (const candidate of candidates) {
    const parsed = parseTimestamp(candidate);
    if (!parsed) continue;
    if (!latest || parsed.ms > latest.ms) latest = parsed;
  }
  return latest ? latest.value : "";
}

function detectFinishedAt(miniGames) {
  const candidates = [];
  const logTimestampKeys = [
    "timestamp",
    "createdAt",
    "updatedAt",
    "finishedAt",
    "answeredAt",
    "submittedAt",
    "time",
  ];

  for (const [gameType, attempts] of Object.entries(miniGames)) {
    const originalGameData = attempts;
    if (originalGameData && originalGameData.finishedAt) {
      candidates.push(originalGameData.finishedAt);
    }

    for (const attempt of attempts) {
      if (!attempt || typeof attempt !== "object") continue;
      candidates.push(attempt.finishedAt);
      if (!Array.isArray(attempt.logs)) continue;
      for (const log of attempt.logs) {
        if (!log || typeof log !== "object") continue;
        for (const key of logTimestampKeys) candidates.push(log[key]);
      }
    }
  }

  return latestTimestamp(candidates);
}

function runWeakSkillDetector(assessment, miniGames) {
  if (!hasAnyLogs(miniGames)) return;
  assessment.weakSkills = detectWeakSkills(miniGames);
}

function runFuzzyEngine(assessment, miniGames, configuredMiniGames) {
  if (!hasAnyLogs(miniGames)) return;

  const includedGameTypes = configuredMiniGames.length
    ? configuredMiniGames.map((entry) => entry.gameType)
    : Object.keys(miniGames);
  const fuzzyInputs = buildFuzzyInputsFromResults(
    miniGames,
    includedGameTypes,
    {},
  );
  const fuzzyResult = inferFuzzyGrade(
    fuzzyInputs.axes,
    fuzzyInputs.coverage,
    configuredMiniGames,
    true,
  );

  assessment.fuzzyInputs = fuzzyInputs.axes;
  assessment.fuzzyCoverage = fuzzyInputs.coverage;
  assessment.fuzzyMemberships = fuzzyResult.memberships;
  assessment.fuzzyRuleFires = fuzzyResult.ruleFiring;
  assessment.fuzzyConfidence = fuzzyResult.confidence;
  assessment.evaluatedGrade = fuzzyResult.inferredGrade;
}

// A "session" is one completed/attempted run of a test: either the legacy
// assessment object itself (flat schema), or one entry under assessment.attempts
// (new schema: assessments/{uid}/{testId}/attempts/{attemptId}/). Both shapes
// carry the same fields (finished, miniGames, evaluatedGrade, ...), so the same
// repair logic applies to either - we just need to find the right objects to mutate.
function getSessionsForRepair(assessment) {
  const attempts = assessment.attempts;
  if (attempts && typeof attempts === "object" && !Array.isArray(attempts)) {
    return Object.values(attempts).filter(
      (session) => session && typeof session === "object",
    );
  }
  return [assessment];
}

function repairSession(session, configuredMiniGames, audit) {
  audit.totalAssessments++;

  const miniGames = normalizeMiniGames(session.miniGames);

  if (isSuspiciousFalseCompletion(session, miniGames, configuredMiniGames)) {
    // Preserve the original raw signal for traceability (useful for the
    // platform-bug writeup), then correct it so downstream consumers -
    // fuzzy engine, dashboard, this same script - don't treat a stuck
    // session as a genuine full assessment.
    session.originalFinishedValue = session.finished;
    session.originalSessionStatus = session.session_status;
    session.finished = false;
    session.session_status = "incomplete";
    session.finishedFlagOverrideReason =
      "Claimed finished/complete but evidence covers at most 1 of " +
      configuredMiniGames.length +
      " configured mini-games - matches known technical failure (session stuck after the first mini-game, never advanced).";
    audit.falseCompletionsOverridden++;
  }

  if (isAlreadyCompleted(session)) {
    audit.alreadyCompleted++;
  } else if (shouldRepairAsCompleted(session, miniGames, configuredMiniGames)) {
    session.finished = true;
    session.session_status = "complete";
    if (!session.finishedAt) {
      const reconstructedFinishedAt = detectFinishedAt(miniGames);
      if (reconstructedFinishedAt) session.finishedAt = reconstructedFinishedAt;
    }
    audit.reconstructedCompleted++;
  } else {
    audit.partialRemaining++;
  }

  runWeakSkillDetector(session, miniGames);
  runFuzzyEngine(session, miniGames, configuredMiniGames);

  if (session.finished === true && !session.finishedAt) {
    const reconstructedFinishedAt = detectFinishedAt(miniGames);
    if (reconstructedFinishedAt) session.finishedAt = reconstructedFinishedAt;
  }
}

function repairAssessments(data, testDefinitions) {
  const audit = {
    totalAssessments: 0,
    alreadyCompleted: 0,
    reconstructedCompleted: 0,
    partialRemaining: 0,
    legacySchemaTests: 0,
    newSchemaTests: 0,
    falseCompletionsOverridden: 0,
  };

  for (const [studentId, assessments] of Object.entries(data || {})) {
    if (
      !assessments ||
      typeof assessments !== "object" ||
      String(studentId).startsWith("_")
    ) {
      continue;
    }

    for (const [assessmentId, assessment] of Object.entries(assessments)) {
      if (!assessment || typeof assessment !== "object") continue;

      // Test definition/config is per-test, not per-attempt, so it's looked up
      // once here and reused for every session (attempt) found below.
      const testDefinition = getTestDefinition(
        assessmentId,
        assessment,
        testDefinitions,
      );
      const configuredMiniGames = getConfiguredMiniGames(testDefinition);

      const isNewSchema =
        assessment.attempts && typeof assessment.attempts === "object";
      if (isNewSchema) {
        audit.newSchemaTests++;
      } else {
        audit.legacySchemaTests++;
      }

      const sessions = getSessionsForRepair(assessment);
      for (const session of sessions) {
        repairSession(session, configuredMiniGames, audit);
      }
    }
  }

  return audit;
}

function main() {
  const args = parseArgs(process.argv);
  const data = readJson(args.input);
  const testDefinitions = readJson(args.testDefinitions);
  const audit = repairAssessments(data, testDefinitions);

  fs.writeFileSync(args.output, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.writeFileSync(args.audit, JSON.stringify(audit, null, 2) + "\n", "utf8");

  console.log("Assessment repair complete.");
  console.log(`Output: ${args.output}`);
  console.log(`Audit: ${args.audit}`);
  console.log(JSON.stringify(audit, null, 2));
}

main();
