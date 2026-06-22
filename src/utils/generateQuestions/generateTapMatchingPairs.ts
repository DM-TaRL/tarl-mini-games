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
  language: Language = "ar",
): TapMatchingPairsQuestionSet {
  const { numPairs, maxNumberRange } = config;

  // 1. Group available pairs by their digit length
  const buckets: Record<number, typeof allPairs.pairs> = {};

  for (const pair of allPairs.pairs) {
    // Ensure the pair has the requested language translation
    if (!pair.match[language]) continue;

    const digitCount = String(pair.number).length;
    if (!buckets[digitCount]) buckets[digitCount] = [];
    buckets[digitCount].push(pair);
  }

  const selectedPairs: typeof allPairs.pairs = [];
  let currentDigitLevel = maxNumberRange;

  // 2. Select pairs starting from the requested difficulty (digit count) and step down if needed
  while (selectedPairs.length < numPairs && currentDigitLevel > 0) {
    if (buckets[currentDigitLevel]) {
      const shuffledBucket = shuffle(buckets[currentDigitLevel]);
      const needed = numPairs - selectedPairs.length;
      selectedPairs.push(...shuffledBucket.slice(0, needed));
    }
    currentDigitLevel--;
  }

  if (selectedPairs.length < numPairs) {
    throw new Error(
      `Not enough valid pairs for digit range up to ${maxNumberRange}`,
    );
  }

  // 3. Shuffle again so they aren't strictly ordered by length if a fallback was used
  const finalSelected = shuffle(selectedPairs);

  const gameItems: TapMatchingPairQuestion[] = [];
  const correctAnswers: { id1: string; id2: string }[] = [];

  // 4. Map to the expected game format
  finalSelected.forEach((pair, index) => {
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
