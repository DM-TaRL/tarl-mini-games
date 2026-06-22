import { WriteNumberInLettersConfig } from "../../types/mini-game-types";
import numberWords from "../../config/mini-games-configs/numbers-letters.json";

interface WriteNumberInLettersQuestion {
  number: number;
  correctWords: string[];
}

export function generateWriteNumberInLetters(
  config: WriteNumberInLettersConfig,
  language: "ar" | "fr" | "en" = "ar",
): { questions: WriteNumberInLettersQuestion[] } {
  const { numQuestions, maxNumberRange } = config;

  // 1. Group available words by their digit length
  const buckets: Record<number, typeof numberWords.numbers> = {};

  for (const entry of numberWords.numbers) {
    // Ensure the translation exists in the requested language
    if (!entry.answer || !entry.answer[language]) continue;

    const digitCount = String(entry.number).length;
    if (!buckets[digitCount]) buckets[digitCount] = [];
    buckets[digitCount].push(entry);
  }

  const selectedEntries: typeof numberWords.numbers = [];
  let currentDigitLevel = maxNumberRange;

  // 2. Select entries starting from requested difficulty, stepping down if needed to hit the quota
  while (selectedEntries.length < numQuestions && currentDigitLevel > 0) {
    if (buckets[currentDigitLevel]) {
      // Shuffle the bucket so questions aren't always the same
      const shuffledBucket = buckets[currentDigitLevel].sort(
        () => 0.5 - Math.random(),
      );
      const needed = numQuestions - selectedEntries.length;
      selectedEntries.push(...shuffledBucket.slice(0, needed));
    }
    currentDigitLevel--;
  }

  // 3. Fallback check just in case the JSON is completely empty
  if (selectedEntries.length < numQuestions) {
    throw new Error(
      `Not enough valid numbers in numbers-letters.json to fulfill ${numQuestions} questions.`,
    );
  }

  // 4. Final shuffle so they aren't strictly ordered by length if a fallback was used
  const finalSelected = selectedEntries.sort(() => 0.5 - Math.random());

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
    questions: finalSelected.map((entry) => ({
      number: entry.number,
      correctWords: tokenizeWords(entry.answer[language]),
    })),
  };
}
