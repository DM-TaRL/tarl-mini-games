import { DecomposeNumberConfig } from "../../types/mini-game-types";

export interface DecomposeNumberQuestion {
  number: number;
  components: number[]; // place value components, e.g., [60000, 7000, 400]
}

export function generateDecomposeNumber(config: DecomposeNumberConfig): {
  questions: DecomposeNumberQuestion[];
} {
  const { numQuestions, maxNumberRange } = config;

  // 1. Force exact digit length AND fix the zero bug for 1-digit numbers
  const digitsCount = Math.max(1, maxNumberRange);
  const min = digitsCount === 1 ? 0 : Math.pow(10, digitsCount - 1);
  const max = Math.pow(10, digitsCount) - 1;

  // 2. Safeguard against infinite loops if the teacher asks for more questions than exist mathematically
  const maxPossibleQuestions = max - min + 1;
  const actualNumQuestions = Math.min(numQuestions, maxPossibleQuestions);

  if (actualNumQuestions <= 0) return { questions: [] };

  const used = new Set<number>();
  const questions: DecomposeNumberQuestion[] = [];

  while (questions.length < actualNumQuestions) {
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
