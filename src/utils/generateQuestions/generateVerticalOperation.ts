import {
  VerticalOperationsConfig,
  Operation,
} from "../../types/mini-game-types";
import { shuffleArray, getRandomInt } from "../utils";

export interface VerticalOperationQuestion {
  id: string;
  operand1: number;
  operand2: number;
  operation: Operation;
  correctAnswer: number;
}

function applyOperation(a: number, b: number, operation: Operation): number {
  switch (operation) {
    case "Addition":
      return a + b;
    case "Subtraction":
      return a - b;
    case "Multiplication":
      return a * b;
    case "Division":
      return parseFloat((a / b).toFixed(2)); // may result in decimal
    default:
      throw new Error("Unsupported operation: " + operation);
  }
}

export function generateVerticalOperation(
  config: VerticalOperationsConfig
): VerticalOperationQuestion[] {
  const { numOperations, maxNumberRange, operationsAllowed } = config;

  const questions: VerticalOperationQuestion[] = [];

  while (questions.length < numOperations) {
    const operation =
      operationsAllowed[Math.floor(Math.random() * operationsAllowed.length)];

    const max = Math.pow(10, maxNumberRange) - 1;
    const min = operation === "Division" ? 1 : 0;

    let a = getRandomInt(min, max);
    let b = getRandomInt(min, max);

    // Avoid division by 0 and ensure divisibility for clean division
    if (operation === "Division") {
      b = Math.max(1, b); // never 0
      a = a - (a % b); // make divisible
    }

    // Subtraction: ensure positive result
    if (operation === "Subtraction" && b > a) {
      [a, b] = [b, a];
    }

    const correctAnswer = applyOperation(a, b, operation);

    questions.push({
      id: `q${questions.length + 1}`,
      operand1: a,
      operand2: b,
      operation,
      correctAnswer,
    });
  }

  return shuffleArray(questions);
}
