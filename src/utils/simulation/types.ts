export type AxisKey =
  | "arithmetic_fluency"
  | "number_sense"
  | "sequential_thinking"
  | "comparison_skill"
  | "visual_matching"
  | "audio_recognition";

export const AXIS_KEYS: AxisKey[] = [
  "arithmetic_fluency",
  "number_sense",
  "sequential_thinking",
  "comparison_skill",
  "visual_matching",
  "audio_recognition",
];

export type Axes = Record<AxisKey, number>; // 0..100 scores
export type Coverage = Record<AxisKey, number>; // 0..1 coverage per axis

export type MiniGameConfig = {
  operation?: "add" | "sub" | "mul" | "div" | "mix";
  numberRange?: [number, number];
  steps?: number; // multi-step flags map here
  carryBorrow?: boolean; // carry/borrow toggle, etc.
  difficulty?: 1 | 2 | 3; // teacher-set difficulty
};

export type EvalMode = "static" | "dynamic";

export type EvalOutput = {
  inferredGrade: number; // ĝ (continuous)
  confidence: number; // 0..1
};

export type Row = Axes & {
  id: number;
  inferredGrade: number;
  confidence: number;
  coverageMean: number;
  mode: EvalMode;
};
