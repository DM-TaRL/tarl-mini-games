"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFuzzyConfidence = exports.inferFuzzyGrade = void 0;
const fuzzy_utils_1 = require("./fuzzy-utils");
const features_aggregator_1 = require("./features-aggregator");
function tri(x, a, b, c) {
    if (x <= a || x >= c)
        return 0;
    if (x === b)
        return 1;
    return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
}
function makeFuzzifier(useDynamic, testConfig) {
    const triangleMap = {};
    for (const axis of [
        "arithmetic_fluency",
        "number_sense",
        "sequential_thinking",
        "comparison_skill",
        "visual_matching",
        "audio_recognition",
    ]) {
        if (useDynamic && testConfig) {
            const relevant = testConfig.filter((game) => features_aggregator_1.MAP[game.gameType]?.[axis]);
            const avgDifficulty = relevant.length
                ? relevant.reduce((sum, g) => sum + (0, fuzzy_utils_1.computeGameDifficulty)(g.gameType, g.config), 0) / relevant.length
                : 50;
            triangleMap[axis] = (0, fuzzy_utils_1.getFuzzyMembershipByAxisDifficulty)(avgDifficulty);
        }
        else {
            triangleMap[axis] = {
                low: [0, 0, 50],
                medium: [40, 55, 70],
                high: [65, 80, 100],
            };
        }
    }
    return function fuzzify(x, axis) {
        const t = triangleMap[axis];
        return {
            low: tri(x, ...t.low),
            medium: tri(x, ...t.medium),
            high: tri(x, ...t.high),
        };
    };
}
function gradeMF(lbl, x) {
    const c = { G1: 1, G2: 2, G3: 3, G4: 4, G5: 5, G6: 6 }[lbl];
    return tri(x, c - 1.0, c, c + 1.0);
}
// Masks: do not punish when evidence is missing
// neutral baseline = 0.5 (neither helps nor hurts)
const NEUTRAL = 0.5;
const pos = (mu, cov) => (cov && cov > 0 ? mu : NEUTRAL);
const neg = (mu, cov) => (cov && cov > 0 ? mu : 0); // still don't accuse without evidence
function inferFuzzyGrade(axes, coverage, testConfig, useDynamic = false) {
    const fuzzify = makeFuzzifier(useDynamic, testConfig);
    const F = Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, fuzzify(v, k)]));
    const C = coverage || {};
    // -------- Rule base (G1..G6) with masking --------
    const rG1 = Math.max(Math.min(neg(F.arithmetic_fluency.low, C.arithmetic_fluency), neg(F.number_sense.low, C.number_sense)), Math.min(neg(F.number_sense.low, C.number_sense), neg(F.sequential_thinking.low, C.sequential_thinking)));
    const rG2 = Math.min(pos(F.arithmetic_fluency.medium, C.arithmetic_fluency), neg(F.number_sense.low, C.number_sense));
    const rG3 = Math.min(pos(F.arithmetic_fluency.medium, C.arithmetic_fluency), pos(F.number_sense.medium, C.number_sense));
    const rG4 = Math.min(pos(F.arithmetic_fluency.high, C.arithmetic_fluency), pos(F.number_sense.medium, C.number_sense), Math.max(pos(F.sequential_thinking.medium, C.sequential_thinking), pos(F.comparison_skill.medium, C.comparison_skill)));
    const rG5 = Math.min(pos(F.arithmetic_fluency.high, C.arithmetic_fluency), pos(F.number_sense.high, C.number_sense), Math.max(pos(F.sequential_thinking.medium, C.sequential_thinking), pos(F.comparison_skill.high, C.comparison_skill)));
    const rG6 = Math.min(pos(F.arithmetic_fluency.high, C.arithmetic_fluency), pos(F.number_sense.high, C.number_sense), pos(F.sequential_thinking.high, C.sequential_thinking), Math.max(pos(F.comparison_skill.high, C.comparison_skill), pos(F.visual_matching.high, C.visual_matching), pos(F.audio_recognition.high, C.audio_recognition)));
    function aggregated(x) {
        return Math.max(Math.min(rG1, gradeMF("G1", x)), Math.min(rG2, gradeMF("G2", x)), Math.min(rG3, gradeMF("G3", x)), Math.min(rG4, gradeMF("G4", x)), Math.min(rG5, gradeMF("G5", x)), Math.min(rG6, gradeMF("G6", x)));
    }
    let num = 0, den = 0;
    for (let x = 1; x <= 6; x += 0.01) {
        const mu = aggregated(x);
        num += mu * x;
        den += mu;
    }
    const inferredGrade = den ? +(num / den).toFixed(2) : 1.0;
    const confidence = computeFuzzyConfidence(coverage);
    return {
        inferredGrade,
        memberships: F,
        coverage: C,
        ruleFiring: { rG1, rG2, rG3, rG4, rG5, rG6 },
        confidence,
    };
}
exports.inferFuzzyGrade = inferFuzzyGrade;
// --- confidence helper (0..1) ---
// Emphasize core math (AF+NS), but still reflect overall coverage of the 6 axes.
function computeFuzzyConfidence(coverage) {
    const get = (k) => coverage[k] ?? 0;
    const core = (get("arithmetic_fluency") + get("number_sense")) / 2;
    const mean = (get("arithmetic_fluency") +
        get("number_sense") +
        get("sequential_thinking") +
        get("comparison_skill") +
        get("visual_matching") +
        get("audio_recognition")) /
        6;
    return +(0.6 * core + 0.4 * mean).toFixed(2);
}
exports.computeFuzzyConfidence = computeFuzzyConfidence;
