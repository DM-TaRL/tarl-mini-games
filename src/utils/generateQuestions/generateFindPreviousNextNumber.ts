import { FindPreviousNextNumberConfig } from "../../types/mini-game-types";

export interface PreviousNextQuestion {
  number: number; // the central number
  previous: number; // number - 1
  next: number; // number + 1
}

export function generateFindPreviousNextNumber(
  config: FindPreviousNextNumberConfig
): {
  questions: PreviousNextQuestion[];
} {
  const { numQuestions, maxNumberRange } = config;

  const maxBaseNumber = Math.pow(10, maxNumberRange) - 2; // -2 to avoid next going out of range
  const minBaseNumber = 1; // avoid 0 and negatives

  const questions: PreviousNextQuestion[] = [];
  const usedNumbers = new Set<number>();

  while (questions.length < numQuestions) {
    const number =
      Math.floor(Math.random() * (maxBaseNumber - minBaseNumber + 1)) +
      minBaseNumber;

    if (usedNumbers.has(number)) continue;

    usedNumbers.add(number);

    questions.push({
      number,
      previous: number - 1,
      next: number + 1,
    });
  }

  return {
    questions,
  };
}
