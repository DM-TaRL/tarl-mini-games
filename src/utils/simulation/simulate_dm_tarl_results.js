"use strict";
/* -----------------------------------------------------------
   DM-TaRL synthetic validation pipeline — Extended Educator Version
   - 10,000 sessions × 13 mini-games
   - K-means clustering on [gradeNorm, confidence, coverage]
   - Pearson correlations between cognitive axes
   - Extra fields for educators (dominant skill, proficiency band, etc.)
   ----------------------------------------------------------- */
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const fuzzy_evaluator_1 = require("../fuzzy-evaluator");
const features_aggregator_1 = require("../features-aggregator");
/* ----------------- Config ----------------- */
const NUM_SESSIONS = 1000000;
const K = 4; // clusters
const GAMES = Object.keys(features_aggregator_1.MAP);
const RNG_SEED = 42;
/* ----------------- RNG ----------------- */
let _seed = RNG_SEED >>> 0;
function rnd() {
    _seed ^= _seed << 13;
    _seed ^= _seed >>> 17;
    _seed ^= _seed << 5;
    return ((_seed >>> 0) % 1000000) / 1000000;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const AXIS_KEYS = [
    "arithmetic_fluency",
    "number_sense",
    "sequential_thinking",
    "comparison_skill",
    "visual_matching",
    "audio_recognition",
];
/* ----------------- Learner mastery profiles ----------------- */
const PROFILES = [
    { label: "Struggling", mu: 30, sd: 10 },
    { label: "Intermediate", mu: 60, sd: 15 },
    { label: "Advanced", mu: 85, sd: 10 },
];
/* ----------------- Synthetic generators ----------------- */
function randomAxes() {
    const profile = PROFILES[Math.floor(rnd() * PROFILES.length)];
    const a = {};
    for (const k of AXIS_KEYS) {
        const u = (rnd() + rnd() + rnd() + rnd() + rnd() + rnd()) / 6; // approx normal
        const val = profile.mu + profile.sd * (u - 0.5) * 2;
        a[k] = clamp(Math.round(val), 0, 100);
    }
    return a;
}
function randomCoverage() {
    const c = {};
    for (const k of AXIS_KEYS)
        c[k] = +(0.3 + 0.7 * rnd()).toFixed(2);
    return c;
}
function randomTestConfig() {
    const targetGrade = 1 + Math.floor(rnd() * 6);
    return GAMES.map((g) => ({
        gameType: g,
        config: { difficulty: targetGrade * 15 + 10 },
    }));
}
function kmeans3(data, k = 3, iters = 40) {
    if (data.length === 0)
        throw new Error("kmeans3: empty dataset");
    if (data.length < k)
        k = data.length;
    // Randomized, spread initialization
    const step = Math.floor(data.length / k) || 1;
    let centers = Array.from({ length: k }, (_, i) => data[i * step] || data[0]);
    const labels = new Array(data.length).fill(0);
    for (let it = 0; it < iters; it++) {
        // Assignment step
        for (let i = 0; i < data.length; i++) {
            let best = 0, bestD = Infinity;
            for (let c = 0; c < k; c++) {
                const d = (data[i][0] - centers[c][0]) ** 2 +
                    (data[i][1] - centers[c][1]) ** 2 +
                    (data[i][2] - centers[c][2]) ** 2;
                if (d < bestD)
                    (bestD = d), (best = c);
            }
            labels[i] = best;
        }
        // Update step
        const sums = Array.from({ length: k }, () => [0, 0, 0]);
        const counts = Array.from({ length: k }, () => 0);
        for (let i = 0; i < data.length; i++) {
            const g = labels[i];
            sums[g][0] += data[i][0];
            sums[g][1] += data[i][1];
            sums[g][2] += data[i][2];
            counts[g]++;
        }
        for (let c = 0; c < k; c++) {
            if (counts[c] > 0) {
                centers[c] = [
                    sums[c][0] / counts[c],
                    sums[c][1] / counts[c],
                    sums[c][2] / counts[c],
                ];
            }
        }
    }
    return { labels, centers };
}
/* ----------------- Pearson correlation ----------------- */
function pearson(xs, ys) {
    const n = xs.length;
    const mx = xs.reduce((s, x) => s + x, 0) / n;
    const my = ys.reduce((s, y) => s + y, 0) / n;
    let num = 0, denx = 0, deny = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx;
        const dy = ys[i] - my;
        num += dx * dy;
        denx += dx * dx;
        deny += dy * dy;
    }
    const den = Math.sqrt(denx * deny) || 1e-9;
    return num / den;
}
const rows = [];
for (let i = 0; i < NUM_SESSIONS; i++) {
    const axes = randomAxes();
    const coverage = randomCoverage();
    const testConfig = randomTestConfig();
    const out = (0, fuzzy_evaluator_1.inferFuzzyGrade)(axes, coverage, testConfig, true);
    const covMean = AXIS_KEYS.reduce((s, k) => s + (coverage[k] ?? 0), 0) / AXIS_KEYS.length;
    rows.push({
        id: i + 1,
        ...axes,
        inferredGrade: out.inferredGrade,
        confidence: out.confidence,
        coverageMean: +covMean.toFixed(2),
    });
}
/* ----------------- Clustering & Correlation ----------------- */
const feats = rows.map((r) => [
    r.inferredGrade / 6,
    r.confidence,
    r.coverageMean,
]);
const { labels, centers } = kmeans3(feats, K, 40);
rows.forEach((r, i) => (r.cluster = labels[i]));
/* ----------------- Save cluster summary ----------------- */
const clusterSizes = Array.from({ length: K }, (_, c) => labels.filter((x) => x === c).length);
const centersCsvHeader = "cluster,center_gradeNorm,center_confidence,center_coverage,size,dominantBand,meanGradeLabel";
const centersCsvRows = centers.map((c, i) => {
    // derive the most frequent proficiency band within each cluster
    const clusterRows = rows.filter((r) => r.cluster === i);
    const bands = {};
    let meanGrade = 0;
    for (const r of clusterRows) {
        const b = categorize(r).proficiencyBand;
        bands[b] = (bands[b] || 0) + 1;
        meanGrade += r.inferredGrade;
    }
    meanGrade /= clusterRows.length || 1;
    const dominantBand = Object.entries(bands).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
    return [
        i,
        c[0].toFixed(3),
        c[1].toFixed(3),
        c[2].toFixed(3),
        clusterSizes[i],
        dominantBand,
        `G${Math.round(meanGrade)}`,
    ].join(",");
});
fs.writeFileSync("results/clusters_summary.csv", [centersCsvHeader, ...centersCsvRows].join("\n"), "utf8");
console.log("\nCluster summary saved to clusters_summary.csv");
centersCsvRows.forEach((r) => console.log("  " + r));
/* ----------------- Educator-friendly categorization ----------------- */
function categorize(r) {
    const grade = Math.round(r.inferredGrade);
    const bands = ["Beginner", "Developing", "Proficient", "Advanced"];
    const band = bands[Math.min(3, Math.floor((grade - 1) / 2))];
    const axesSorted = Object.entries(r).filter(([k]) => AXIS_KEYS.includes(k));
    const [minA, maxA] = [
        axesSorted.reduce((a, b) => (a[1] < b[1] ? a : b)),
        axesSorted.reduce((a, b) => (a[1] > b[1] ? a : b)),
    ];
    return {
        predictedGradeLabel: `G${grade}`,
        proficiencyBand: band,
        dominantSkill: maxA[0],
        weakestSkill: minA[0],
        confidenceCategory: r.confidence < 0.6 ? "Low" : r.confidence < 0.8 ? "Medium" : "High",
        coverageCategory: r.coverageMean < 0.5
            ? "Partial"
            : r.coverageMean < 0.75
                ? "Moderate"
                : "Complete",
    };
}
/* ----------------- Export extended CSV ----------------- */
const resultsCsvHeader = "id,inferredGrade,confidence,coverageMean,cluster,predictedGradeLabel,proficiencyBand,dominantSkill,weakestSkill,confidenceCategory,coverageCategory," +
    AXIS_KEYS.join(",");
