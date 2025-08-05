import { CompareNumbersConfig } from "../../types/mini-game-types";

export interface CompareNumbersQuestion {
  id: string;
  left: number;
  right: number;
  correctSign: ">" | "<" | "=";
}

/**
 * Generates a list of unique comparison questions with two numbers and the correct sign.
 */
export function generateCompareNumbers(
  config: CompareNumbersConfig
): CompareNumbersQuestion[] {
  const questions: CompareNumbersQuestion[] = [];
  const seenPairs = new Set<string>();

  // Ensure we get balanced comparison types
  const targetCounts = {
    ">": Math.ceil(config.numQuestions / 3),
    "<": Math.ceil(config.numQuestions / 3),
    "=": Math.ceil(config.numQuestions / 3),
  };

  let attempts = 0;
  const maxAttempts = config.numQuestions * 10; // Prevent infinite loops

  while (questions.length < config.numQuestions && attempts < maxAttempts) {
    attempts++;

    // Prioritize generating needed comparison types
    let neededType: ">" | "<" | "=" | null = null;
    const currentCounts = questions.reduce(
      (acc, q) => {
        acc[q.correctSign]++;
        return acc;
      },
      { ">": 0, "<": 0, "=": 0 }
    );

    if (currentCounts[">"] < targetCounts[">"]) neededType = ">";
    else if (currentCounts["<"] < targetCounts["<"]) neededType = "<";
    else if (currentCounts["="] < targetCounts["="]) neededType = "=";

    let left = generateNumber(config.maxNumberRange);
    let right = generateNumber(config.maxNumberRange);
    let correctSign: ">" | "<" | "=";

    // If we need a specific type, generate numbers that match
    if (neededType === "=") {
      left = right = generateNumber(config.maxNumberRange);
      correctSign = "=";
    } else if (neededType) {
      // Generate numbers that will produce the needed comparison
      do {
        left = generateNumber(config.maxNumberRange);
        right = generateNumber(config.maxNumberRange);
      } while (
        (neededType === ">" && left <= right) ||
        (neededType === "<" && left >= right)
      );
      correctSign = neededType;
    } else {
      // No specific type needed, generate random
      if (left > right) correctSign = ">";
      else if (left < right) correctSign = "<";
      else correctSign = "=";
    }

    const pairKey = `${left},${right}`;
    const reversePairKey = `${right},${left}`;

    // Skip if we've seen this exact pair or its reverse
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    seenPairs.add(reversePairKey); // Also prevent reverse pairs (2,5 vs 5,2)

    questions.push({
      id: `compare_${questions.length + 1}`,
      left,
      right,
      correctSign,
    });
  }

  // If we didn't get enough unique questions, fill remaining with forced unique pairs
  while (questions.length < config.numQuestions) {
    const left = generateNumber(config.maxNumberRange);
    // Generate a number guaranteed to be different
    let right: number;
    do {
      right = generateNumber(config.maxNumberRange);
    } while (right === left);

    const correctSign = left > right ? ">" : "<";
    const pairKey = `${left},${right}`;

    if (!seenPairs.has(pairKey)) {
      seenPairs.add(pairKey);
      questions.push({
        id: `compare_${questions.length + 1}`,
        left,
        right,
        correctSign,
      });
    }
  }

  return questions;
}

/**
 * Generates a random number with up to `digitCount` digits.
 */
function generateNumber(digitCount: number): number {
  const min = digitCount === 1 ? 0 : Math.pow(10, digitCount - 1);
  const max = Math.pow(10, digitCount) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
