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
  const maxAttempts = 60; // a few more tries so we rarely need to relax
  const numQuestions = 1;

  // Target range by digit count (same as you had)
  const maxValue = Math.pow(10, maxNumberRange) - 1;
  const minValue = Math.pow(10, maxNumberRange - 1);

  // keep attempting until we produce one feasible round
  let attempts = 0;
  let bestSoFar: { target: number; comps: [number, number][] } | null = null;

  while (questions.length < numQuestions && attempts < maxAttempts) {
    attempts++;

    // Pick a target uniformly in the digit range
    const target =
      minValue <= maxValue ? getRandomInt(minValue, maxValue) : maxValue;

    const possibleCount = countCompositions(operation, target, maxNumberRange);

    // Track the best target we've seen so far (largest number of compositions)
    if (!bestSoFar || possibleCount > bestSoFar.comps.length) {
      bestSoFar = {
        target,
        comps: buildCompositionsForTarget(operation, target, maxNumberRange),
      };
    }

    const all = buildCompositionsForTarget(operation, target, maxNumberRange);

    if (possibleCount >= minNumCompositions) {
      const picked = shuffleArray(all).slice(0, minNumCompositions);
      questions.push({
        target,
        operation,
        compositions: picked,
        correctAnswerCount: minNumCompositions,
      });
      break;
    } else if (possibleCount >= 2) {
      // not enough for 3, but at least 2 are possible -> require 2
      const picked = shuffleArray(all).slice(0, 2);
      questions.push({
        target,
        operation,
        compositions: picked,
        correctAnswerCount: 2,
      });
      break;
    }
  }

  // If still nothing feasible, gracefully reduce the requirement to what's possible
  if (questions.length === 0) {
    const fallback = bestSoFar ?? {
      target: minValue,
      comps: buildCompositionsForTarget(operation, minValue, maxNumberRange),
    };
    const feasible = Math.max(1, fallback.comps.length);
    const required = feasible >= 2 ? 2 : feasible >= 1 ? 1 : 0;

    questions.push({
      target: fallback.target,
      operation,
      compositions: shuffleArray(fallback.comps).slice(0, required),
      correctAnswerCount: Math.max(1, required),
    });
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

function buildCompositionsForTarget(
  op: Operation,
  target: number,
  maxNumberRange: number
): [number, number][] {
  const out: [number, number][] = [];
  const maxVal = Math.pow(10, maxNumberRange) - 1;
  const limit = operandDigitLimit(op, target, maxNumberRange); // NEW

  switch (op) {
    case "Addition": {
      for (let a = 1; a < target; a++) {
        const b = target - a;
        if (b < 1) continue;
        if (String(a).length <= limit && String(b).length <= limit) {
          out.push([a, b]); // ordered
        }
      }
      return out;
    }

    case "Subtraction": {
      for (let a = target; a <= maxVal; a++) {
        const b = a - target; // >=0
        if (String(b).length <= limit) {
          out.push([a, b]); // ordered
        }
      }
      return out;
    }

    case "Multiplication": {
      if (target <= 0) return out;
      const lim = Math.floor(Math.sqrt(target));
      for (let a = 1; a <= lim; a++) {
        if (target % a) continue;
        const b = target / a;
        if (String(a).length <= limit && String(b).length <= limit) {
          out.push([a, b]);
          if (a !== b) out.push([b, a]); // ordered both ways
        }
      }
      return out;
    }

    case "Division": {
      const maxValB = Math.pow(10, maxNumberRange) - 1;
      for (let b = 1; b <= maxValB; b++) {
        const a = target * b;
        if (!Number.isInteger(a) || a < 0) continue;
        if (String(a).length <= limit && String(b).length <= limit) {
          out.push([a, b]); // ordered
        }
      }
      return out;
    }
  }
}

function operandDigitLimit(
  op: Operation,
  target: number,
  maxNumberRange: number
): number {
  const tlen = Math.max(1, String(Math.abs(target)).length);
  switch (op) {
    case "Addition":
    case "Subtraction":
      return tlen;
    case "Multiplication":
      return Math.ceil(tlen / 2);
    case "Division":
      // keep simple; you can refine later to match your divisor/dividend UI
      return Math.ceil(tlen / 2);
    default:
      return maxNumberRange;
  }
}

// Count how many compositions exist for (operation, target)
// under your digit-count constraint (maxNumberRange digits per operand).
// IMPORTANT: Addition & Multiplication are treated as ORDERED here,
// to match our original generator which pushes [a,b] and [b,a].
function countCompositions(
  op: Operation,
  target: number,
  maxNumberRange: number
): number {
  const maxVal = Math.pow(10, maxNumberRange) - 1;
  const limit = operandDigitLimit(op, target, maxNumberRange); // NEW

  switch (op) {
    case "Addition": {
      let c = 0;
      for (let a = 1; a < target; a++) {
        const b = target - a;
        if (b < 1) continue;
        if (String(a).length <= limit && String(b).length <= limit) c++;
      }
      return c;
    }

    case "Subtraction": {
      let c = 0;
      for (let a = target; a <= maxVal; a++) {
        const b = a - target;
        if (String(b).length <= limit) c++;
      }
      return c;
    }

    case "Multiplication": {
      if (target <= 0) return 0;
      let c = 0;
      const lim = Math.floor(Math.sqrt(target));
      for (let a = 1; a <= lim; a++) {
        if (target % a) continue;
        const b = target / a;
        if (String(a).length <= limit && String(b).length <= limit) {
          c += a === b ? 1 : 2; // ordered
        }
      }
      return c;
    }

    case "Division": {
      if (target < 0) return 0;
      let c = 0;
      const maxValB = Math.pow(10, maxNumberRange) - 1;
      for (let b = 1; b <= maxValB; b++) {
        const a = target * b;
        if (!Number.isInteger(a) || a < 0) continue;
        if (String(a).length <= limit && String(b).length <= limit) c++;
      }
      return c;
    }
  }
}
