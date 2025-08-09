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
  const {
    numOperations,
    maxNumberRange,
    operationsAllowed,
    allowCarry = true,
    allowBorrow = true,
    allowMultiStepMul = true,
    allowMultiStepDiv = true,
  } = config;

  const questions: VerticalOperationQuestion[] = [];

  while (questions.length < numOperations) {
    const operation =
      operationsAllowed[Math.floor(Math.random() * operationsAllowed.length)];

    const max = Math.pow(10, maxNumberRange) - 1;
    const min = operation === "Division" ? 1 : 0;

    let a = getRandomInt(min, max);
    let b = getRandomInt(min, max);

    if (operation === "Addition" && !allowCarry) {
      a = a - (a % 10); // force no carry from units
      b = Math.min(9, b); // single-digit b to avoid carry
    }

    if (operation === "Subtraction") {
      // Make sure a >= b to avoid negative results
      if (b > a) [a, b] = [b, a];

      // Additional check for no borrow if required
      if (!allowBorrow) {
        while (!digitsSafeSubtract(a, b)) {
          a = getRandomInt(min, max);
          b = getRandomInt(min, a); // ensure a >= b
        }
      }
    }

    if (operation === "Multiplication" && !allowMultiStepMul) {
      b = getRandomInt(1, 9); // single-digit multiplier only
    }

    if (operation === "Division") {
      b = Math.max(1, b); // no zero division
      if (!allowMultiStepDiv) {
        a = b * getRandomInt(1, Math.floor(max / b)); // exact division
      } else {
        a = getRandomInt(min, max);
        a = a - (a % b); // make divisible
      }
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

// Helper: checks no digit in b is greater than a for subtraction (avoid borrow)
function digitsSafeSubtract(a: number, b: number): boolean {
  const aStr = a.toString().padStart(5, "0");
  const bStr = b.toString().padStart(5, "0");
  for (let i = aStr.length - 1; i >= 0; i--) {
    if (+bStr[i] > +aStr[i]) return false;
  }
  return true;
}
