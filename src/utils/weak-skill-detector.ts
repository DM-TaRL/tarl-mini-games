import { GameType, Operation } from "../types/mini-game-types";
import { categorizeTime } from "./utils";

export type WeaknessType = "SlowResponse" | "WrongAnswer";
export type ComplexityLevel = "very-easy" | "easy" | "medium" | "hard";
export type QuestionFormat =
  | "Vertical"
  | "Horizontal"
  | "Visual"
  | "Audio"
  | "Mixed";
export type ComparisonType = "Greater" | "Less" | "Equal";
export type OrderDirection = "asc" | "desc";

type SequenceError = {
  question: number;
  given: number;
  expected: number;
  errorType:
    | "MissingPrevious"
    | "MissingNext"
    | "TensTransition"
    | "OffByOne"
    | "RepeatedNumber"
    | "AddedTen";
};

type RangeBucket = {
  rangeLabel: string;
  count: number;
  questions: number[];
};

type NumberWritingMistake = {
  number: number;
  expected: string[];
  given: string[];
  numDigits: number;
};

type SlowResponse = {
  question: number;
  timeSpentMs: number;
  numDigits?: number;
};

type WrongAnswer = {
  question: number;
  selected: string;
  mistakeType: string;
};

type AudioResponse = {
  question: number;
  selected: string;
  timeSpentMs: number;
};

type DigitMistake = {
  position: string;
  expectedDigit: number;
  givenDigit: number;
  number: number;
  placeLabel: string;
};

export type MistakeType =
  | "MisidentifiedOperation"
  | "ComputationError"
  | "ReversedSign"
  | "FailedEquality"
  | "WrongSign"
  | "IncompleteAnswer"
  | "ReversedDescending"
  | "ReversedAscending"
  | "OneMisplacedNumber"
  | "MultipleMisplacements"
  | "BlankAnswer"
  | "WrongNumberOfParts"
  | "IncorrectValues"
  | "MissingPrevious"
  | "MissingNext"
  | "TensTransitionMistake"
  | "RangeUncertainty"
  | "AboveThresholdWeakness"
  | "RepeatedMistakePair"
  | "RepeatedWritingMistake"
  | "PlaceValueMisidentification"
  | "DigitLengthMistake"
  | "UnknownMistake"
  | "SlowButCorrect";

interface GameLogEntry {
  isCorrect: boolean;
  timeSpentMs: number;
  correctAnswer?: number | string;
  question?: string;
  errorType?: string;
  correctCount?: number;
  selected?: string;
  options?: Array<{ correct: boolean; text: string }>;
  pair?: string[];
  numbers?: number[];
  expected?: any;
  given?: any;
  operation?: Operation;
  target?: number;
  left?: number;
  right?: number;
  correctSign?: string;
  selectedSign?: string;
  correctOrder?: number[];
  selectedOrder?: number[];
  direction?: "asc" | "desc";
  number?: number;
  transcript?: string; // STT text
  parsed?: number; // numeric parse of transcript
  answerTimeCategory?: "fast" | "medium" | "slow";
  // Add other properties based on your actual data structure
}

interface GameResult {
  logs: GameLogEntry[];
}

export interface WeakSkill {
  gameType: GameType;
  count: number;
  operation?: Operation;
  skillSubtype?: string;
  numDigits?: number;
  format?: QuestionFormat;
  complexityLevel?: ComplexityLevel;
  weaknessType?: WeaknessType;
  mistakeType?: MistakeType;
  questionType?: string;
  correctCount?: number;
  comparisonType?: ComparisonType;
  operationsExpected?: Operation[];
  operationsUsed?: Operation[];
  isNested?: boolean;
  orderDirection?: "asc" | "desc";
  sequenceLength?: number;
  expectedParts?: number;
  givenParts?: number;
  examples?: number[];
  missingPlaceValues?: string[];
  misplacedValues?: string[];
  problematicPair?: any;
  thresholdStart?: number;
  digitLength?: string;
  difficultyZone?: string;
  avgTimeMs?: number;
  description?: string;
  number?: number;
  wrongVariants?: string[];
  expected?: string[];
  expectedDigit?: number;
  commonMistakes?: number[];
  mistakeTypes?: string[];
  // we can other properties based on our detected skills
}

interface ThresholdOptions {
  step?: number;
  requiredRatio?: number;
  minErrors?: number;
}

/**
 * Analyze the mini-game logs and extract weak skill patterns using per-game logic.
 * @param {Object} miniGameResults - Object where each key is a gameType and value is the game logs.
 * @returns {Array} weakSkills - Detected weak skill objects.
 */
