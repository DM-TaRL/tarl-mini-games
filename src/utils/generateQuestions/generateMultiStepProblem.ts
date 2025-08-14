// tarl-mini-games/src/generators/generateMultiStepProblem.ts
import problemsData from "../../config/mini-games-configs/problems.json";
import type {
  MultiStepProblemConfig,
  Operation,
} from "../../types/mini-game-types";

export type MultiStepStep = {
  operation: Operation;
  operand1: number;
  operand2: number;
  correctAnswer: number;
};

export type MultiStepQuestion = {
  id: string;
  text: string;
  steps: MultiStepStep[];
};

export function evalStep(op: Operation, a: number, b: number): number {
  switch (op) {
    case "Addition":
      return a + b;
    case "Subtraction":
      return a - b;
    case "Multiplication":
      return a * b;
    case "Division":
      return Math.floor(a / b);
    default:
      return NaN as any;
  }
}

function normalizeProblems(language: "ar" | "fr" | "en"): MultiStepQuestion[] {
  const raw = (problemsData as any).problems ?? [];
  // Flatten any nested { problems: [...] } blocks that exist in the JSON
  const flat: any[] = [];
  for (const p of raw) {
    if (Array.isArray(p?.problems)) flat.push(...p.problems);
    else flat.push(p);
  }

  return flat.map((p, idx) => {
    const steps: MultiStepStep[] = (p.operations || []).map((s: any) => ({
      operation: s.operation,
      operand1: Number(s.operand1),
      operand2: Number(s.operand2),
      correctAnswer: evalStep(
        s.operation,
        Number(s.operand1),
        Number(s.operand2)
      ),
    }));
    return {
      id: `msp_${idx}_${Date.now()}`,
      text: p.text?.[language] || p.text?.en || "",
      steps,
    };
  });
}

export function generateMultiStepProblem(
  config: MultiStepProblemConfig,
  language: "ar" | "fr" | "en"
): { questions: MultiStepQuestion[] } {
  const all = normalizeProblems(language);

  // Filter steps to allowed ops + cap number of steps per problem
  const filtered = all
    .map((q) => ({
      ...q,
      steps: q.steps
        .filter((s) => config.operationsAllowed.includes(s.operation))
        .slice(0, config.numSteps),
    }))
    .filter((q) => q.steps.length > 0);

  // Choose N problems (cycle if not enough)
  const questions: MultiStepQuestion[] = [];
  for (let i = 0; i < config.numQuestions; i++) {
    questions.push(filtered[i % filtered.length]);
  }

  return { questions };
}
