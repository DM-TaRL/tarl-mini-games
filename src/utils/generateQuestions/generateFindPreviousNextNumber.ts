import { FindPreviousNextNumberConfig } from "../../types/mini-game-types";

export interface PreviousNextQuestion {
  number: number; // the central number
  previous: number; // number - 1
  next: number; // number + 1
}

export function generateFindPreviousNextNumber(
  config: FindPreviousNextNumberConfig,
): { questions: PreviousNextQuestion[] } {
  const { numQuestions, maxNumberRange } = config;

  // 1. Force EXACT digit length to respect teacher difficulty
  // If maxNumberRange = 4: min = 1000, max = 9998
  const minBaseNumber =
    maxNumberRange === 1 ? 1 : Math.pow(10, maxNumberRange - 1);
  const maxBaseNumber = Math.pow(10, maxNumberRange) - 2; // -2 to ensure 'next' doesn't exceed the digit bounds

  // 2. Safeguard against infinite loops if teacher asks for more questions than possible
  const maxPossibleQuestions = maxBaseNumber - minBaseNumber + 1;
  const actualNumQuestions = Math.min(
    numQuestions,
    Math.max(0, maxPossibleQuestions),
  );

  if (actualNumQuestions <= 0) {
    return { questions: [] };
  }

  const questions: PreviousNextQuestion[] = [];
  const usedNumbers = new Set<number>();

  // 3. Fast random selection (Zero memory crash risk)
  while (questions.length < actualNumQuestions) {
    const number =
      Math.floor(Math.random() * (maxBaseNumber - minBaseNumber + 1)) +
      minBaseNumber;

    if (!usedNumbers.has(number)) {
      usedNumbers.add(number);
      questions.push({
        number,
        previous: number - 1,
        next: number + 1,
      });
    }
  }

  return { questions };
}