export function detectWeakSkills(
  miniGameResults: Record<string, GameResult>
): WeakSkill[] {
  const weakSkills: WeakSkill[] = [];

  for (const [gameType, attempts] of Object.entries(miniGameResults)) {
    if (!attempts) continue;

    for (const [attemptNumber, result] of Object.entries(attempts)) {
      if (!result?.logs) continue;

      switch (gameType) {
        case "vertical_operations": {
          for (const entry of result.logs) {
            if (
              entry.isCorrect &&
              categorizeTime(entry.timeSpentMs, gameType) !== "slow"
            )
              continue;

            const correct = entry.correctAnswer ?? 0;
            const [aStr, opStr, bStr] = (entry.question || "").split(" ");
            const a = Number(aStr),
              b = Number(bStr);
            const operation = parseOperation(opStr);
            const skillSubtype = classifyVerticalOperationSkill(
              operation,
              a,
              b
            );

            const skill: WeakSkill = {
              gameType: gameType as GameType,
              operation,
              skillSubtype,
              numDigits: Math.max(aStr.length, bStr.length),
              format: "Vertical",
              complexityLevel: classifyComplexity(correct),
              weaknessType: inferWeaknessTypeOnCorrect(entry),
              count: 1,
            };

            const existing = weakSkills.find((s) =>
              Object.entries(skill).every(
                ([key, val]) => s[key as keyof WeakSkill] === val
              )
            );

            if (existing) {
              existing.count += 1;
            } else {
              weakSkills.push(skill);
            }
          }
          break;
        }
        case "find_compositions": {
          for (const entry of result.logs) {
            if (
              entry.isCorrect &&
              categorizeTime(entry.timeSpentMs, gameType) !== "slow"
            )
              continue;

            const operation = entry.operation;
            const target = entry.target || 0;
            const complexityLevel = classifyComplexity(target);
            const numDigits = target.toString().length;

            const skill: WeakSkill = {
              gameType,
              operation,
              numDigits,
              format: "Horizontal",
              questionType: "Composition",
              complexityLevel,
              weaknessType: inferWeaknessTypeOnCorrect(entry),
              mistakeType: entry.errorType as MistakeType,
              correctCount: entry.correctCount ?? 0,
              count: 1,
            };

            const existing = weakSkills.find((s) =>
              Object.entries(skill).every(([key, val]) => s[key] === val)
            );

            if (existing) {
              existing.count += 1;
            } else {
              weakSkills.push({ ...skill, count: 1 });
            }
          }
          break;
        }
        case "choose_answer": {
          for (const entry of result.logs) {
            if (
              entry.isCorrect &&
              categorizeTime(entry.timeSpentMs, gameType) !== "slow"
            )
              continue;

            const correctOption =
              entry.options.find((opt) => opt.correct)?.text || "";
            const chosenOption = entry.selected || "";

            const correctOperations = extractOperations(correctOption);
            const chosenOperations = extractOperations(chosenOption);
            const questionNumbers = extractNumbers(correctOption);
            const hasMismatch = isOperationMismatch(
              correctOperations,
              chosenOperations
            );
            const mistakeType: MistakeType = hasMismatch
              ? "MisidentifiedOperation"
              : entry.isCorrect
              ? "SlowButCorrect"
              : "ComputationError";

            const skill: WeakSkill = {
              gameType,
              format: "Horizontal",
              questionType:
                correctOperations.length > 1
                  ? "MultiStepProblem"
                  : "OneStepProblem",
              operationsExpected: correctOperations,
              operationsUsed: chosenOperations,
              mistakeType,
              isNested: correctOperations.length > 1,
              numDigits: Math.max(
                ...questionNumbers.map((n) => n.toString().length)
              ),
              complexityLevel: classifyComplexity(
                questionNumbers.reduce((a, b) => a + b, 0)
              ),
              weaknessType: inferWeaknessTypeOnCorrect(entry),
              count: 1,
            };

            const existing = weakSkills.find((s) =>
              Object.entries(skill).every(
                ([key, val]) => s[key as keyof WeakSkill] === val
              )
            );

            if (existing) {
              existing.count += 1;
            } else {
              weakSkills.push(skill);
            }
          }
          break;
        }
        case "compare_numbers": {
          for (const entry of result.logs) {
            if (
              entry.isCorrect &&
              categorizeTime(entry.timeSpentMs, gameType) !== "slow"
            )
              continue;

            const { left, right, correctSign, selectedSign } = entry;

            const skill: WeakSkill = {
              gameType,
              format: "Horizontal",
              questionType: "Comparison",
              comparisonType: determineComparisonType(left, right),
              mistakeType: determineComparisonMistake(
                correctSign,
                selectedSign
              ),
              numDigits: Math.max(
                left.toString().length,
                right.toString().length
              ),
              complexityLevel: classifyComplexity(left + right),
              weaknessType: inferWeaknessTypeOnCorrect(entry),
              count: 1,
            };

            const existing = weakSkills.find((s) =>
              Object.entries(skill).every(
                ([key, val]) => s[key as keyof WeakSkill] === val
              )
            );

            if (existing) {
              existing.count += 1;
            } else {
              weakSkills.push(skill);
            }
          }
          break;
        }
        case "order_numbers": {
          for (const entry of result.logs) {
            if (
              entry.isCorrect &&
              categorizeTime(entry.timeSpentMs, gameType) !== "slow"
            )
              continue;

            const {
              numbers = [],
              correctOrder = [],
              selectedOrder = [],
              direction,
            } = entry;

            const mistakeType = classifyOrderingMistake(
              correctOrder,
              selectedOrder,
              direction
            );
            const numDigits = Math.max(
              ...numbers.map((n) => n.toString().length)
            );

            const skill: WeakSkill = {
              gameType,
              format: "Visual",
              questionType: "Ordering",
              orderDirection: direction, // "asc" or "desc"
              mistakeType,
              numDigits,
              sequenceLength: numbers.length,
              complexityLevel: classifyComplexity(
                numbers.reduce((a, b) => a + b, 0)
              ),
              weaknessType: inferWeaknessTypeOnCorrect(entry),
              count: 1,
            };

            const existing = weakSkills.find((s) =>
              Object.entries(skill).every(
                ([key, val]) => s[key as keyof WeakSkill] === val
              )
            );

            if (existing) {
              existing.count += 1;
            } else {
              weakSkills.push(skill);
            }
          }
          break;
        }
        case "decompose_number": {
          for (const entry of result.logs) {
            if (
              entry.isCorrect &&
              categorizeTime(entry.timeSpentMs, gameType) !== "slow"
            )
              continue;

            const number: number =
              typeof entry.number === "number" ? entry.number : 0;
            const expected: number[] = Array.isArray(entry.expected)
              ? entry.expected
              : [];
            const given: number[] = Array.isArray(entry.given)
              ? entry.given
              : [];

            const mistakeType: MistakeType = classifyDecompositionMistake(
              expected,
              given
            );
            const numDigits: number = number.toString().length;
            const expectedPlaces: string[] = expected.map(getPlaceValueLabel);
            const givenPlaces: string[] = given.map(getPlaceValueLabel);

            const missingPlaces: string[] = expectedPlaces.filter(
              (pv: string) => !givenPlaces.includes(pv)
            );
            const extraPlaces: string[] = givenPlaces.filter(
              (pv: string) => !expectedPlaces.includes(pv)
            );

            const skill: WeakSkill = {
              gameType,
              format: "Visual",
              questionType: "Decomposition",
              mistakeType,
              numDigits,
              expectedParts: expected.length,
              givenParts: given.length,
              complexityLevel: classifyComplexity(number),
              missingPlaceValues: missingPlaces,
              misplacedValues: extraPlaces,
              weaknessType: inferWeaknessTypeOnCorrect(entry),
              count: 1,
            };

            const existing = weakSkills.find((s) =>
              Object.entries(skill).every(
                ([key, val]) => s[key as keyof WeakSkill] === val
              )
            );

            if (existing) {
              existing.count += 1;
            } else {
              weakSkills.push(skill);
            }
          }
          break;
        }
        case "find_previous_next_number": {
          const errors = {
            previous: [] as SequenceError[],
            next: [] as SequenceError[],
            transitions: [] as SequenceError[],
            slowCorrects: [] as SlowResponse[],
            rangeBuckets: new Map<string, RangeBucket>(),
            incorrectNumbers: [] as number[],
          };

          for (const entry of result.logs) {
            const question =
              typeof entry.question === "string"
                ? parseInt(entry.question, 10)
                : entry.question || 0;

            // Skip if question is not a valid number
            if (isNaN(question)) continue;
            const { isCorrect, expected = [], given = [], timeSpentMs } = entry;

            // Track range distribution
            const rangeLabel = getRangeLabel(question, 10);
            const currentRange = errors.rangeBuckets.get(rangeLabel) || {
              rangeLabel,
              count: 0,
              questions: [],
            };
            currentRange.count++;
            currentRange.questions.push(question);
            errors.rangeBuckets.set(rangeLabel, currentRange);

            // Track slow but correct responses
            if (isCorrect) {
              if (categorizeTime(timeSpentMs, gameType) === "slow") {
                errors.slowCorrects.push({ question, timeSpentMs });
              }
              continue;
            }

            errors.incorrectNumbers.push(question);
            const [prevExpected, nextExpected] = expected as [number, number];
            const [prevGiven, nextGiven] = given as [number, number];

            // Classify previous number errors
            if (prevGiven !== prevExpected) {
              const errorType = classifySequenceError(
                question,
                prevGiven,
                prevExpected,
                "previous"
              );
              errors.previous.push({
                question,
                given: prevGiven,
                expected: prevExpected,
                errorType,
              });
            }

            // Classify next number errors
            if (nextGiven !== nextExpected) {
              const errorType = classifySequenceError(
                question,
                nextGiven,
                nextExpected,
                "next"
              );
              errors.next.push({
                question,
                given: nextGiven,
                expected: nextExpected,
                errorType,
              });
            }

            // Detect transition errors
            if (isTensTransitionError(question, prevExpected, nextExpected)) {
              errors.transitions.push({
                question,
                given: -1, // Not applicable for transition errors
                expected: -1,
                errorType: "TensTransition",
              });
            }
          }

          // Generate weak skills from collected data
          generateWeakSkillsFromErrors(weakSkills, gameType, errors);

          break;
        }
        case "tap_matching_pairs": {
          const slowResponses = [];
          const mistakePairs = [];

          for (const entry of result.logs) {
            const { isCorrect, timeSpentMs, pair = [] } = entry;

            const pairSorted = [...pair].sort(); // Normalize order

            if (
              isCorrect &&
              categorizeTime(entry.timeSpentMs, gameType) !== "slow"
            ) {
              slowResponses.push({
                pair: pairSorted,
                timeSpentMs,
              });
            }

            if (!isCorrect) {
              mistakePairs.push(pairSorted);
            }
          }

          pushIfAny(weakSkills, {
            gameType,
            mistakeType: "SlowButCorrect",
            questionType: "MatchingPair",
            avgTimeMs:
              slowResponses.reduce((sum, e) => sum + e.timeSpentMs, 0) /
              (slowResponses.length || 1),
            examples: slowResponses.map((e) => e.pair),
          });

          const pairCounts = countPairOccurrences(mistakePairs);
          for (const [pairKey, count] of Object.entries(pairCounts)) {
            if (count >= 2) {
              weakSkills.push({
                gameType,
                mistakeType: "RepeatedMistakePair",
                questionType: "MatchingPair",
                problematicPair: JSON.parse(pairKey),
                count,
              });
            }
          }

          break;
        }
        case "write_number_in_letters": {
          const slowResponses: SlowResponse[] = [];
          const mistakesByDigit: NumberWritingMistake[] = [];

          for (const entry of result.logs) {
            // Safely convert number to numeric value
            const number =
              typeof entry.number === "string"
                ? parseInt(entry.number, 10)
                : entry.number || 0;

            // Skip invalid numbers
            if (isNaN(number)) continue;

            // Ensure expected and given are arrays of strings
            const expected = Array.isArray(entry.expected)
              ? entry.expected.map((v) => String(v))
              : [];
            const given = Array.isArray(entry.given)
              ? entry.given.map((v) => String(v))
              : [];

            const numDigits = number.toString().length;

            if (entry.isCorrect) {
              if (categorizeTime(entry.timeSpentMs, gameType) === "slow") {
                slowResponses.push({
                  question: number,
                  timeSpentMs: entry.timeSpentMs,
                  numDigits,
                });
              }
              continue;
            }

            mistakesByDigit.push({
              number,
              expected,
              given,
              numDigits,
            });
          }

          // Add slow responses if any
          if (slowResponses.length > 0) {
            pushIfAny(weakSkills, {
              gameType,
              questionType: "NumberToWord",
              mistakeType: "SlowButCorrect",
              avgTimeMs:
                slowResponses.reduce((sum, e) => sum + e.timeSpentMs, 0) /
                slowResponses.length,
              numDigits: Math.max(...slowResponses.map((e) => e.numDigits)),
              examples: slowResponses.map((e) => e.question),
              count: slowResponses.length,
            });
          }

          // Group and process mistakes
          const groupedMistakes = groupMistakesByNumber(mistakesByDigit);
          for (const [numberStr, examples] of Object.entries(groupedMistakes)) {
            if (examples.length >= 2) {
              const number = parseInt(numberStr, 10);
              const mostCommonDigitLength = Math.max(
                ...examples.map((e) => e.numDigits)
              );

              weakSkills.push({
                gameType,
                questionType: "NumberToWord",
                mistakeType: "RepeatedWritingMistake",
                number,
                numDigits: mostCommonDigitLength,
                wrongVariants: examples.map((e) => e.given),
                expected: examples[0]?.expected || [],
                count: examples.length,
              });
            }
          }

          break;
        }
        case "identify_place_value": {
          const digitMistakes: DigitMistake[] = [];
          const slowCorrects: SlowResponse[] = [];

          for (const entry of result.logs) {
            // Safely convert number to numeric value
            const number =
              typeof entry.number === "string"
                ? parseInt(entry.number, 10)
                : entry.number || 0;

            // Skip invalid numbers
            if (isNaN(number)) continue;

            // Ensure expected and given are treated as record types
            const expected =
              typeof entry.expected === "object" && entry.expected !== null
                ? (entry.expected as Record<string, unknown>)
                : {};
            const given =
              typeof entry.given === "object" && entry.given !== null
                ? (entry.given as Record<string, unknown>)
                : {};

            const numDigits = number.toString().length;

            if (entry.isCorrect) {
              if (categorizeTime(entry.timeSpentMs, gameType) === "slow") {
                slowCorrects.push({
                  question: number,
                  timeSpentMs: entry.timeSpentMs,
                  numDigits,
                });
              }
              continue;
            }

            // Process digit mistakes
            for (const posKey of Object.keys(expected)) {
              const expectedDigit = Number(expected[posKey]);
              const givenDigit = Number(given[posKey]);

              if (!isNaN(expectedDigit) && !isNaN(givenDigit)) {
                if (expectedDigit !== givenDigit) {
                  digitMistakes.push({
                    position: posKey,
                    expectedDigit,
                    givenDigit,
                    number,
                    placeLabel: getPlaceValueLabelFromPosition(number, posKey),
                  });
                }
              }
            }
          }

          // Add slow responses if any
          if (slowCorrects.length > 0) {
            pushIfAny(weakSkills, {
              gameType,
              mistakeType: "SlowButCorrect",
              questionType: "PlaceValueIdentification",
              avgTimeMs:
                slowCorrects.reduce((sum, e) => sum + e.timeSpentMs, 0) /
                slowCorrects.length,
              numDigits: Math.max(...slowCorrects.map((e) => e.numDigits)),
              examples: slowCorrects.map((e) => e.question),
              count: slowCorrects.length,
            });
          }

          // Group and process digit mistakes
          const groupedByDigit: Record<string, DigitMistake[]> = {};
          for (const mistake of digitMistakes) {
            const key = `${mistake.position}-${mistake.expectedDigit}`;
            if (!groupedByDigit[key]) {
              groupedByDigit[key] = [];
            }
            groupedByDigit[key].push(mistake);
          }

          for (const [key, examples] of Object.entries(groupedByDigit)) {
            if (examples.length >= 2) {
              const [posKey, expectedDigit] = key.split("-");
              weakSkills.push({
                gameType,
                mistakeType: "PlaceValueMisidentification",
                questionType: "PlaceValueIdentification",
                expectedDigit: Number(expectedDigit),
                count: examples.length,
                commonMistakes: examples.map((e) => e.givenDigit),
                examples: examples.map((e) => e.number),
              });
            }
          }

          break;
        }
        case "what_number_do_you_hear": {
          const slowCorrects: AudioResponse[] = [];
          const wrongAnswersByDigitLength: Record<string, WrongAnswer[]> = {};

          for (const entry of result.logs) {
            // Safely convert question to number
            const question =
              typeof entry.question === "string"
                ? parseInt(entry.question, 10)
                : entry.question || 0;

            // Skip invalid numbers
            if (isNaN(question)) continue;

            const selected =
              typeof entry.selected === "string" ? entry.selected : "";

            if (entry.isCorrect) {
              if (categorizeTime(entry.timeSpentMs, gameType) === "slow") {
                slowCorrects.push({
                  question,
                  selected,
                  timeSpentMs: entry.timeSpentMs,
                });
              }
              continue;
            }

            // Process wrong answers
            const digitLength = question.toString().length;
            const key = `${digitLength}-digit`;

            if (!wrongAnswersByDigitLength[key]) {
              wrongAnswersByDigitLength[key] = [];
            }

            wrongAnswersByDigitLength[key].push({
              question,
              selected,
              mistakeType: "WrongNumberHeard",
            });
          }

          // Add slow responses if any
          if (slowCorrects.length > 0) {
            pushIfAny(weakSkills, {
              gameType,
              questionType: "NumberRecognitionByAudio",
              mistakeType: "SlowButCorrect",
              avgTimeMs:
                slowCorrects.reduce((sum, e) => sum + e.timeSpentMs, 0) /
                slowCorrects.length,
              examples: slowCorrects.map((e) => e.question),
              count: slowCorrects.length,
            });
          }

          // Process wrong answers by digit length
          for (const [digitKey, entries] of Object.entries(
            wrongAnswersByDigitLength
          )) {
            weakSkills.push({
              gameType,
              questionType: "NumberRecognitionByAudio",
              mistakeType: "DigitLengthMistake",
              digitLength: digitKey,
              count: entries.length,
              examples: entries.map((e) => e.question),
              mistakeTypes: Array.from(
                new Set(entries.map((e) => e.mistakeType))
              ),
            });
          }
          break;
        }
        case "read_number_aloud": {
          const lang = (result as any)?.language ?? "unknown";
          const logs = Array.isArray(result.logs) ? result.logs : [];
          const total = logs.length;
          if (!total) break;

          // Counters
          const empty = logs.filter(
            (l) => !String(l.transcript ?? "").trim()
          ).length;
          const wrong = logs.filter((l) => l.isCorrect === false).length;
          const wrongWithSpeech = logs.filter(
            (l) => l.isCorrect === false && String(l.transcript ?? "").trim()
          ).length;
          const fast = logs.filter(
            (l) => categorizeTime(l.timeSpentMs, gameType) === "fast"
          ).length;

          const emptyRate = empty / total;
          const wrongWithSpeechRate = wrongWithSpeech / total;
          const fastRate = fast / total;

          // 1) Audio / STT issue (do not penalize math skill)
          if (emptyRate >= 0.5) {
            pushOrInc(weakSkills, {
              gameType: gameType as GameType,
              questionType: "ReadingNumbersAloud",
              format: "Audio",
              skillSubtype: "stt_or_microphone_issue",
              weaknessType: undefined,
              count: empty,
            });
            // If almost all are empty, stop here.
            if (emptyRate >= 0.8) break;
          }

          // 2) Impulsive / rushed (fast + wrong)
          if (fastRate >= 0.5 && wrong >= Math.ceil(total * 0.5)) {
            pushOrInc(weakSkills, {
              gameType: gameType as GameType,
              questionType: "ReadingNumbersAloud",
              format: "Audio",
              skillSubtype: "impulsive_or_rushed_response",
              weaknessType: "WrongAnswer",
              count: wrong,
            });
          }

          // 3) Number-reading difficulty (has speech but wrong)
          if (wrongWithSpeechRate >= 0.3) {
            pushOrInc(weakSkills, {
              gameType: gameType as GameType,
              questionType: "ReadingNumbersAloud",
              format: "Audio",
              skillSubtype: `reading_numbers_${lang}`, // ar|fr|en if present
              weaknessType: "WrongAnswer",
              count: wrongWithSpeech,
            });
          }

          // 4) Fine-grained: use parsed numbers to detect patterns
          const withParsed = logs.filter((l) => {
            const q =
              typeof l.question === "number" ? l.question : Number(l.question);
            return !isNaN(q) && typeof l.parsed === "number";
          });

          if (withParsed.length) {
            let tensConfusions = 0;
            let largeNumberConfusions = 0;
            let nearMisses = 0;

            for (const l of withParsed) {
              if (l.isCorrect) continue;
              const target =
                typeof l.question === "number"
                  ? l.question
                  : Number(l.question);
              const heard = Number(l.parsed);
              if (!isFinite(target) || !isFinite(heard)) continue;

              const diff = Math.abs(heard - target);
              const mag = Math.max(
                1,
                Math.pow(10, String(Math.abs(target)).length - 1)
              );
              const rel = diff / mag;

              // tens vs units (same unit digit; wrong decade)
              if (
                heard % 10 === target % 10 &&
                Math.floor(heard / 10) !== Math.floor(target / 10)
              ) {
                tensConfusions++;
                continue;
              }

              // large-number chunking: off by thousands/hundreds
              const digits = (n: number) => String(Math.abs(n)).length;
              if (
                digits(target) >= 4 &&
                (digits(heard) !== digits(target) || rel >= 0.5)
              ) {
                largeNumberConfusions++;
                continue;
              }

              // near-miss (likely minor pronunciation/parse)
              if (rel <= 0.1) nearMisses++;
            }

            const tn = withParsed.length;
            if (tensConfusions / tn >= 0.2) {
              pushOrInc(weakSkills, {
                gameType: gameType as GameType,
                questionType: "ReadingNumbersAloud",
                format: "Audio",
                skillSubtype: `two_digit_number_names_${lang}`,
                weaknessType: "WrongAnswer",
                count: tensConfusions,
              });
              if (lang === "fr") {
                pushOrInc(weakSkills, {
                  gameType: gameType as GameType,
                  questionType: "ReadingNumbersAloud",
                  format: "Audio",
                  skillSubtype: "fr_quatre_vingt_family_risk",
                  weaknessType: "WrongAnswer",
                  count: tensConfusions,
                });
              }
            }
            if (largeNumberConfusions / tn >= 0.2) {
              pushOrInc(weakSkills, {
                gameType: gameType as GameType,
                questionType: "ReadingNumbersAloud",
                format: "Audio",
                skillSubtype: `large_number_chunking_${lang}`,
                weaknessType: "WrongAnswer",
                count: largeNumberConfusions,
              });
            }
            if (nearMisses / tn >= 0.2) {
              pushOrInc(weakSkills, {
                gameType: gameType as GameType,
                questionType: "ReadingNumbersAloud",
                format: "Audio",
                skillSubtype: `pronunciation_or_parser_minor_${lang}`,
                weaknessType: "WrongAnswer",
                count: nearMisses,
              });
            }
          }

          break;
        }
        case "multi_step_problem": {
          // fallback for other games
          for (const entry of result.logs) {
            if (entry.isCorrect) continue;

            const correct = entry.correctAnswer?.toString?.() || "";
            const numDigits = correct.length || 1;

            const skill: WeakSkill = {
              gameType,
              operation: inferOperation(entry),
              numDigits,
              format: inferFormat(gameType),
              questionType: inferQuestionType(gameType),
              weaknessType: inferWeaknessTypeOnCorrect(entry),
              count: 1,
            };

            const existing = weakSkills.find((s) =>
              Object.entries(skill).every(
                ([key, val]) => s[key as keyof WeakSkill] === val
              )
            );

            if (existing) {
              existing.count += 1;
            } else {
              weakSkills.push(skill);
            }
          }
          break;
        }
      }
    }
  }

  return weakSkills;
}

