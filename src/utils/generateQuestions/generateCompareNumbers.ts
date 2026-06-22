import { CompareNumbersConfig } from "../../types/mini-game-types";

export interface CompareNumbersQuestion {
  id: string;
  left: number;
  right: number;
  correctSign: ">" | "<"; // "=" removed
}

export function generateCompareNumbers(
  config: CompareNumbersConfig,
): CompareNumbersQuestion[] {
  const questions: CompareNumbersQuestion[] = [];
  const seenPairs = new Set<string>();

  const numQ = config.numQuestions;

  // 1. Safety: Calculate maximum mathematically possible unique pairs for the given digit length
  const possibleNumbers =
    config.maxNumberRange === 1
      ? 10
      : 9 * Math.pow(10, config.maxNumberRange - 1);
  const maxPossiblePairs = (possibleNumbers * (possibleNumbers - 1)) / 2;
  const actualNumQuestions = Math.min(numQ, maxPossiblePairs);

  if (actualNumQuestions <= 0) return [];

  // Target a perfect 50/50 split of > and <
  const targetGreater = Math.ceil(actualNumQuestions / 2);

  let attempts = 0;
  const maxAttempts = actualNumQuestions * 10;

  // 2. Safely generate unique pairs
  while (questions.length < actualNumQuestions && attempts < maxAttempts) {
    attempts++;

    let num1 = generateNumber(config.maxNumberRange);
    let num2 = generateNumber(config.maxNumberRange);

    // No equal numbers allowed!
    if (num1 === num2) continue;

    const bigger = Math.max(num1, num2);
    const smaller = Math.min(num1, num2);

    // Normalize key to smaller-bigger so we don't ask 2>1 and then 1<2
    const pairKey = `${smaller}-${bigger}`;
    if (seenPairs.has(pairKey)) continue;

    // Check what sign we need to maintain our 50/50 balance
    const currentGreater = questions.filter(
      (q) => q.correctSign === ">",
    ).length;
    const currentLess = questions.length - currentGreater;

    let neededSign: ">" | "<" = Math.random() < 0.5 ? ">" : "<";

    // Force the sign if one side is lagging behind
    if (currentGreater >= targetGreater) neededSign = "<";
    else if (currentLess >= Math.floor(actualNumQuestions / 2))
      neededSign = ">";

    // Assign the bigger/smaller numbers to the left/right based on the needed sign
    const left = neededSign === ">" ? bigger : smaller;
    const right = neededSign === ">" ? smaller : bigger;

    seenPairs.add(pairKey);
    questions.push({
      id: `compare_${questions.length + 1}_${Date.now()}`,
      left,
      right,
      correctSign: neededSign,
    });
  }

  // 3. Shuffle the final array so all the ">" questions aren't clumped together
  return questions.sort(() => Math.random() - 0.5);
}

function generateNumber(digitCount: number): number {
  const min = digitCount === 1 ? 0 : Math.pow(10, digitCount - 1);
  const max = Math.pow(10, digitCount) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
