"use strict";
exports.__esModule = true;
exports.getFuzzyMembershipByAxisDifficulty = exports.computeGameDifficulty = void 0;
// This function computes difficulty score from a game configuration
function computeGameDifficulty(gameType, config) {
    var _a, _b;
    var difficultyWeights = {
        vertical_operations: function (cfg) {
            var _a, _b, _c, _d;
            var score = 0;
            score += ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2;
            score += ((_b = cfg.numOperations) !== null && _b !== void 0 ? _b : 1) * 1.5;
            score += ((_d = (_c = cfg.operationsAllowed) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 1) * 1.2;
            if (cfg.allowCarry)
                score += 3;
            if (cfg.allowBorrow)
                score += 3;
            if (cfg.allowMultiStepMul)
                score += 2.5;
            if (cfg.allowMultiStepDiv)
                score += 2.5;
            return score;
        },
        choose_answer: function (cfg) {
            var _a, _b, _c, _d, _e;
            var score = 0;
            score += ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2;
            score += (_b = cfg.numQuestions) !== null && _b !== void 0 ? _b : 1;
            score += ((_d = (_c = cfg.operationsAllowed) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 1) * 1.5;
            score += (_e = cfg.numOptions) !== null && _e !== void 0 ? _e : 2;
            return score;
        },
        find_compositions: function (cfg) {
            var _a, _b;
            var score = 0;
            score += ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2;
            score += (_b = cfg.minNumCompositions) !== null && _b !== void 0 ? _b : 1;
            return score;
        },
        multi_step_problem: function (cfg) {
            var _a, _b, _c, _d, _e;
            var score = 0;
            score += ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2;
            score += (_b = cfg.numQuestions) !== null && _b !== void 0 ? _b : 1;
            score += ((_c = cfg.numSteps) !== null && _c !== void 0 ? _c : 1) * 1.5;
            score += ((_e = (_d = cfg.operationsAllowed) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 1) * 1.5;
            if (cfg.allowCarry)
                score += 1.5;
            if (cfg.allowBorrow)
                score += 1.5;
            if (cfg.allowMultiStepMul)
                score += 2.5;
            if (cfg.allowMultiStepDiv)
                score += 2.5;
            return score;
        },
        find_previous_next_number: function (cfg) {
            var _a, _b;
            return ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2 + ((_b = cfg.numQuestions) !== null && _b !== void 0 ? _b : 1);
        },
        order_numbers: function (cfg) {
            var _a, _b, _c;
            return (((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2 +
                ((_b = cfg.numQuestions) !== null && _b !== void 0 ? _b : 1) +
                ((_c = cfg.maxNumbersInSequence) !== null && _c !== void 0 ? _c : 4));
        },
        compare_numbers: function (cfg) {
            var _a, _b;
            return ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2 + ((_b = cfg.numQuestions) !== null && _b !== void 0 ? _b : 1);
        },
        tap_matching_pairs: function (cfg) {
            var _a, _b;
            return ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2 + ((_b = cfg.numPairs) !== null && _b !== void 0 ? _b : 4);
        },
        write_number_in_letters: function (cfg) {
            var _a, _b;
            return ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2 + ((_b = cfg.numQuestions) !== null && _b !== void 0 ? _b : 2);
        },
        decompose_number: function (cfg) {
            var _a, _b;
            return ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2 + ((_b = cfg.numQuestions) !== null && _b !== void 0 ? _b : 2);
        },
        identify_place_value: function (cfg) {
            var _a, _b;
            return ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2 + ((_b = cfg.numQuestions) !== null && _b !== void 0 ? _b : 2);
        },
        read_number_aloud: function (cfg) {
            var _a, _b, _c;
            return (((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2 +
                ((_b = cfg.numQuestions) !== null && _b !== void 0 ? _b : 2) +
                (30 - ((_c = cfg.displayTime) !== null && _c !== void 0 ? _c : 30)) * 0.1);
        },
        what_number_do_you_hear: function (cfg) {
            var _a, _b;
            return ((_a = cfg.maxNumberRange) !== null && _a !== void 0 ? _a : 1) * 2 + ((_b = cfg.numQuestions) !== null && _b !== void 0 ? _b : 2);
        }
    };
    var score = (_b = (_a = difficultyWeights[gameType]) === null || _a === void 0 ? void 0 : _a.call(difficultyWeights, config)) !== null && _b !== void 0 ? _b : 1;
    return Math.min(100, Math.max(1, score * 5)); // Normalize to [1,100]
}
exports.computeGameDifficulty = computeGameDifficulty;
function getFuzzyMembershipByAxisDifficulty(difficulty) {
    var clamp = function (x, min, max) {
        if (min === void 0) { min = 0; }
        if (max === void 0) { max = 100; }
        return Math.max(min, Math.min(max, x));
    };
    var shift = (difficulty - 50) / 2;
    return {
        low: [0, 0, clamp(50 + shift)],
        medium: [
            clamp(30 + shift / 2),
            clamp(50 + shift),
            clamp(70 + shift / 2),
        ],
        high: [clamp(50 + shift), 100, 100]
    };
}
exports.getFuzzyMembershipByAxisDifficulty = getFuzzyMembershipByAxisDifficulty;