function parseOperation(str = ""): Operation {
  if (str.toLowerCase().includes("add")) return "Addition";
  if (str.toLowerCase().includes("sub")) return "Subtraction";
  if (str.toLowerCase().includes("mul")) return "Multiplication";
  if (str.toLowerCase().includes("div")) return "Division";
}

function classifyVerticalOperationSkill(
  op: Operation,
  a: number,
  b: number
): string {
  const aDigits = a.toString().split("").map(Number);
  const bDigits = b.toString().split("").map(Number);

  switch (op) {
    case "Addition": {
      const hasCarry = aDigits.some((digit, i) => {
        const bDigit = bDigits[bDigits.length - aDigits.length + i] || 0;
        return digit + bDigit >= 10;
      });
      return hasCarry ? "AdditionWithCarry" : "SimpleAddition";
    }

    case "Subtraction": {
      const hasBorrow = aDigits.some((digit, i) => {
        const bDigit = bDigits[bDigits.length - aDigits.length + i] || 0;
        return digit < bDigit;
      });
      return hasBorrow ? "SubtractionWithBorrow" : "SimpleSubtraction";
    }

    case "Multiplication": {
      const isMultiStep = a > 9 || b > 9;
      return isMultiStep
        ? "MultiStepMultiplication"
        : "SingleStepMultiplication";
    }

    case "Division": {
      const remainder = a % b;
      const isMultiStep = a > b * 10;
      if (remainder !== 0) return "DivisionWithRemainder";
      return isMultiStep ? "MultiStepDivision" : "SingleStepDivision";
    }

    default:
      return "Unknown";
  }
}