const resultsCsv = [resultsCsvHeader]
    .concat(rows.map((r) => {
    const c = categorize(r);
    return [
        r.id,
        r.inferredGrade.toFixed(2),
        r.confidence.toFixed(2),
        r.coverageMean.toFixed(2),
        r.cluster,
        c.predictedGradeLabel,
        c.proficiencyBand,
        c.dominantSkill,
        c.weakestSkill,
        c.confidenceCategory,
        c.coverageCategory,
        ...AXIS_KEYS.map((k) => r[k].toFixed(0)),
    ].join(",");
}))
    .join("\n");
fs.writeFileSync("results/fuzzy_results_educator.csv", resultsCsv, "utf8");
/* ----------------- Summary statistics ----------------- */
const meanStd = (vals) => {
    if (vals.length === 0)
        return { mean: 0, std: 0, min: 0, max: 0 };
    let sum = 0, sumSq = 0, min = Infinity, max = -Infinity;
    for (let i = 0; i < vals.length; i++) {
        const x = vals[i];
        sum += x;
        sumSq += x * x;
        if (x < min)
            min = x;
        if (x > max)
            max = x;
    }
    const mean = sum / vals.length;
    const variance = sumSq / vals.length - mean * mean;
    return { mean, std: Math.sqrt(variance), min, max };
};
const g = meanStd(rows.map((r) => r.inferredGrade / 6));
const conf = meanStd(rows.map((r) => r.confidence));
const cov = meanStd(rows.map((r) => r.coverageMean));
console.log("\n=== Simulation Summary (Extended) ===");
console.log(`Grade norm (0–1): mean=${g.mean.toFixed(2)}, sd=${g.std.toFixed(2)}, range=${g.min.toFixed(2)}–${g.max.toFixed(2)}`);
console.log(`Confidence:        mean=${conf.mean.toFixed(2)}, sd=${conf.std.toFixed(2)}, range=${conf.min.toFixed(2)}–${conf.max.toFixed(2)}`);
console.log(`Coverage:          mean=${cov.mean.toFixed(2)}, sd=${cov.std.toFixed(2)}, range=${cov.min.toFixed(2)}–${cov.max.toFixed(2)}`);
/* ----------------- Band summary for educators ----------------- */
const bandCounts = {
    Beginner: 0,
    Developing: 0,
    Proficient: 0,
    Advanced: 0,
};
rows.forEach((r) => {
    const b = categorize(r).proficiencyBand;
    bandCounts[b]++;
});
console.log("\nLearner distribution by proficiency:");
for (const b of Object.keys(bandCounts))
    console.log(`  ${b}: ${bandCounts[b]} (${((bandCounts[b] / NUM_SESSIONS) * 100).toFixed(1)}%)`);
