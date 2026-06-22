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

// Helper to generate a random number of an EXACT digit length
function generateExactLengthNumber(digits: number, minFirstDigit = 1): number {
  let str = (
    Math.floor(Math.random() * (10 - minFirstDigit)) + minFirstDigit
  ).toString();
  for (let i = 1; i < digits; i++) {
    str += Math.floor(Math.random() * 10).toString();
  }
  return parseInt(str, 10);
}

export function generateVerticalOperation(
  config: VerticalOperationsConfig,
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

  // Determine operation counts
  let opCounts: Record<Operation, number> = {
    Addition: 0,
    Subtraction: 0,
    Multiplication: 0,
    Division: 0,
  };

  if (config.operationCounts) {
    // NEW: Use per-operation counts
    opCounts = config.operationCounts;
  } else if (config.numOperations) {
    // LEGACY: Distribute numOperations evenly
    const perOp = Math.floor(config.numOperations / operationsAllowed.length);
    const remainder = config.numOperations % operationsAllowed.length;
    operationsAllowed.forEach((op, idx) => {
      opCounts[op] = perOp + (idx < remainder ? 1 : 0);
    });
  }

  const questions: VerticalOperationQuestion[] = [];

  // Generate exactly N questions per operation
  for (const operation of operationsAllowed) {
    const targetCount = opCounts[operation] || 0;

    for (let i = 0; i < targetCount; i++) {
      let a = 0;
      let b = 0;

      // ── Operation-specific constraints ──
      // ── ADDITION ──
      if (operation === "Addition") {
        if (allowCarry) {
          a = generateExactLengthNumber(maxNumberRange);
          b = generateExactLengthNumber(maxNumberRange);
        } else {
          // Build digit-by-digit ensuring a_i + b_i <= 9 to prevent carry
          let aStr = "";
          let bStr = "";
          for (let d = 0; d < maxNumberRange; d++) {
            const minVal = d === 0 ? 1 : 0; // Prevent leading zeros
            const a_i = getRandomInt(minVal, 9 - minVal);
            const b_i = getRandomInt(minVal, 9 - a_i);
            aStr += a_i;
            bStr += b_i;
          }
          a = parseInt(aStr, 10);
          b = parseInt(bStr, 10);
        }
      }

      // ── SUBTRACTION ──
      else if (operation === "Subtraction") {
        if (allowBorrow) {
          a = generateExactLengthNumber(maxNumberRange);
          b = generateExactLengthNumber(maxNumberRange);
          if (a < b) [a, b] = [b, a]; // Ensure a is larger
        } else {
          // Build digit-by-digit ensuring a_i >= b_i to prevent borrow
          let aStr = "";
          let bStr = "";
          for (let d = 0; d < maxNumberRange; d++) {
            const minVal = d === 0 ? 1 : 0; // Prevent leading zeros
            const a_i = getRandomInt(minVal, 9);
            const b_i = getRandomInt(minVal, a_i);
            aStr += a_i;
            bStr += b_i;
          }
          a = parseInt(aStr, 10);
          b = parseInt(bStr, 10);
        }
      }

      // ── MULTIPLICATION ──
      else if (operation === "Multiplication") {
        a = generateExactLengthNumber(maxNumberRange);
        if (!allowMultiStepMul || maxNumberRange === 1) {
          b = getRandomInt(2, 9); // 1-digit multiplier
        } else {
          b = generateExactLengthNumber(Math.min(2, maxNumberRange)); // max 2-digit multiplier for primary school
        }
      }

      // ── DIVISION ──
      else if (operation === "Division") {
        // Typically division tests smaller divisors
        b =
          !allowMultiStepDiv || maxNumberRange === 1
            ? getRandomInt(2, 9)
            : getRandomInt(10, 99);

        // We need 'a' to have EXACTLY maxNumberRange digits, and be divisible by 'b'
        const minA =
          maxNumberRange === 1 ? 1 : Math.pow(10, maxNumberRange - 1);
        const maxA = Math.pow(10, maxNumberRange) - 1;

        const minQuotient = Math.ceil(minA / b);
        const maxQuotient = Math.floor(maxA / b);

        if (minQuotient > maxQuotient || maxQuotient < 2) {
          // Fallback if mathematically impossible (e.g. 1-digit divided by 99)
          b = getRandomInt(2, 9);
          a = b * getRandomInt(2, 9);
        } else {
          const quotient = getRandomInt(Math.max(2, minQuotient), maxQuotient);
          a = b * quotient;
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
