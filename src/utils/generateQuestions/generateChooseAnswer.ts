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
    count: Math.max(30, numQuestions * 5), // generate extra to avoid filtering starvation
  });

  const staticQs = data.questions as unknown as ChoiceQuestionSource[];

  const pool: ChoiceQuestionSource[] = [...staticQs, ...generated];

  // 2) Filter using YOUR same rules
  const filtered = pool.filter((q: any) => {
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

  // 3) Sample + normalize to exactly one correct option (robust)
  const questions: ChooseAnswerQuestion[] = shuffleArray(filtered)
    .slice(0, numQuestions)
    .map((q, index) => {
      const correctOptions = q.options.filter((opt) => opt.correct);
      const correct = shuffleArray(correctOptions)[0]; // ChoiceOption | undefined

      // Fallback safety (shouldn't happen if dataset is valid)
      const wrongs = shuffleArray(
        q.options.filter((opt) => !opt.correct),
      ).slice(0, numOptions - 1);

      const finalOptions: ChoiceOption[] = correct
        ? shuffleArray([correct, ...wrongs])
        : shuffleArray(q.options).slice(0, numOptions);

      return {
        id: `q${index + 1}`,
        text: q.text,
        options: finalOptions,
      };
    });

  return questions;
}
