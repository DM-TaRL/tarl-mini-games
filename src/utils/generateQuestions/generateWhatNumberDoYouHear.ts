import {
  WhatNumberDoYouHearConfig,
  LanguageCode,
} from "../../types/mini-game-types";
import numberAudioLinks from "../../config/mini-games-configs/number-audio-links.json";

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

    const optionsPool = availableNumbers.filter((n) => n !== correctNumber);
    const shuffledOptions = optionsPool
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
