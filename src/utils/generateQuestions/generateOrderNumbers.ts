import { OrderNumbersConfig } from "../../types/mini-game-types";

type OrderDirection = "asc" | "desc";

interface OrderNumbersQuestion {
  id: string;
  numbers: number[];
  correctOrder: number[];
  direction: OrderDirection;
}

export function generateOrderNumbers(
  config: OrderNumbersConfig,
): OrderNumbersQuestion[] {
  const questions: OrderNumbersQuestion[] = [];

  // Use exactly the sequence length the teacher requested (fallback to 5 if undefined)
  const numInSequence = Math.max(2, config.maxNumbersInSequence ?? 5);

  for (let i = 0; i < config.numQuestions; i++) {
    const numbers = generateUniqueNumbers(numInSequence, config.maxNumberRange);

    const direction: OrderDirection = Math.random() < 0.5 ? "asc" : "desc";
    const correctOrder = [...numbers].sort((a, b) =>
      direction === "asc" ? a - b : b - a,
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
  // Fix the 1-digit bug so it can generate '0'
  const min = maxDigits === 1 ? 0 : Math.pow(10, maxDigits - 1);
  const max = Math.pow(10, maxDigits) - 1;
  const set = new Set<number>();

  // Safeguard: prevent infinite loop if teacher asks for more numbers than exist
  // e.g., asking to sort 15 unique 1-digit numbers (only 10 exist: 0-9)
  const maxPossible = max - min + 1;
  const actualCount = Math.min(count, maxPossible);

  while (set.size < actualCount) {
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