function extractOperations(text = ""): Operation[] {
  const ops = new Set<Operation>();
  if (text.includes("+")) ops.add("Addition");
  if (text.includes("-")) ops.add("Subtraction");
  if (text.includes("×") || text.includes("*")) ops.add("Multiplication");
  if (text.includes("÷") || text.includes("/") || text.includes("div"))
    ops.add("Division");
  return [...ops];
}

function extractNumbers(text = ""): number[] {
  return text
    .replace(/[^0-9]/g, " ")
    .trim()
    .split(/\s+/)
    .map(Number);
}

function isOperationMismatch(
  expectedOps: Operation[],
  chosenOps: Operation[]
): boolean {
  return (
    expectedOps.length !== chosenOps.length ||
    expectedOps.some((op) => !chosenOps.includes(op))
  );
}

function determineComparisonType(left: number, right: number): ComparisonType {
  if (left > right) return "Greater";
  if (left < right) return "Less";
  return "Equal";
}

function determineComparisonMistake(
  correct: string,
  selected: string
): MistakeType {
  if (correct === selected) return "SlowButCorrect";
  if (correct === ">" && selected === "<") return "ReversedSign";
  if (correct === "<" && selected === ">") return "ReversedSign";
  if (correct === "=") return "FailedEquality";
  return "WrongSign";
}

