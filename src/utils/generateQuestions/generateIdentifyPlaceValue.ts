import { IdentifyPlaceValueConfig } from "../../types/mini-game-types";

export interface PlaceValueQuestion {
  number: number;
  digits: number[]; // Full digit array (e.g., [8, 2, 3, 5, 5, 2])
  expected: Record<string, number>; // e.g., { pos_0: 8, pos_1: 2, ... }
}

export function generateIdentifyPlaceValue(config: IdentifyPlaceValueConfig): {
  questions: PlaceValueQuestion[];
} {
  const { numQuestions, maxNumberRange } = config;

  // 1. Force exact digit length and fix the zero bug for 1-digit numbers
  const digitsCount = Math.max(1, maxNumberRange);
  const minValue = digitsCount === 1 ? 0 : Math.pow(10, digitsCount - 1);
  const maxValue = Math.pow(10, digitsCount) - 1;

  // 2. Safeguard against infinite loops (asking for more questions than exist mathematically)
  const maxPossibleQuestions = maxValue - minValue + 1;
  const actualNumQuestions = Math.min(
    numQuestions,
    Math.max(0, maxPossibleQuestions),
  );

  if (actualNumQuestions <= 0) return { questions: [] };

  const questions: PlaceValueQuestion[] = [];
  const usedNumbers = new Set<number>();

  while (questions.length < actualNumQuestions) {
    const number =
      Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;

    if (usedNumbers.has(number)) continue;
    usedNumbers.add(number);

    const digits = number.toString().split("").map(Number);

    const expected: Record<string, number> = {};
    digits.forEach((digit, i) => {
      expected[`pos_${i}`] = digit;
    });

    questions.push({
      number,
      digits,
      expected,
    });
  }

  return { questions };
}
