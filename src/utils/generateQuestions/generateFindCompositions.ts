import { FindCompositionsConfig, Operation } from "../../types/mini-game-types";
import { getRandomInt, shuffleArray } from "../utils";

export interface FindCompositionsQuestion {
  target: number;
  operation: Operation;
  compositions: [number, number][]; // list of valid operand pairs that satisfy the operation
  correctAnswerCount: number;
}

export function applyOperation(a: number, b: number, op: Operation): number {
  switch (op) {
    case "Addition":
      return a + b;
    case "Subtraction":
      return a - b;
    case "Multiplication":
      return a * b;
    case "Division":
      return b !== 0 ? a / b : -1; // Avoid division by 0
    default:
      return -1;
  }
}

function isValid(op: Operation, a: number, b: number, target: number): boolean {
  if (op === "Division" && b === 0) return false;
  return applyOperation(a, b, op) === target;
}

export function generateFindCompositions(
  config: FindCompositionsConfig
): FindCompositionsQuestion[] {
  const { minNumCompositions, maxNumberRange, operation } = config;
  const questions: FindCompositionsQuestion[] = [];
  const maxAttempts = 50;
  let attempts = 0;

  // Calculate the actual numeric range based on digit count
  const maxValue = Math.pow(10, maxNumberRange) - 1;
  const minValue = Math.pow(10, maxNumberRange - 1);

  while (questions.length < 5 && attempts < maxAttempts) {
    attempts++;
    const target = getRandomInt(minValue, maxValue);
    const compositions: [number, number][] = [];

    // Operation-specific generation that respects digit count
    switch (operation) {
      case "Addition":
        // Generate pairs where both numbers have <= maxNumberRange digits
        for (let a = 1; a < target; a++) {
          const b = target - a;
          if (
            a.toString().length <= maxNumberRange &&
            b.toString().length <= maxNumberRange
          ) {
            compositions.push([a, b]);
          }
        }
        break;

      case "Subtraction":
        // Generate pairs where result is positive and respects digit count
        for (let a = target; a <= maxValue; a++) {
          const b = a - target;
          if (b.toString().length <= maxNumberRange) {
            compositions.push([a, b]);
          }
        }
        break;

      case "Multiplication":
        // Find factors respecting digit count
        for (let a = 1; a <= Math.sqrt(target); a++) {
          if (target % a === 0) {
            const b = target / a;
            if (
              a.toString().length <= maxNumberRange &&
              b.toString().length <= maxNumberRange
            ) {
              compositions.push([a, b]);
              if (a !== b) {
                compositions.push([b, a]);
              }
            }
          }
        }
        break;

      case "Division":
        // Generate divisible pairs respecting digit count
        for (let b = 1; b <= maxValue; b++) {
          const a = target * b;
          if (a <= maxValue) {
            compositions.push([a, b]);
          }
        }
        break;
    }

    if (compositions.length >= minNumCompositions) {
      questions.push({
        target,
        operation,
        compositions: shuffleArray(compositions).slice(0, minNumCompositions),
        correctAnswerCount: minNumCompositions,
      });
    }
  }

  return questions;
}