function classifyOrderingMistake(
  correctOrder: number[],
  selectedOrder: number[],
  direction: OrderDirection
): MistakeType {
  if (selectedOrder.length !== correctOrder.length) return "IncompleteAnswer";

  const isReversed =
    selectedOrder.join(",") === [...correctOrder].reverse().join(",");
  if (isReversed) {
    return direction === "asc" ? "ReversedDescending" : "ReversedAscending";
  }

  const numWrongPositions = correctOrder.filter(
    (num, i) => num !== selectedOrder[i]
  ).length;
  if (numWrongPositions === 1) return "OneMisplacedNumber";
  if (numWrongPositions > 1) return "MultipleMisplacements";

  return "UnknownMistake";
}

function classifyDecompositionMistake(
  expected: number[],
  given: number[]
): MistakeType {
  if (!given.length) return "BlankAnswer";

  const expSorted = [...expected].sort((a, b) => b - a);
  const givSorted = [...given].sort((a, b) => b - a);

  if (expSorted.length !== givSorted.length) return "WrongNumberOfParts";

  const mismatchCount = expSorted.filter(
    (val, i) => val !== givSorted[i]
  ).length;

  if (mismatchCount > 0) return "IncorrectValues";

  return "UnknownMistake";
}

function getPlaceValueLabel(n: number): string {
  const digits = n.toString().length;
  switch (digits) {
    case 1:
      return "Units";
    case 2:
      return "Tens";
    case 3:
      return "Hundreds";
    case 4:
      return "Thousands";
    case 5:
      return "TenThousands";
    case 6:
      return "HundredThousands";
    case 7:
      return "Millions";
    default:
      return `${"1" + "0".repeat(digits - 1)}s`;
  }
}

