type Log = {
  isCorrect?: boolean;
  timeSpentMs?: number;
  error_type?: string | null;
  // ...plus per-game fields (question, selected, etc.)
};

type Skill =
  | "number_sense"
  | "arith_fluency"
  | "place_value"
  | "comparison"
  | "sequential_thinking"
  | "audio_recognition";

type SkillFeatures = {
  accuracy: number; // 0..1
  zLatency: number; // z-score vs task norm (0 if no norm yet)
  stability: number; // 1 - CV(latency of correct)
  errSeverity: number; // 0..1 (weighted by archetypes)
};

const ERROR_WEIGHTS: Record<string, number> = {
  place_value: 0.9,
  operation_swap: 0.8,
  sign_error: 0.7,
  reversal: 0.6,
  unknown: 0.4,
};

function zscore(latencies: number[]): number {
  if (!latencies.length) return 0;
  const m = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const v =
    latencies.reduce((a, b) => a + (b - m) * (b - m), 0) /
    (latencies.length || 1);
  const sd = Math.sqrt(v) || 1;
  // return mean z for the session; replace with per-task norm if available
  return (m - 0) / sd;
}

function stabilityOf(correctLatencies: number[]): number {
  if (correctLatencies.length < 2) return 1;
  const m =
    correctLatencies.reduce((a, b) => a + b, 0) / correctLatencies.length;
  const sd = Math.sqrt(
    correctLatencies.reduce((a, b) => a + (b - m) * (b - m), 0) /
      (correctLatencies.length || 1)
  );
  const cv = m ? sd / m : 1;
  return Math.max(0, Math.min(1, 1 - cv)); // 1 - CV
}

// Map mini-games → skills (aligns to §2.2)
const GAME_SKILL: Record<string, Skill> = {
  choose_answer: "number_sense",
  vertical_operations: "arith_fluency",
  identify_place_value: "place_value",
  compare_numbers: "comparison",
  order_numbers: "sequential_thinking",
  tap_matching_pairs: "number_sense",
  find_previous_next_number: "sequential_thinking",
  decompose_number: "place_value",
  find_compositions: "arith_fluency",
  multi_step_problem: "sequential_thinking",
  read_number_aloud: "audio_recognition",
};

export function aggregateFeaturesBySkill(
  allLogs: Record<string, Log[]>
): Record<Skill, SkillFeatures> {
  const perSkill: Partial<Record<Skill, SkillFeatures>> = {};
  for (const [game, logs] of Object.entries(allLogs)) {
    const skill = GAME_SKILL[game];
    if (!skill || !logs?.length) continue;

    // Observational-only: read_number_aloud excluded from accuracy/err
    const obsOnly = game === "read_number_aloud";

    const lat = logs.map((l) => l.timeSpentMs ?? 0).filter((x) => x > 0);
    const correctLat = logs
      .filter((l) => l.isCorrect)
      .map((l) => l.timeSpentMs ?? 0)
      .filter((x) => x > 0);
    const acc = obsOnly
      ? 0
      : logs.filter((l) => l.isCorrect).length / logs.length;
    const stab = stabilityOf(correctLat);
    const z = zscore(lat);
    const errSev = obsOnly
      ? 0
      : logs.reduce(
          (w, l) =>
            w +
            (l.isCorrect ? 0 : ERROR_WEIGHTS[l.error_type ?? "unknown"] ?? 0.4),
          0
        ) / Math.max(1, logs.length);

    const f: SkillFeatures = {
      accuracy: acc,
      zLatency: z,
      stability: stab,
      errSeverity: errSev,
    };
    perSkill[skill] = perSkill[skill]
      ? {
          // merge if multiple games map to the same skill
          accuracy: (perSkill[skill]!.accuracy + f.accuracy) / 2,
          zLatency: (perSkill[skill]!.zLatency + f.zLatency) / 2,
          stability: (perSkill[skill]!.stability + f.stability) / 2,
          errSeverity: (perSkill[skill]!.errSeverity + f.errSeverity) / 2,
        }
      : f;
  }
  return perSkill as Record<Skill, SkillFeatures>;
}
