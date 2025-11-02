import { AXIS_KEYS, Axes, Coverage, MiniGameConfig } from "./types";

// ------ seeded RNG to reuse identical inputs across A/B ------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// helpers
function randInt(rng: () => number, a: number, b: number) {
  return a + Math.floor(rng() * (b - a + 1));
}
function randFloat(rng: () => number, a = 0, b = 1) {
  return a + rng() * (b - a);
}

type SessionInput = {
  axes: Axes;
  coverage: Coverage;
  testConfig: MiniGameConfig;
};

export function makeSessions(numSessions: number, seed = 42): SessionInput[] {
  const rng = mulberry32(seed);
  const sessions: SessionInput[] = [];

  for (let i = 0; i < numSessions; i++) {
    // axis scores (0..100), allow mild skew by difficulty later
    const axes: Axes = AXIS_KEYS.reduce((acc, k) => {
      acc[k] = Math.round(randFloat(rng, 40, 98)); // keep in a realistic range
      return acc;
    }, {} as Axes);

    // per-axis coverage (0..1), some axes seen less in a session
    const coverage: Coverage = AXIS_KEYS.reduce((acc, k) => {
      const seen = randFloat(rng, 0.5, 1.0); // half to full coverage
      acc[k] = +seen.toFixed(2);
      return acc;
    }, {} as Coverage);

    // teacher/test config sampled
    const difficulty = randInt(rng, 1, 3) as 1 | 2 | 3;
    const testConfig: MiniGameConfig = {
      operation: (["add", "sub", "mul", "div", "mix"] as const)[
        randInt(rng, 0, 4)
      ],
      numberRange: [0, [10, 100, 1000][difficulty - 1]] as [number, number],
      steps: randInt(rng, 1, difficulty === 3 ? 3 : 2),
      carryBorrow: !!randInt(rng, 0, 1),
      difficulty,
    };

    sessions.push({ axes, coverage, testConfig });
  }
  return sessions;
}
