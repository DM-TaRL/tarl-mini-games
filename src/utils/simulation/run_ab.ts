import * as fs from "fs";
import * as path from "path";
import { AXIS_KEYS, MiniGameConfig, Row } from "./types";
import { makeSessions } from "./simulate_ab";
import { inferFuzzyGrade } from "../fuzzy-evaluator";

const NUM_SESSIONS = 1_000_000; // set lower for local dev (e.g., 100_000)
const OUT_DIR = path.resolve(process.cwd(), "results");

function toCSV(rows: Row[]) {
  const header = [
    "id",
    ...AXIS_KEYS,
    "inferredGrade",
    "confidence",
    "coverageMean",
    "mode",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.id,
      ...AXIS_KEYS.map((k) => r[k].toFixed(0)),
      r.inferredGrade.toFixed(2),
      r.confidence.toFixed(3),
      r.coverageMean.toFixed(2),
      r.mode,
    ].join(",")
  );
  return [header, ...lines].join("\n");
}

async function evaluateMode(
  useDynamic: boolean,
  sample: ReturnType<typeof makeSessions>,
  outPath: string
) {
  const rows: Row[] = [];
  for (let i = 0; i < sample.length; i++) {
    const { axes, coverage, testConfig } = sample[i];
    const mode = useDynamic ? "dynamic" : "static";
    const memberships = configToMembershipArray(testConfig, mode);
    const out = inferFuzzyGrade(axes, coverage, memberships, useDynamic);
    const covMean =
      AXIS_KEYS.reduce((s, k) => s + (coverage[k] ?? 0), 0) / AXIS_KEYS.length;
    rows.push({
      id: i + 1,
      ...axes,
      inferredGrade: out.inferredGrade,
      confidence: out.confidence,
      coverageMean: +covMean.toFixed(2),
      mode,
    });
    // (optional) write in chunks if memory is tight
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, toCSV(rows), "utf8");
  return rows;
}

(async () => {
  const sessions = makeSessions(NUM_SESSIONS, 20251020); // fixed seed
  const staticRows = await evaluateMode(
    false, //static
    sessions,
    path.join(OUT_DIR, "static", "results.csv")
  );
  const dynamicRows = await evaluateMode(
    true, // dynamic
    sessions,
    path.join(OUT_DIR, "dynamic", "results.csv")
  );

  // quick summaries
  function mean(arr: number[]) {
    return arr.reduce((s, x) => s + x, 0) / arr.length;
  }
  function variance(arr: number[], m = mean(arr)) {
    return arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  }

  const gA = staticRows.map((r) => r.inferredGrade);
  const gB = dynamicRows.map((r) => r.inferredGrade);
  const cA = staticRows.map((r) => r.confidence);
  const cB = dynamicRows.map((r) => r.confidence);

  const absDiff = gA.map((g, i) => Math.abs(gB[i] - g));
  console.log("mean |Δĝ|:", mean(absDiff).toFixed(3));
  console.log(
    "var ĝ (A):",
    variance(gA).toFixed(3),
    "var ĝ (B):",
    variance(gB).toFixed(3)
  );

  // slope(confidence ~ coverage)
  function slopeXY(x: number[], y: number[]) {
    const mx = mean(x),
      my = mean(y);
    const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
    const den = x.reduce((s, xi) => s + (xi - mx) ** 2, 0) || 1e-9;
    return num / den;
  }
  const covA = staticRows.map((r) => r.coverageMean);
  const covB = dynamicRows.map((r) => r.coverageMean);
  console.log("slope(conf~cov) A:", slopeXY(covA, cA).toFixed(3));
  console.log("slope(conf~cov) B:", slopeXY(covB, cB).toFixed(3));

  // rank agreement on a subsample (Spearman rho; faster than Kendall for big N)
  function rank(arr: number[]) {
    const idx = arr
      .map((v, i) => [v, i] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, i]) => i);
    const r = Array(arr.length);
    for (let k = 0; k < idx.length; k++) r[idx[k]] = k;
    return r as number[];
  }
  function spearmanRho(a: number[], b: number[]) {
    const n = a.length;
    const ra = rank(a),
      rb = rank(b);
    let d2 = 0;
    for (let i = 0; i < n; i++) {
      const d = ra[i] - rb[i];
      d2 += d * d;
    }
    return 1 - (6 * d2) / (n * (n * n - 1));
  }

  const S = 1_000_000; // million sessions
  const rho = spearmanRho(gA.slice(0, S), gB.slice(0, S));
  console.log("Spearman rho (ĝ A vs B):", rho.toFixed(3));

  // boundary bands (±0.25 around grades 3.0–6.0)
  function bandVar(rows: Row[], g: number) {
    const band = rows.filter((r) => Math.abs(r.inferredGrade - g) <= 0.25);
    const arr = band.map((r) => r.inferredGrade);
    return arr.length ? variance(arr) : NaN;
  }
  [3, 4, 5, 6].forEach((g) => {
    const vA = bandVar(staticRows, g);
    const vB = bandVar(dynamicRows, g);
    console.log(
      `var ĝ in band ±0.25 around G${g}: A=${vA.toFixed(4)} B=${vB.toFixed(4)}`
    );
  });

  console.log(
    "CSV written to ./results/static/results.csv and ./results/dynamic/results.csv"
  );
})();

/**
 * Build the evaluator's expected memberships/features array
 * from the simple high-level MiniGameConfig + desired mode.
 * You can start with something basic and improve later.
 */
function configToMembershipArray(
  cfg: MiniGameConfig,
  mode: "static" | "dynamic"
): any[] {
  const dif = cfg.difficulty ?? 2;
  // simple shift heuristic as discussed
  const baseShift = mode === "static" ? 0 : dif === 1 ? 0 : dif === 2 ? 5 : 10;
  const stepsShift = cfg.steps && cfg.steps >= 2 ? 5 : 0;
  const carryShift = cfg.carryBorrow ? 5 : 0;
  const shift = baseShift + stepsShift + carryShift;

  // return whatever your evaluator expects as the 3rd param
  // For example: per-axis triangular vertices [low, med, high]
  // Here’s a generic shape; tailor it to your evaluator’s expectations:
  const tri = (a: number, b: number, c: number) => ({ a, b, c });

  return [
    {
      axis: "arithmetic_fluency",
      low: tri(0 + shift, 0 + shift, 50 + shift),
      med: tri(30 + shift, 50 + shift, 70 + shift),
      high: tri(50 + shift, 100, 100),
    },
    {
      axis: "number_sense",
      low: tri(0 + shift, 0 + shift, 50 + shift),
      med: tri(30 + shift, 50 + shift, 70 + shift),
      high: tri(50 + shift, 100, 100),
    },
    {
      axis: "sequential_thinking",
      low: tri(0 + shift, 0 + shift, 50 + shift),
      med: tri(30 + shift, 50 + shift, 70 + shift),
      high: tri(50 + shift, 100, 100),
    },
    {
      axis: "comparison_skill",
      low: tri(0 + shift, 0 + shift, 50 + shift),
      med: tri(30 + shift, 50 + shift, 70 + shift),
      high: tri(50 + shift, 100, 100),
    },
    {
      axis: "visual_matching",
      low: tri(0 + shift, 0 + shift, 50 + shift),
      med: tri(30 + shift, 50 + shift, 70 + shift),
      high: tri(50 + shift, 100, 100),
    },
    {
      axis: "audio_recognition",
      low: tri(0 + shift, 0 + shift, 50 + shift),
      med: tri(30 + shift, 50 + shift, 70 + shift),
      high: tri(50 + shift, 100, 100),
    },
  ];
}
