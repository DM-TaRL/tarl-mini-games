import { TapMatchingPairsConfig } from "../../types/mini-game-types";
import allPairs from "../../config/mini-games-configs/pairs.json";

type Language = "ar" | "fr" | "en";

export interface TapMatchingPairQuestion {
  id: string; // unique id to distinguish items
  display: string; // what to show (number or word)
  matchWith: string; // value of its pair
  correct: boolean; // always true for now
}

export interface TapMatchingPairsQuestionSet {
  pairs: TapMatchingPairQuestion[];
  correctAnswers: { id1: string; id2: string }[]; // valid pairings for validation
}

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

export function generateTapMatchingPairs(
  config: TapMatchingPairsConfig,
  language: Language = "ar"
): TapMatchingPairsQuestionSet {
  const { numPairs, maxNumberRange } = config;

  // 1. Filter valid number-word pairs within range
  const validPairs = allPairs.pairs.filter(
    (pair) => pair.number <= maxNumberRange
  );

  if (validPairs.length < numPairs) {
    throw new Error(`Not enough valid pairs in range 0-${maxNumberRange}`);
  }

  // 2. Randomly pick `numPairs` entries
  const selected = shuffle(validPairs).slice(0, numPairs);

  const gameItems: TapMatchingPairQuestion[] = [];
  const correctAnswers: { id1: string; id2: string }[] = [];

  selected.forEach((pair, index) => {
    const numberId = `n_${index}`;
    const wordId = `w_${index}`;

    const numberItem: TapMatchingPairQuestion = {
      id: numberId,
      display: String(pair.number),
      matchWith: pair.match[language],
      correct: true,
    };

    const wordItem: TapMatchingPairQuestion = {
      id: wordId,
      display: pair.match[language],
      matchWith: String(pair.number),
      correct: true,
    };

    gameItems.push(numberItem, wordItem);
    correctAnswers.push({ id1: numberId, id2: wordId });
  });

  return {
    pairs: shuffle(gameItems),
    correctAnswers,
  };
}
