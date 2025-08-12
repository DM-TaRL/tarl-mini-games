import { OrderNumbersConfig } from "../../types/mini-game-types";

type OrderDirection = "asc" | "desc";

interface OrderNumbersQuestion {
  id: string;
  numbers: number[];
  correctOrder: number[];
  direction: OrderDirection;
}

export function generateOrderNumbers(
  config: OrderNumbersConfig
): OrderNumbersQuestion[] {
  const questions: OrderNumbersQuestion[] = [];

  for (let i = 0; i < config.numQuestions; i++) {
    const numInSequence = getRandomInt(2, config.maxNumbersInSequence);
    const numbers = generateUniqueNumbers(numInSequence, config.maxNumberRange);

    const direction: OrderDirection = Math.random() < 0.5 ? "asc" : "desc";
    const correctOrder = [...numbers].sort((a, b) =>
      direction === "asc" ? a - b : b - a
    );

    questions.push({
      id: `order_${i + 1}`,
      numbers: shuffleArray(numbers),
      correctOrder,
      direction,
    });
  }

  return questions;
}

function generateUniqueNumbers(count: number, maxDigits: number): number[] {
  const min = Math.pow(10, maxDigits - 1);
  const max = Math.pow(10, maxDigits) - 1;
  const set = new Set<number>();

  while (set.size < count) {
    set.add(getRandomInt(min, max));
  }

  return Array.from(set);
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray<T>(arr: T[]): T[] {
  return arr
    .map((item) => ({ sort: Math.random(), value: item }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}
