import { Operation } from "../types/mini-game-types";
import { GeneratedQuestion, templates } from "./choiceQuestionTemplates";

const digits = (n: number): number =>
  String(Math.abs(n)).replace(".", "").length;

function fillTemplate(s: string, nums: Record<string, number>): string {
  return s.replace(/\{(\w+)\}/g, (_, key) => String(nums[key] ?? `{${key}}`));
}

function extractNumbersFromOptions(options: { text: string }[]): number[] {
  const set = new Set<number>();
  for (const opt of options) {
    const found = opt.text.match(/-?\d+/g);
    if (!found) continue;
    for (const x of found) set.add(Number(x));
  }
  return [...set];
}

function inferOpsFromExpressions(exprs: string[]): Operation[] {
  const set = new Set<Operation>();

  for (const s of exprs) {
    if (s.includes("+")) set.add("Addition");
    // careful: "-" appears in negatives, but okay for your dataset style
    if (s.includes("-")) set.add("Subtraction");
    if (s.includes("×") || s.includes("*")) set.add("Multiplication");
    if (s.includes("÷") || s.includes("/")) set.add("Division");
  }

  return [...set];
}

/**
 * Generate extra questions that respect maxDigits + operationsAllowed + numOptions.
 * Generates `count` questions total (best-effort).
 */
export function generateQuestionsFromTemplates(args: {
  maxDigits: number;
  operationsAllowed: Operation[];
  numOptions: number;
  count: number;
}): GeneratedQuestion[] {
  const { maxDigits, operationsAllowed, numOptions, count } = args;
  const out: GeneratedQuestion[] = [];

  // only use templates whose main operation is allowed
  const usable = templates.filter((t) =>
    operationsAllowed.includes(t.operation as Operation),
  );

  if (!usable.length) return out;

  // best-effort generation loop
  let guard = 0;
  while (out.length < count && guard < count * 20) {
    guard++;

    const tpl = usable[Math.floor(Math.random() * usable.length)];
    const nums = tpl.generateNumbers(maxDigits);

    const text = {
      ar: fillTemplate(tpl.templates.ar, nums),
      fr: fillTemplate(tpl.templates.fr, nums),
      en: fillTemplate(tpl.templates.en, nums),
    };

    const correctText = tpl.correctExpression(nums);
    const wrongPool = tpl.generateWrongExpressions(nums, correctText);

    // ensure we have enough wrongs to reach numOptions
    const wrongs = wrongPool
      .filter((w) => w && w !== correctText)
      .slice(0, Math.max(0, numOptions - 1));

    if (wrongs.length < Math.max(0, numOptions - 1)) continue;

    const options = [
      { text: correctText, correct: true },
      ...wrongs.map((w) => ({ text: w, correct: false })),
    ];

    const numbersInOptions = extractNumbersFromOptions(options);

    // keep consistent with your current filter meaning: maxDigits applies to ALL numbers
    if (numbersInOptions.some((n) => digits(n) > maxDigits)) continue;

    const ops = inferOpsFromExpressions(options.map((o) => o.text));
    // guarantee the main op is present
    if (!ops.includes(tpl.operation as Operation))
      ops.push(tpl.operation as Operation);

    out.push({
      text,
      numbersInOptions,
      operationsInOptions: ops,
      options,
    });
  }

  return out;
}
