import { WriteNumberInLettersConfig } from "../../types/mini-game-types";
import numberWords from "../../config/mini-games-configs/numbers-letters.json";

interface WriteNumberInLettersQuestion {
  number: number;
  correctWords: string[];
}

export function generateWriteNumberInLetters(
  config: WriteNumberInLettersConfig,
  language: "ar" | "fr" | "en" = "ar"
): { questions: WriteNumberInLettersQuestion[] } {
  const { numQuestions, maxNumberRange } = config;

  const minValue = maxNumberRange === 1 ? 1 : Math.pow(10, maxNumberRange - 1);
  const maxValue = Math.pow(10, maxNumberRange) - 1;

  const eligible = numberWords.numbers.filter(
    (entry) =>
      entry.number >= minValue &&
      entry.number <= maxValue &&
      entry.answer[language]
  );

  const selected = eligible
    .sort(() => 0.5 - Math.random())
    .slice(0, numQuestions);

  function tokenizeWords(answer: string): string[] {
    // Normalize extra spaces
    const normalized = answer.replace(/\s+/g, " ").trim();

    // Split on space while preserving "و" as a standalone token only when it's a conjunction
    const parts = normalized.split(" ");

    const result: string[] = [];

    for (let word of parts) {
      // If the word starts with "و" and is longer than one letter, split the "و" as separate token
      if (word.startsWith("و") && word.length > 1) {
        result.push("و", word.slice(1));
      } else {
        result.push(word);
      }
    }

    return result;
  }

  return {
    questions: selected.map((entry) => ({
      number: entry.number,
      correctWords: tokenizeWords(entry.answer[language]),
    })),
  };
}
