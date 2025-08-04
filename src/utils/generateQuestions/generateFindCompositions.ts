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

export function generateFindCompositions(
  config: FindCompositionsConfig
): FindCompositionsQuestion[] {
  const { minNumCompositions, maxNumberRange, operation } = config;
  const questions: FindCompositionsQuestion[] = [];
  const maxAttempts = 50;
  let attempts = 0;
  const seenTargets = new Set<number>();

  // Calculate the actual numeric range based on digit count
  const maxValue = Math.pow(10, maxNumberRange) - 1;
  const minValue = Math.pow(10, maxNumberRange - 1);

  const numQuestions = 1;
  while (questions.length < numQuestions && attempts < maxAttempts) {
    attempts++;
    const compositions: [number, number][] = [];
    let target: number;

    // Operation-specific generation that respects digit count
    switch (operation) {
      case "Addition":
        // Generate pairs where both numbers have <= maxNumberRange digits
        target = getRandomInt(minValue, maxValue);
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
        target = getRandomInt(minValue, maxValue);
        for (let a = target; a <= maxValue; a++) {
          const b = a - target;
          if (b.toString().length <= maxNumberRange) {
            compositions.push([a, b]);
          }
        }
        break;

      case "Multiplication":
        // Find factors respecting digit count
        target = getRandomInt(minValue, maxValue);
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
        for (let b = 1; b <= maxValue; b++) {
          for (let a = b; a <= maxValue; a++) {
            if (a % b === 0) {
              const t = a / b;
              if (
                t >= minValue &&
                t <= maxValue &&
                a.toString().length <= maxNumberRange &&
                b.toString().length <= maxNumberRange
              ) {
                compositions.push([a, b]);
              }
            }
          }
        }

        if (compositions.length >= minNumCompositions) {
          // Collect all valid integer targets
          const validTargets = Array.from(
            new Set(
              compositions
                .map(([a, b]) => a / b)
                .filter((t) => Number.isInteger(t))
            )
          ).filter((t) => !seenTargets.has(t));

          if (validTargets.length === 0) continue;

          // Pick a random integer target
          target =
            validTargets[Math.floor(Math.random() * validTargets.length)];
          seenTargets.add(target);

          questions.push({
            target,
            operation,
            compositions: shuffleArray(
              compositions.filter(([x, y]) => x / y === target)
            ).slice(0, minNumCompositions),
            correctAnswerCount: minNumCompositions,
          });
        }
        continue;
    }

    if (seenTargets.has(target)) continue;
    seenTargets.add(target);

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

export function validateFindCompositionsParams(
  config: FindCompositionsConfig
): { valid: boolean; reason?: string; key?: string } {
  const { operation, maxNumberRange, minNumCompositions } = config;

  const roughMax = {
    Addition: 8,
    Subtraction: 6,
    Multiplication: maxNumberRange === 1 ? 3 : 6,
    Division: maxNumberRange === 1 ? 2 : 5,
  }[operation];

  if (minNumCompositions > roughMax) {
    return {
      valid: false,
      reason: `عدد التركيبات كبير جدًا (${minNumCompositions}) للعملية ${operation} والمدى ${maxNumberRange}. الحد الأقصى التقريبي هو ${roughMax}`,
      key: "minNumCompositions",
    };
  }

  return { valid: true };
}

export function getMaxCompositions(
  operation: Operation,
  maxNumberRange: number
): number {
  switch (operation) {
    case "Addition":
      return 8;
    case "Subtraction":
      return 6;
    case "Multiplication":
      return maxNumberRange === 1 ? 3 : 6;
    case "Division":
      return maxNumberRange === 1 ? 2 : 5;
    default:
      return 5;
  }
}
