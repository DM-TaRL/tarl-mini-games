"use strict";
exports.__esModule = true;
exports.getMissedAxesFromIncompleteGames = exports.MAP = exports.buildFuzzyInputsFromResults = void 0;
var AXES = [
    "arithmetic_fluency",
    "number_sense",
    "sequential_thinking",
    "comparison_skill",
    "visual_matching",
    "audio_recognition",
];
function latest(arr) {
    if (!arr)
        return null;
    var valid = arr.filter(Boolean);
    return valid.length ? valid[valid.length - 1] : null;
}
function errRate(a) {
    if (!a)
        return 1;
    var s = typeof a.scorePercent === "number" ? a.scorePercent : 0;
    return Math.max(0, Math.min(1, 1 - s / 100));
}
function slowRate(a) {
    var logs = ((a === null || a === void 0 ? void 0 : a.logs) || []).filter(Boolean);
    if (!logs.length)
        return 0;
    var slow = logs.filter(function (l) { return l.answerTimeCategory === "slow"; }).length;
    return slow / logs.length;
}
// 0..100 perf from error+speed (weights tunable per axis/game if needed)
function perfFromAttempt(a, wErr, wSlow) {
    if (wErr === void 0) { wErr = 0.7; }
    if (wSlow === void 0) { wSlow = 0.3; }
    var v = 1 - (errRate(a) * wErr + slowRate(a) * wSlow); // 0..1
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
var MAP = {
    vertical_operations: { arithmetic_fluency: 1.0 },
    choose_answer: {
        arithmetic_fluency: 0.6,
        number_sense: 0.2,
        sequential_thinking: 0.2
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
    read_number_aloud: { number_sense: 1.0 }
};
exports.MAP = MAP;
// Optional: per-axis/per-game tuning for speed weight
var SPEED_WEIGHT_BY_GAME = {
    // e.g., counting speed more on fluency tasks:
    vertical_operations: 0.35,
    choose_answer: 0.3,
    multi_step_problem: 0.3
};
function buildFuzzyInputsFromResults(miniGames, includedGameTypes, missedAxes) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    // If teacher passed a subset, filter to it; otherwise use whatever shows up in results.
    var consideredGames = (includedGameTypes && includedGameTypes.length
        ? includedGameTypes
        : Object.keys(miniGames)).filter(function (g) { return MAP[g]; }); // keep only mapped games
    // Per-game performance (defined only if attempted)
    var perGamePerf = {};
    for (var _i = 0, consideredGames_1 = consideredGames; _i < consideredGames_1.length; _i++) {
        var gameType = consideredGames_1[_i];
        var a = latest(miniGames[gameType] || null);
        var wSlow = (_a = SPEED_WEIGHT_BY_GAME[gameType]) !== null && _a !== void 0 ? _a : 0.3;
        perGamePerf[gameType] = perfFromAttempt(a, 0.7, wSlow); // may be undefined
    }
    // For each axis, compute:
    // - denom = sum of mapping weights for considered games
    // - num = weighted sum of perf for games that have a defined perf
    // - coverage = (sum of weights with defined perf) / denom
    // - axis value = num / (sum of weights with defined perf), else undefined
    var axes = {};
    var coverage = {
        arithmetic_fluency: 0,
        number_sense: 0,
        sequential_thinking: 0,
        comparison_skill: 0,
        visual_matching: 0,
        audio_recognition: 0
    };
    for (var _k = 0, AXES_1 = AXES; _k < AXES_1.length; _k++) {
        var axis = AXES_1[_k];
        var denom = 0, have = 0, num = 0;
        for (var _l = 0, consideredGames_2 = consideredGames; _l < consideredGames_2.length; _l++) {
            var g = consideredGames_2[_l];
            var w = (_c = (_b = MAP[g]) === null || _b === void 0 ? void 0 : _b[axis]) !== null && _c !== void 0 ? _c : 0;
            if (!w)
                continue;
            denom += w;
            var p = perGamePerf[g];
            if (typeof p === "number") {
                have += w;
                num += p * w;
            }
        }
        coverage[axis] = denom ? +(have / denom).toFixed(3) : 0; // 0..1
        // axes[axis] = have ? Math.round(num / have) : undefined; // undefined = unknown
        if (have) {
            axes[axis] = Math.round(num / have);
        }
        else if (missedAxes[axis]) {
            axes[axis] = 30; // Penalize missing axes (30 instead of fallback 50)
        }
        else {
            axes[axis] = 50; // Unknown but not penalized
        }
    }
    // Return both axis values and coverage
    return {
        axes: {
            arithmetic_fluency: (_d = axes.arithmetic_fluency) !== null && _d !== void 0 ? _d : 50,
            number_sense: (_e = axes.number_sense) !== null && _e !== void 0 ? _e : 50,
            sequential_thinking: (_f = axes.sequential_thinking) !== null && _f !== void 0 ? _f : 50,
            comparison_skill: (_g = axes.comparison_skill) !== null && _g !== void 0 ? _g : 50,
            visual_matching: (_h = axes.visual_matching) !== null && _h !== void 0 ? _h : 50,
            audio_recognition: (_j = axes.audio_recognition) !== null && _j !== void 0 ? _j : 50
        },
        coverage: coverage
    };
}
exports.buildFuzzyInputsFromResults = buildFuzzyInputsFromResults;
function getMissedAxesFromIncompleteGames(allGames, completedGames) {
    var missedAxes = {};
    var missed = allGames.filter(function (g) { return !completedGames.includes(g); });
    for (var _i = 0, missed_1 = missed; _i < missed_1.length; _i++) {
        var game = missed_1[_i];
        var axes = MAP[game];
        if (!axes)
            continue;
        for (var _a = 0, _b = Object.keys(axes); _a < _b.length; _a++) {
            var axis = _b[_a];
            missedAxes[axis] = true;
        }
    }
    return missedAxes;
}
exports.getMissedAxesFromIncompleteGames = getMissedAxesFromIncompleteGames;
