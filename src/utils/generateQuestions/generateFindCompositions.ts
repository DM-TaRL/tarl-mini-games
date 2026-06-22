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
  config: FindCompositionsConfig,
): FindCompositionsQuestion[] {
  const { minNumCompositions, maxNumberRange, operation } = config;

  const questions: FindCompositionsQuestion[] = [];
  const maxAttempts = 1000;
  const numQuestions = 1;

  // Target range by digit count (same as you had)
  const maxValue = Math.pow(10, maxNumberRange) - 1;
  const minValue = maxNumberRange === 1 ? 2 : Math.pow(10, maxNumberRange - 1);

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
      bestSoFar = { target, comps: buildCompositionsForTarget(operation, target, maxNumberRange) };
    }

    if (possibleCount >= minNumCompositions) {
      const all = buildCompositionsForTarget(operation, target, maxNumberRange);
      const picked = shuffleArray(all).slice(0, minNumCompositions);
      questions.push({
        target,
        operation,
        compositions: picked,
        correctAnswerCount: minNumCompositions,
      });
      break;
    } else if (possibleCount >= 2) {
      bestSoFar = { target, comps: buildCompositionsForTarget(operation, target, maxNumberRange) };
    }
  }

  // If still nothing feasible, gracefully reduce the requirement to what's possible
  if (questions.length === 0) {
    const fallback = bestSoFar ?? {
      target: minValue,
      comps: buildCompositionsForTarget(operation, minValue, maxNumberRange),
    };
    const feasible = Math.max(1, fallback.comps.length);
    const required = feasible >= minNumCompositions ? minNumCompositions : feasible;

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
  config: FindCompositionsConfig,
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
  maxNumberRange: number,
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
  maxNumberRange: number,
): [number, number][] {
  const out: [number, number][] = [];
  const maxVal = Math.pow(10, maxNumberRange) - 1;
  const MAX_PAIRS = 50;

  switch (op) {
    case "Addition": {
      const limit = Math.min(target - 1, MAX_PAIRS);
      const used = new Set<number>();
      while (out.length < limit) {
        const a = getRandomInt(1, target - 1);
        if (!used.has(a)) {
          used.add(a);
          out.push([a, target - a]);
        }
      }
      return out;
    }

    case "Subtraction": {
      const limit = Math.min(maxVal - target, MAX_PAIRS);
      const used = new Set<number>();
      while (out.length < limit) {
        const a = getRandomInt(target + 1, Math.max(target + 1, Math.min(target + 1000, maxVal)));
        if (!used.has(a)) {
          used.add(a);
          out.push([a, a - target]);
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
        out.push([a, b]);
        if (a !== b) out.push([b, a]);
      }
      return out;
    }

    case "Division": {
      const maxDivisor = Math.min(maxVal, 20);
      for (let b = 2; b <= maxDivisor; b++) {
        const a = target * b;
        if (!Number.isInteger(a)) continue;
        out.push([a, b]);
      }
      return out;
    }
  }
}

function operandDigitLimit(
  op: Operation,
  target: number,
  maxNumberRange: number,
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
  maxNumberRange: number,
): number {
  const maxVal = Math.pow(10, maxNumberRange) - 1;

  switch (op) {
    case "Addition":
      return Math.max(0, target - 1); // (1..target-1)

    case "Subtraction":
      return Math.max(0, maxVal - (target + 1) + 1); // from a=target+1..maxVal

    case "Multiplication": {
      if (target <= 0) return 0;
      let c = 0;
      const lim = Math.floor(Math.sqrt(target));
      for (let a = 1; a <= lim; a++) {
        if (target % a) continue;
        const b = target / a;
        c += a === b ? 1 : 2;
      }
      return c;
    }

    case "Division": {
      return Math.min(maxVal, 20) - 1;
    }
  }
}
