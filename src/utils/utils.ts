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
