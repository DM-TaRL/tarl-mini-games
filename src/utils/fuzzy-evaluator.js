"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.computeFuzzyConfidence = exports.inferFuzzyGrade = void 0;
var fuzzy_utils_1 = require("./fuzzy-utils");
var features_aggregator_1 = require("./features-aggregator");
function tri(x, a, b, c) {
    if (x <= a || x >= c)
        return 0;
    if (x === b)
        return 1;
    return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
}
function makeFuzzifier(useDynamic, testConfig) {
    var triangleMap = {};
    var _loop_1 = function (axis) {
        if (useDynamic && testConfig) {
            var relevant = testConfig.filter(function (game) { var _a; return (_a = features_aggregator_1.MAP[game.gameType]) === null || _a === void 0 ? void 0 : _a[axis]; });
            var avgDifficulty = relevant.length
                ? relevant.reduce(function (sum, g) { return sum + (0, fuzzy_utils_1.computeGameDifficulty)(g.gameType, g.config); }, 0) / relevant.length
                : 50;
            triangleMap[axis] = (0, fuzzy_utils_1.getFuzzyMembershipByAxisDifficulty)(avgDifficulty);
        }
        else {
            triangleMap[axis] = {
                low: [0, 0, 50],
                medium: [40, 55, 70],
                high: [65, 80, 100]
            };
        }
    };
    for (var _i = 0, _a = [
        "arithmetic_fluency",
        "number_sense",
        "sequential_thinking",
        "comparison_skill",
        "visual_matching",
        "audio_recognition",
    ]; _i < _a.length; _i++) {
        var axis = _a[_i];
        _loop_1(axis);
    }
    return function fuzzify(x, axis) {
        var t = triangleMap[axis];
        return {
            low: tri.apply(void 0, __spreadArray([x], t.low, false)),
            medium: tri.apply(void 0, __spreadArray([x], t.medium, false)),
            high: tri.apply(void 0, __spreadArray([x], t.high, false))
        };
    };
}
function gradeMF(lbl, x) {
    var c = { G1: 1, G2: 2, G3: 3, G4: 4, G5: 5, G6: 6 }[lbl];
    return tri(x, c - 1.0, c, c + 1.0);
}
// Masks: do not punish when evidence is missing
// neutral baseline = 0.5 (neither helps nor hurts)
var NEUTRAL = 0.5;
var pos = function (mu, cov) { return (cov && cov > 0 ? mu : NEUTRAL); };
var neg = function (mu, cov) { return (cov && cov > 0 ? mu : 0); }; // still don't accuse without evidence
function inferFuzzyGrade(axes, coverage, testConfig, useDynamic) {
    if (useDynamic === void 0) { useDynamic = false; }
    var fuzzify = makeFuzzifier(useDynamic, testConfig);
    var F = Object.fromEntries(Object.entries(axes).map(function (_a) {
        var k = _a[0], v = _a[1];
        return [k, fuzzify(v, k)];
    }));
    var C = coverage || {};
    // -------- Rule base (G1..G6) with masking --------
    var rG1 = Math.max(Math.min(neg(F.arithmetic_fluency.low, C.arithmetic_fluency), neg(F.number_sense.low, C.number_sense)), Math.min(neg(F.number_sense.low, C.number_sense), neg(F.sequential_thinking.low, C.sequential_thinking)));
    var rG2 = Math.min(pos(F.arithmetic_fluency.medium, C.arithmetic_fluency), neg(F.number_sense.low, C.number_sense));
    var rG3 = Math.min(pos(F.arithmetic_fluency.medium, C.arithmetic_fluency), pos(F.number_sense.medium, C.number_sense));
    var rG4 = Math.min(pos(F.arithmetic_fluency.high, C.arithmetic_fluency), pos(F.number_sense.medium, C.number_sense), Math.max(pos(F.sequential_thinking.medium, C.sequential_thinking), pos(F.comparison_skill.medium, C.comparison_skill)));
    var rG5 = Math.min(pos(F.arithmetic_fluency.high, C.arithmetic_fluency), pos(F.number_sense.high, C.number_sense), Math.max(pos(F.sequential_thinking.medium, C.sequential_thinking), pos(F.comparison_skill.high, C.comparison_skill)));
    var rG6 = Math.min(pos(F.arithmetic_fluency.high, C.arithmetic_fluency), pos(F.number_sense.high, C.number_sense), pos(F.sequential_thinking.high, C.sequential_thinking), Math.max(pos(F.comparison_skill.high, C.comparison_skill), pos(F.visual_matching.high, C.visual_matching), pos(F.audio_recognition.high, C.audio_recognition)));
    function aggregated(x) {
        return Math.max(Math.min(rG1, gradeMF("G1", x)), Math.min(rG2, gradeMF("G2", x)), Math.min(rG3, gradeMF("G3", x)), Math.min(rG4, gradeMF("G4", x)), Math.min(rG5, gradeMF("G5", x)), Math.min(rG6, gradeMF("G6", x)));
    }
    var num = 0, den = 0;
    for (var x = 1; x <= 6; x += 0.01) {
        var mu = aggregated(x);
        num += mu * x;
        den += mu;
    }
    var inferredGrade = den ? +(num / den).toFixed(2) : 1.0;
    var confidence = computeFuzzyConfidence(coverage);
    return {
        inferredGrade: inferredGrade,
        memberships: F,
        coverage: C,
        ruleFiring: { rG1: rG1, rG2: rG2, rG3: rG3, rG4: rG4, rG5: rG5, rG6: rG6 },
        confidence: confidence
    };
}
exports.inferFuzzyGrade = inferFuzzyGrade;
// --- confidence helper (0..1) ---
// Emphasize core math (AF+NS), but still reflect overall coverage of the 6 axes.
function computeFuzzyConfidence(coverage) {
    var get = function (k) { var _a; return (_a = coverage[k]) !== null && _a !== void 0 ? _a : 0; };
    var core = (get("arithmetic_fluency") + get("number_sense")) / 2;
    var mean = (get("arithmetic_fluency") +
        get("number_sense") +
        get("sequential_thinking") +
        get("comparison_skill") +
        get("visual_matching") +
        get("audio_recognition")) /
        6;
    return +(0.6 * core + 0.4 * mean).toFixed(2);
}
exports.computeFuzzyConfidence = computeFuzzyConfidence;
