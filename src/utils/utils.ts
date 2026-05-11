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
    find_compositions: { fast: 120000, medium: 250000 },
    vertical_operations: { fast: 450000, medium: 900000 },
    compare_numbers: { fast: 10000, medium: 20000 },
    what_number_do_you_hear: { fast: 10000, medium: 20000 },
    read_number_aloud: { fast: 10000, medium: 20000 },
    write_number_in_letters: { fast: 150000, medium: 300000 },
    decompose_number: { fast: 150000, medium: 300000 },
    identify_place_value: { fast: 150000, medium: 300000 },
    order_numbers: { fast: 150000, medium: 300000 },
    tap_matching_pairs: { fast: 60000, medium: 120000 },
    find_previous_next_number: { fast: 60000, medium: 120000 },
    choose_answer: { fast: 10000, medium: 20000 },
    multi_step_problem: { fast: 750000, medium: 1500000 },
  };

  const thresholds = gameThresholds[gameType] || defaultThresholds;

  if (ms < thresholds.fast) return "fast";
  if (ms < thresholds.medium) return "medium";
  return "slow";
}
