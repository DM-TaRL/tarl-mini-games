import data from "../../config/mini-games-configs/choice-questions.json";
import { ChooseAnswerConfig, Operation } from "../../types/mini-game-types";
import { shuffleArray } from "../utils";

// We will make the texts audio readable later (must do)
interface ChooseAnswerQuestion {
  id: string;
  text: {
    en: string;
    fr: string;
    ar: string;
  };
  options: {
    text: string;
    correct: boolean;
  }[];
}

export function generateChooseAnswer(
  config: ChooseAnswerConfig
): ChooseAnswerQuestion[] {
  const { numOptions, maxNumberRange, operationsAllowed, numQuestions } =
    config;

  const filtered = data.questions.filter((q) => {
    const matchesOperation =
      Array.isArray(q.operationsInOptions) &&
      q.operationsInOptions.some((op: Operation) =>
        operationsAllowed.includes(op)
      );

    const enoughOptions =
      Array.isArray(q.options) && q.options.length >= numOptions;

    const numbersWithinRange =
      Array.isArray(q.numbersInOptions) &&
      q.numbersInOptions.every(
        (n: number) =>
          typeof n === "number" && n.toString().length <= maxNumberRange
      );

    return matchesOperation && enoughOptions && numbersWithinRange;
  });

  const questions = shuffleArray(filtered)
    .slice(0, numQuestions)
    .map((q, index) => ({
      id: `q${index + 1}`,
      text: q.text,
      options: shuffleArray([
        q.options.find((opt) => opt.correct),
        ...shuffleArray(q.options.filter((opt) => !opt.correct)).slice(
          0,
          numOptions - 1
        ),
      ]).filter(Boolean),
    }));

  return questions;
}