function getRangeStart(n: number, step = 10): number {
  return Math.floor(n / step) * step;
}

function getRangeLabel(n: number, step = 10): string {
  const min = getRangeStart(n, step);
  const max = min + step - 1;
  return `${min}–${max}`;
}

function pushIfMany(list: WeakSkill[], obj: Partial<WeakSkill>, min = 2): void {
  if (obj.examples && obj.examples.length >= min) {
    list.push({
      ...obj,
      count: obj.examples.length,
    } as WeakSkill);
  }
}

function pushIfAny(list: WeakSkill[], obj: Partial<WeakSkill>): void {
  if (obj.examples && obj.examples.length) {
    list.push({
      ...obj,
      count: obj.examples.length,
    } as WeakSkill);
  }
}

function detectAboveThresholdWeakness(
  numbers: number[],
  options: ThresholdOptions = {}
): number | null {
  const { step = 10, requiredRatio = 0.75, minErrors = 3 } = options;

  if (!numbers?.length || numbers.length < minErrors) return null;

  const max = Math.max(...numbers);
  const breakpoints: number[] = [];

  for (let t = step; t < max; t += step) {
    breakpoints.push(t);
  }

  for (const threshold of breakpoints) {
    const above = numbers.filter((n) => n >= threshold);
    if (above.length / numbers.length >= requiredRatio) {
      return threshold;
    }
  }

  return null;
}

