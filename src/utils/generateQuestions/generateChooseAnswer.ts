import data from "../../config/mini-games-configs/choice-questions.json";
import { ChooseAnswerConfig, Operation } from "../../types/mini-game-types";
import { generateQuestionsFromTemplates } from "../generateChoiceFromTemplates";
import { shuffleArray } from "../utils";

type LangText = { ar: string; fr: string; en: string };

type ChoiceOption = { text: string; correct: boolean };

// We will make the texts audio readable later (must do)
interface ChooseAnswerQuestion {
  id: string;
  text: LangText;
  options: ChoiceOption[];
}

type ChoiceQuestionSource = {
  text: LangText;
  numbersInOptions: number[];
  operationsInOptions: Operation[];
  options: ChoiceOption[];
};

export function generateChooseAnswer(
  config: ChooseAnswerConfig,
): ChooseAnswerQuestion[] {
  const { numOptions, maxNumberRange, operationsAllowed, numQuestions } =
    config;

  const digits = (n: number): number =>
    String(Math.abs(n)).replace(".", "").length;

  // 1) Build a pool: JSON + generated
  const generated: ChoiceQuestionSource[] = generateQuestionsFromTemplates({
    maxDigits: maxNumberRange,
    operationsAllowed,
    numOptions,
    count: Math.max(40, numQuestions * 5), // generate enough to survive strict filtering
  });

  const staticQs = data.questions as unknown as ChoiceQuestionSource[];
  const pool: ChoiceQuestionSource[] = [...staticQs, ...generated];

  // 2) Validate basics: correct operations, enough options, and NO numbers exceed the max
  const validPool = pool.filter((q: any) => {
    const matchesOperation =
      Array.isArray(q.operationsInOptions) &&
      q.operationsInOptions.some((op: Operation) =>
        operationsAllowed.includes(op),
      );

    const enoughOptions =
      Array.isArray(q.options) && q.options.length >= numOptions;

    const numbersWithinRange =
      Array.isArray(q.numbersInOptions) &&
      q.numbersInOptions.every(
        (n: unknown) =>
          typeof n === "number" && digits(n as number) <= maxNumberRange,
      );

    return matchesOperation && enoughOptions && numbersWithinRange;
  });

  // 3) STRICT Check: Guarantee the question actually hits the requested difficulty
  const strictPool = validPool.filter((q: any) =>
    q.numbersInOptions.some(
      (n: unknown) => digits(n as number) === maxNumberRange,
    ),
  );

  // 4) Safe Fallback: Use strict pool if we have enough, otherwise fallback to valid pool
  const finalPool = strictPool.length >= numQuestions ? strictPool : validPool;

  // 5) Sample + normalize to exactly one correct option
  const questions: ChooseAnswerQuestion[] = shuffleArray(finalPool)
    .slice(0, numQuestions)
    .map((q, index) => {
      const correctOptions = q.options.filter((opt) => opt.correct);
      const correct = shuffleArray(correctOptions)[0]; // ChoiceOption | undefined

      const wrongs = shuffleArray(
        q.options.filter((opt) => !opt.correct),
      ).slice(0, numOptions - 1);

      const finalOptions: ChoiceOption[] = correct
        ? shuffleArray([correct, ...wrongs])
        : shuffleArray(q.options).slice(0, numOptions);

      return {
        id: `q${index + 1}_${Date.now()}`,
        text: q.text,
        options: finalOptions,
      };
    });

  return questions;
}
