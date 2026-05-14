import {
  WhatNumberDoYouHearConfig,
  LanguageCode,
} from "../../types/mini-game-types";
import numberAudioLinksRaw from "../../config/mini-games-configs/number-audio-links.json";

const numberAudioLinks = numberAudioLinksRaw as Record<string, Record<string, string>>;

interface AudioQuestion {
  audioUrl: string;
  correctAnswer: number;
  options: number[];
}

export function generateWhatNumberDoYouHear(
  config: WhatNumberDoYouHearConfig,
  language: LanguageCode = "ar"
): AudioQuestion[] {
  const numQuestions = config.numQuestions;
  const maxDigits = config.maxNumberRange;
  const maxNumber = Math.pow(10, maxDigits) - 1;

  const questions: AudioQuestion[] = [];

  const availableNumbers = Array.from(
    { length: maxNumber + 1 },
    (_, i) => i
  ).filter((n) => numberAudioLinks[n]?.[language]);

  // Shuffle the pool to get random non-repeating correct answers
  const shuffled = availableNumbers.sort(() => Math.random() - 0.5);
  const usableCorrectAnswers = shuffled.slice(
    0,
    Math.min(numQuestions, shuffled.length)
  );

  for (const correctNumber of usableCorrectAnswers) {
    const audioUrl = numberAudioLinks[correctNumber][language];

    const digitCount = String(correctNumber).length;
    const rangeMin = digitCount === 1 ? 0 : Math.pow(10, digitCount - 1);
    const rangeMax = Math.pow(10, digitCount) - 1;
    const distractorPool: number[] = [];
    for (let n = rangeMin; n <= rangeMax; n++) {
      if (n !== correctNumber) distractorPool.push(n);
    }
    const shuffledOptions = distractorPool
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    const finalOptions = [...shuffledOptions, correctNumber].sort(
      () => Math.random() - 0.5
    );

    questions.push({
      audioUrl,
      correctAnswer: correctNumber,
      options: finalOptions,
    });
  }

  return questions;
}
