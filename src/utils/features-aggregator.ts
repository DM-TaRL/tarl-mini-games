type Attempt = {
  logs?: any[];
  scorePercent?: number;
  success?: boolean;
};

type MiniGamesResults = Record<string, Attempt[]>;

const AXES = [
  "arithmetic_fluency",
  "number_sense",
  "sequential_thinking",
  "comparison_skill",
  "visual_matching",
  "audio_recognition",
] as const;
type Axis = (typeof AXES)[number];

function latest(arr?: Attempt[] | null): Attempt | null {
  if (!arr) return null;
  const valid = arr.filter(Boolean);
  return valid.length ? valid[valid.length - 1] : null;
}

function errRate(a: Attempt | null): number {
  if (!a) return 1;
  const s = typeof a.scorePercent === "number" ? a.scorePercent : 0;
  return Math.max(0, Math.min(1, 1 - s / 100));
}

function slowRate(a: Attempt | null): number {
  const logs = (a?.logs || []).filter(Boolean);
  if (!logs.length) return 0;
  const slow = logs.filter((l) => l.answerTimeCategory === "slow").length;
  return slow / logs.length;
}

// 0..100 perf from error+speed (weights tunable per axis/game if needed)
function perfFromAttempt(a: Attempt | null, wErr = 0.7, wSlow = 0.3): number {
  const v = 1 - (errRate(a) * wErr + slowRate(a) * wSlow); // 0..1
  return Math.max(0, Math.min(100, Math.round(v * 100)));
}

// ---- Game → Axis contribution matrix (sums to 1 per game) ----
// Rationale (matches skills declared in mini-games.json):
// - vertical_operations → arithmetic_fluency (precision/fluency) :contentReference[oaicite:1]{index=1}
// - choose_answer → arithmetic_fluency + number_sense + sequential_thinking (reading ops in context) :contentReference[oaicite:2]{index=2}
/*  find_compositions → arithmetic_fluency + number_sense (composition logic)
    multi_step_problem → arithmetic_fluency + sequential_thinking
    find_previous_next_number, order_numbers → sequential_thinking
    compare_numbers → comparison_skill
    tap_matching_pairs → visual_matching
    identify_place_value, decompose_number, write_number_in_letters → number_sense
    what_number_do_you_hear, read_number_aloud → audio_recognition */
const MAP: Record<string, Partial<Record<Axis, number>>> = {
  vertical_operations: { arithmetic_fluency: 1.0 },
  choose_answer: {
    arithmetic_fluency: 0.6,
    number_sense: 0.2,
    sequential_thinking: 0.2,
  },
  find_compositions: { arithmetic_fluency: 0.6, number_sense: 0.4 },
  multi_step_problem: { arithmetic_fluency: 0.5, sequential_thinking: 0.5 },

  find_previous_next_number: { sequential_thinking: 1.0 },
  order_numbers: { sequential_thinking: 1.0 },

  compare_numbers: { comparison_skill: 1.0 },

  tap_matching_pairs: { visual_matching: 1.0 },

  identify_place_value: { number_sense: 1.0 },
  decompose_number: { number_sense: 1.0 },
  write_number_in_letters: { number_sense: 1.0 },

  what_number_do_you_hear: { audio_recognition: 1.0 },
  read_number_aloud: { number_sense: 1.0 },
};

// Optional: per-axis/per-game tuning for speed weight
const SPEED_WEIGHT_BY_GAME: Record<string, number> = {
  // e.g., counting speed more on fluency tasks:
  vertical_operations: 0.35,
  choose_answer: 0.3,
  multi_step_problem: 0.3,
};

export function buildFuzzyInputsFromResults(
  miniGames: MiniGamesResults,
  includedGameTypes?: string[],
  missedAxes?: Partial<Record<Axis, boolean>>
) {
  // If teacher passed a subset, filter to it; otherwise use whatever shows up in results.
  const consideredGames = (
    includedGameTypes && includedGameTypes.length
      ? includedGameTypes
      : Object.keys(miniGames)
  ).filter((g) => MAP[g]); // keep only mapped games

  // Per-game performance (defined only if attempted)
  const perGamePerf: Record<string, number | undefined> = {};
  for (const gameType of consideredGames) {
    const a = latest(miniGames[gameType] || null);
    const wSlow = SPEED_WEIGHT_BY_GAME[gameType] ?? 0.3;
    perGamePerf[gameType] = perfFromAttempt(a, 0.7, wSlow); // may be undefined
  }

  // For each axis, compute:
  // - denom = sum of mapping weights for considered games
  // - num = weighted sum of perf for games that have a defined perf
  // - coverage = (sum of weights with defined perf) / denom
  // - axis value = num / (sum of weights with defined perf), else undefined
  const axes: Partial<Record<Axis, number>> = {};
  const coverage: Record<Axis, number> = {
    arithmetic_fluency: 0,
    number_sense: 0,
    sequential_thinking: 0,
    comparison_skill: 0,
    visual_matching: 0,
    audio_recognition: 0,
  };

  for (const axis of AXES) {
    let denom = 0,
      have = 0,
      num = 0;
    for (const g of consideredGames) {
      const w = MAP[g]?.[axis] ?? 0;
      if (!w) continue;
      denom += w;
      const p = perGamePerf[g];
      if (typeof p === "number") {
        have += w;
        num += p * w;
      }
    }
    coverage[axis] = denom ? +(have / denom).toFixed(3) : 0; // 0..1
    // axes[axis] = have ? Math.round(num / have) : undefined; // undefined = unknown
    if (have) {
      axes[axis] = Math.round(num / have);
    } else if (missedAxes[axis]) {
      axes[axis] = 30; // Penalize missing axes (30 instead of fallback 50)
    } else {
      axes[axis] = 50; // Unknown but not penalized
    }
  }

  // Return both axis values and coverage
  return {
    axes: {
      arithmetic_fluency: axes.arithmetic_fluency ?? 50,
      number_sense: axes.number_sense ?? 50,
      sequential_thinking: axes.sequential_thinking ?? 50,
      comparison_skill: axes.comparison_skill ?? 50,
      visual_matching: axes.visual_matching ?? 50,
      audio_recognition: axes.audio_recognition ?? 50,
    },
    coverage,
  };
}

export { MAP };

export function getMissedAxesFromIncompleteGames(
  allGames: string[],
  completedGames: string[]
): Partial<Record<Axis, boolean>> {
  const missedAxes: Partial<Record<Axis, boolean>> = {};
  const missed = allGames.filter((g) => !completedGames.includes(g));
  for (const game of missed) {
    const axes = MAP[game];
    if (!axes) continue;
    for (const axis of Object.keys(axes) as Axis[]) {
      missedAxes[axis] = true;
    }
  }
  return missedAxes;
}