/* ----------------- Proficiency summary for educators ----------------- */
const proficiencyStats = {
    Beginner: {
        count: 0,
        meanGrade: 0,
        meanConfidence: 0,
        meanCoverage: 0,
        dominantFreq: {},
        weakFreq: {},
    },
    Developing: {
        count: 0,
        meanGrade: 0,
        meanConfidence: 0,
        meanCoverage: 0,
        dominantFreq: {},
        weakFreq: {},
    },
    Proficient: {
        count: 0,
        meanGrade: 0,
        meanConfidence: 0,
        meanCoverage: 0,
        dominantFreq: {},
        weakFreq: {},
    },
    Advanced: {
        count: 0,
        meanGrade: 0,
        meanConfidence: 0,
        meanCoverage: 0,
        dominantFreq: {},
        weakFreq: {},
    },
};
for (const r of rows) {
    const c = categorize(r);
    const b = c.proficiencyBand;
    const stat = proficiencyStats[b];
    stat.count++;
    stat.meanGrade += r.inferredGrade;
    stat.meanConfidence += r.confidence;
    stat.meanCoverage += r.coverageMean;
    stat.dominantFreq[c.dominantSkill] =
        (stat.dominantFreq[c.dominantSkill] || 0) + 1;
    stat.weakFreq[c.weakestSkill] = (stat.weakFreq[c.weakestSkill] || 0) + 1;
}
// compute averages + find top skills
const total = rows.length;
const summaryRows = [];
const summaryHeader = "Band,Count,Percent,MeanGrade,MeanConfidence,MeanCoverage,TopDominantSkill,TopWeakestSkill";
for (const [band, stat] of Object.entries(proficiencyStats)) {
    if (stat.count === 0)
        continue;
    const topDominant = Object.entries(stat.dominantFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "-";
    const topWeak = Object.entries(stat.weakFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
    summaryRows.push([
        band,
        stat.count,
        ((stat.count / total) * 100).toFixed(1) + "%",
        (stat.meanGrade / stat.count).toFixed(2),
        (stat.meanConfidence / stat.count).toFixed(2),
        (stat.meanCoverage / stat.count).toFixed(2),
        topDominant,
        topWeak,
    ].join(","));
}
fs.writeFileSync("results/proficiency_summary.csv", [summaryHeader, ...summaryRows].join("\n"), "utf8");
console.log("\nProficiency summary saved to proficiency_summary.csv");
summaryRows.forEach((r) => console.log("  " + r));
console.log("\nSaved: fuzzy_results_educator.csv, clusters_summary.csv, axis_correlations.csv, proficiency_summary.csv");