function countPairOccurrences(pairs: string[][]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const pair of pairs) {
    const key = JSON.stringify([...pair].sort());
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function groupMistakesByNumber(
  entries: Array<{ number: number }>
): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  for (const entry of entries) {
    const key = entry.number.toString();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  return grouped;
}

function getPlaceValueLabelFromPosition(
  number: number,
  positionIndex: string
): string {
  const str = number.toString();
  const idx = Number(positionIndex);
  const reversedPos = str.length - 1 - idx;
  return getPlaceValueLabel(10 ** reversedPos);
}

// TO CHANGE (based on the gameType)
function classifyComplexity(correctAnswer: number | string): ComplexityLevel {
  const n = Number(correctAnswer);
  if (n < 10) return "very-easy";
  if (n < 100) return "easy";
  if (n < 1000) return "medium";
  return "hard";
}

function inferOperation(entry: GameLogEntry): Operation {
  if (entry.question?.includes("+")) return "Addition";
  if (entry.question?.includes("-")) return "Subtraction";
  if (entry.question?.includes("x")) return "Multiplication";
  if (entry.question?.includes("/") || entry.question?.includes("div"))
    return "Division";
}

function inferFormat(gameType: string): QuestionFormat {
  if (gameType.includes("vertical")) return "Vertical";
  if (gameType.includes("audio") || gameType.includes("hear")) return "Audio";
  if (gameType.includes("place_value") || gameType.includes("choose"))
    return "Visual";
  return "Mixed";
}

function inferQuestionType(gameType: string): string {
  if (gameType.includes("composition")) return "Composition";
  if (gameType.includes("place_value")) return "PlaceValue";
  if (gameType.includes("compare")) return "Comparison";
  if (gameType.includes("problem")) return "WordProblem";
  return "Arithmetic";
}

function inferWeaknessTypeOnCorrect(entry: GameLogEntry): WeaknessType {
  if (entry.isCorrect) return "SlowResponse";
  return "WrongAnswer";
}

function classifySequenceError(
  question: number,
  given: number,
  expected: number,
  direction: "previous" | "next"
): SequenceError["errorType"] {
  if (given === question) return "RepeatedNumber";
  if (Math.abs(given - expected) === 1) return "OffByOne";
  if (Math.abs(given - expected) === 10) return "AddedTen";

  return direction === "previous" ? "MissingPrevious" : "MissingNext";
}

function isTensTransitionError(
  question: number,
  prev: number,
  next: number
): boolean {
  const questionRange = Math.floor(question / 10);
  return (
    Math.floor(prev / 10) !== questionRange ||
    Math.floor(next / 10) !== questionRange
  );
}

function generateWeakSkillsFromErrors(
  weakSkills: WeakSkill[],
  gameType: GameType,
  errors: {
    previous: SequenceError[];
    next: SequenceError[];
    transitions: SequenceError[];
    slowCorrects: SlowResponse[];
    rangeBuckets: Map<string, RangeBucket>;
    incorrectNumbers: number[];
  }
): void {
  // Group errors by type for previous number mistakes
  const previousErrorGroups = groupBy(errors.previous, "errorType");
  for (const [errorType, examples] of Object.entries(previousErrorGroups)) {
    pushIfMany(weakSkills, {
      gameType,
      questionType: "PreviousNumber",
      mistakeType: errorType as MistakeType,
      examples: examples.map((e) => e.question),
      count: examples.length,
    });
  }

  // Group errors by type for next number mistakes
  const nextErrorGroups = groupBy(errors.next, "errorType");
  for (const [errorType, examples] of Object.entries(nextErrorGroups)) {
    pushIfMany(weakSkills, {
      gameType,
      questionType: "NextNumber",
      mistakeType: errorType as MistakeType,
      examples: examples.map((e) => e.question),
      count: examples.length,
    });
  }

  // Add transition errors if any
  if (errors.transitions.length > 0) {
    pushIfAny(weakSkills, {
      gameType,
      mistakeType: "TensTransitionMistake",
      examples: errors.transitions.map((t) => t.question),
      count: errors.transitions.length,
    });
  }

  // Add slow responses if any
  if (errors.slowCorrects.length > 0) {
    pushIfAny(weakSkills, {
      gameType,
      mistakeType: "SlowButCorrect",
      avgTimeMs:
        errors.slowCorrects.reduce((acc, e) => acc + e.timeSpentMs, 0) /
        errors.slowCorrects.length,
      examples: errors.slowCorrects.map((e) => e.question),
      count: errors.slowCorrects.length,
    });
  }

  // Add range uncertainties
  for (const [_, bucket] of errors.rangeBuckets) {
    if (bucket.count <= 2) {
      weakSkills.push({
        gameType,
        mistakeType: "RangeUncertainty",
        difficultyZone: bucket.rangeLabel,
        examples: bucket.questions,
        count: bucket.count,
      });
    }
  }

  // Detect threshold weaknesses
  const threshold = detectAboveThresholdWeakness(errors.incorrectNumbers, {
    step: 10,
    requiredRatio: 0.8,
    minErrors: 3,
  });

  if (threshold !== null) {
    weakSkills.push({
      gameType,
      mistakeType: "AboveThresholdWeakness",
      thresholdStart: threshold,
      description: `Student struggles mostly with numbers ≥ ${threshold}`,
      examples: errors.incorrectNumbers.filter((n) => n >= threshold),
      count: errors.incorrectNumbers.filter((n) => n >= threshold).length,
    });
  }
}

// Utility function to group array items by property
function groupBy<T extends Record<string, any>, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const groupKey = item[key];
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function pushOrInc(weakSkills: WeakSkill[], skill: WeakSkill) {
  const existing = weakSkills.find(
    (s) =>
      s.gameType === skill.gameType &&
      s.questionType === skill.questionType &&
      s.skillSubtype === skill.skillSubtype &&
      s.mistakeType === skill.mistakeType
  );
  if (existing) existing.count += skill.count;
  else weakSkills.push(skill);
}
