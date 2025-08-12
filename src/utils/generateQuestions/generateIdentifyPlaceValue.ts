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

  const maxValue = Math.pow(10, maxNumberRange) - 1;
  const minValue = Math.pow(10, maxNumberRange - 1);

  const questions: PlaceValueQuestion[] = [];
  const usedNumbers = new Set<number>();

  while (questions.length < numQuestions) {
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
