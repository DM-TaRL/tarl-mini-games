import { ReadNumberAloudConfig } from "../../types/mini-game-types";

export type ReadNumberItem = {
  id: string;
  correctAnswer: number;
  numeral: string; // e.g., "37" or "٣٧"
  language: "ar" | "fr";
};

export function generateReadNumberAloudSet(
  config: ReadNumberAloudConfig,
  language: "ar" | "fr"
): ReadNumberItem[] {
  const numQ = Math.max(1, Number(config?.numQuestions ?? 6));

  const digits = Math.max(1, Math.min(6, Number(config?.maxNumberRange ?? 2)));
  const max = Math.pow(10, digits) - 1; // e.g., 6 → 999999
  const min = 0; // allow 0; change to 10^(d-1) if we want *exact* digits

  const used = new Set<number>();
  const out: ReadNumberItem[] = [];
  while (out.length < numQ) {
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    if (used.has(n)) continue;
    used.add(n);
    out.push({
      id: `rna_${out.length}_${Date.now()}`,
      correctAnswer: n,
      numeral: String(n),
      language,
    });
  }
  return out;
}

function toArabicDigits(n: number): string {
  const map: Record<string, string> = {
    "0": "٠",
    "1": "١",
    "2": "٢",
    "3": "٣",
    "4": "٤",
    "5": "٥",
    "6": "٦",
    "7": "٧",
    "8": "٨",
    "9": "٩",
  };
  return String(n)
    .split("")
    .map((d) => map[d] ?? d)
    .join("");
}
