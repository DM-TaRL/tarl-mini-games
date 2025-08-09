import { GameType, TimeCategory } from "../types/mini-game-types";

/**
 * Randomly shuffles the elements of an array using Fisher-Yates algorithm.
 * @param array The input array.
 * @returns A new shuffled array.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]; // copy to avoid mutating original
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface Thresholds {
  fast: number;
  medium: number;
}

export function categorizeTime(ms: number, gameType: GameType): TimeCategory {
  const defaultThresholds: Thresholds = {
    fast: 8000,
    medium: 20000,
  };

  const gameThresholds: Record<GameType, Thresholds> = {
    find_compositions: { fast: 50000, medium: 100000 },
    vertical_operations: { fast: 1000000, medium: 5000000 },
    compare_numbers: { fast: 2000, medium: 5000 },
    what_number_do_you_hear: { fast: 2000, medium: 5000 },
    write_number_in_letters: { fast: 10000, medium: 50000 },
    decompose_number: { fast: 10000, medium: 50000 },
    identify_place_value: { fast: 10000, medium: 50000 },
    order_numbers: { fast: 10000, medium: 50000 },
    tap_matching_pairs: { fast: 3000, medium: 6000 },
    find_previous_next_number: { fast: 6000, medium: 10000 },
    choose_answer: { fast: 4000, medium: 10000 },
    multi_step_problem: { fast: 1500000, medium: 3000000 },
    read_number_aloud: { fast: 4000, medium: 10000 },
  };

  const thresholds = gameThresholds[gameType] || defaultThresholds;

  if (ms < thresholds.fast) return "fast";
  if (ms < thresholds.medium) return "medium";
  return "slow";
}
