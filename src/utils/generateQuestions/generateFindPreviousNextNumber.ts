import { FindPreviousNextNumberConfig } from "../../types/mini-game-types";

export interface PreviousNextQuestion {
  number: number; // the central number
  previous: number; // number - 1
  next: number; // number + 1
}

export function generateFindPreviousNextNumber(
  config: FindPreviousNextNumberConfig
): { questions: PreviousNextQuestion[] } {
  const { numQuestions, maxNumberRange } = config;

  // Calculate safe range to prevent overlap
  const maxPossibleQuestions = Math.pow(10, maxNumberRange) - 2;
  if (numQuestions > maxPossibleQuestions) {
    throw new Error(
      `Cannot generate ${numQuestions} unique questions with maxNumberRange ${maxNumberRange}`
    );
  }

  const maxBaseNumber = Math.pow(10, maxNumberRange) - 2; // -2 to avoid next going out of range
  const minBaseNumber = 1; // avoid 0 and negatives

  const questions: PreviousNextQuestion[] = [];
  const usedNumbers = new Set<number>();

  // Create array of all possible numbers for better randomness
  const allPossibleNumbers = Array.from(
    { length: maxBaseNumber - minBaseNumber + 1 },
    (_, i) => minBaseNumber + i
  );

  // Fisher-Yates shuffle for better random distribution
  for (let i = allPossibleNumbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPossibleNumbers[i], allPossibleNumbers[j]] = [
      allPossibleNumbers[j],
      allPossibleNumbers[i],
    ];
  }

  // Take the first numQuestions numbers
  for (let i = 0; i < numQuestions && i < allPossibleNumbers.length; i++) {
    const number = allPossibleNumbers[i];
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
