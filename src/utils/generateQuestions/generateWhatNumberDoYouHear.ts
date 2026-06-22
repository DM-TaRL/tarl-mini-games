import {
  WhatNumberDoYouHearConfig,
  LanguageCode,
} from "../../types/mini-game-types";
import numberAudioLinksRaw from "../../config/mini-games-configs/number-audio-links.json";

const numberAudioLinks = numberAudioLinksRaw as Record<
  string,
  Record<string, string>
>;

interface AudioQuestion {
  audioUrl: string;
  correctAnswer: number;
  options: number[];
}

// Helper to generate a random number of a specific digit length
function generateRandomDistractor(
  digitCount: number,
  avoidNumbers: number[],
): number {
  const min = digitCount === 1 ? 0 : Math.pow(10, digitCount - 1);
  const max = Math.pow(10, digitCount) - 1;

  let distractor;
  do {
    distractor = Math.floor(Math.random() * (max - min + 1)) + min;
  } while (avoidNumbers.includes(distractor));

  return distractor;
}

export function generateWhatNumberDoYouHear(
  config: WhatNumberDoYouHearConfig,
  language: LanguageCode = "ar",
): AudioQuestion[] {
  const numQuestions = config.numQuestions;
  const targetDigits = config.maxNumberRange;

  const questions: AudioQuestion[] = [];

  // 1. Get ONLY the numbers we actually have audio for in the selected language
  const availableKeys = Object.keys(numberAudioLinks)
    .map(Number)
    .filter((n) => numberAudioLinks[n]?.[language]);

  // 2. Group the available numbers into buckets by their string length (number of digits)
  const buckets: Record<number, number[]> = {};
  for (const n of availableKeys) {
    const len = String(n).length;
    if (!buckets[len]) buckets[len] = [];
    buckets[len].push(n);
  }

  // 3. Collect questions starting from the TARGET digit length, stepping down only if we run out of audio files
  let usableCorrectAnswers: number[] = [];
  let currentDigitLevel = targetDigits;

  while (usableCorrectAnswers.length < numQuestions && currentDigitLevel > 0) {
    if (buckets[currentDigitLevel]) {
      // Shuffle the bucket to ensure variety
      const shuffledBucket = buckets[currentDigitLevel].sort(
        () => Math.random() - 0.5,
      );

      const needed = numQuestions - usableCorrectAnswers.length;
      usableCorrectAnswers.push(...shuffledBucket.slice(0, needed));
    }
    // If we still need more questions, step down to the next digit length
    currentDigitLevel--;
  }

  // Final shuffle so questions aren't strictly ordered by length if a fallback was used
  usableCorrectAnswers = usableCorrectAnswers.sort(() => Math.random() - 0.5);

  // 4. Generate the options (distractors) safely
  for (const correctNumber of usableCorrectAnswers) {
    const audioUrl = numberAudioLinks[correctNumber][language];
    const digitCount = String(correctNumber).length;

    // Generate two random distractors of the EXACT same digit length as the correct answer
    const distractor1 = generateRandomDistractor(digitCount, [correctNumber]);
    const distractor2 = generateRandomDistractor(digitCount, [
      correctNumber,
      distractor1,
    ]);

    const finalOptions = [distractor1, distractor2, correctNumber].sort(
      () => Math.random() - 0.5,
    );

    questions.push({
      audioUrl,
      correctAnswer: correctNumber,
      options: finalOptions,
    });
  }

  return questions;
}
