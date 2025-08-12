import { DecomposeNumberConfig } from "../../types/mini-game-types";

export interface DecomposeNumberQuestion {
  number: number;
  components: number[]; // place value components, e.g., [60000, 7000, 400]
}

export function generateDecomposeNumber(config: DecomposeNumberConfig): {
  questions: DecomposeNumberQuestion[];
} {
  const { numQuestions, maxNumberRange } = config;

  // Define the range of numbers: e.g., if maxNumberRange = 2, max = 999
  const max = Math.pow(10, maxNumberRange) - 1;
  const min = Math.pow(10, maxNumberRange - 1);

  const used = new Set<number>();
  const questions: DecomposeNumberQuestion[] = [];

  while (questions.length < numQuestions) {
    const number = Math.floor(Math.random() * (max - min + 1)) + min;

    if (used.has(number)) continue;

    used.add(number);

    const digits = number.toString().split("").map(Number);
    const components = digits
      .map((digit, index) => {
        const power = digits.length - index - 1;
        return digit * Math.pow(10, power);
      })
      .filter((n) => n !== 0); // exclude zero components

    questions.push({
      number,
      components,
    });
  }

  return {
    questions,
  };
}
