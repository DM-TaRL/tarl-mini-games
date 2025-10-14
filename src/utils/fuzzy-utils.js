"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFuzzyMembershipByAxisDifficulty = exports.computeGameDifficulty = void 0;
// This function computes difficulty score from a game configuration
function computeGameDifficulty(gameType, config) {
    const difficultyWeights = {
        vertical_operations: (cfg) => {
            let score = 0;
            score += (cfg.maxNumberRange ?? 1) * 2;
            score += (cfg.numOperations ?? 1) * 1.5;
            score += (cfg.operationsAllowed?.length ?? 1) * 1.2;
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
        choose_answer: (cfg) => {
            let score = 0;
            score += (cfg.maxNumberRange ?? 1) * 2;
            score += cfg.numQuestions ?? 1;
            score += (cfg.operationsAllowed?.length ?? 1) * 1.5;
            score += cfg.numOptions ?? 2;
            return score;
        },
        find_compositions: (cfg) => {
            let score = 0;
            score += (cfg.maxNumberRange ?? 1) * 2;
            score += cfg.minNumCompositions ?? 1;
            return score;
        },
        multi_step_problem: (cfg) => {
            let score = 0;
            score += (cfg.maxNumberRange ?? 1) * 2;
            score += cfg.numQuestions ?? 1;
            score += (cfg.numSteps ?? 1) * 1.5;
            score += (cfg.operationsAllowed?.length ?? 1) * 1.5;
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
        find_previous_next_number: (cfg) => {
            return (cfg.maxNumberRange ?? 1) * 2 + (cfg.numQuestions ?? 1);
        },
        order_numbers: (cfg) => {
            return ((cfg.maxNumberRange ?? 1) * 2 +
                (cfg.numQuestions ?? 1) +
                (cfg.maxNumbersInSequence ?? 4));
        },
        compare_numbers: (cfg) => {
            return (cfg.maxNumberRange ?? 1) * 2 + (cfg.numQuestions ?? 1);
        },
        tap_matching_pairs: (cfg) => {
            return (cfg.maxNumberRange ?? 1) * 2 + (cfg.numPairs ?? 4);
        },
        write_number_in_letters: (cfg) => {
            return (cfg.maxNumberRange ?? 1) * 2 + (cfg.numQuestions ?? 2);
        },
        decompose_number: (cfg) => {
            return (cfg.maxNumberRange ?? 1) * 2 + (cfg.numQuestions ?? 2);
        },
        identify_place_value: (cfg) => {
            return (cfg.maxNumberRange ?? 1) * 2 + (cfg.numQuestions ?? 2);
        },
        read_number_aloud: (cfg) => {
            return ((cfg.maxNumberRange ?? 1) * 2 +
                (cfg.numQuestions ?? 2) +
                (30 - (cfg.displayTime ?? 30)) * 0.1);
        },
        what_number_do_you_hear: (cfg) => {
            return (cfg.maxNumberRange ?? 1) * 2 + (cfg.numQuestions ?? 2);
        },
    };
    const score = difficultyWeights[gameType]?.(config) ?? 1;
    return Math.min(100, Math.max(1, score * 5)); // Normalize to [1,100]
}
exports.computeGameDifficulty = computeGameDifficulty;
function getFuzzyMembershipByAxisDifficulty(difficulty) {
    const clamp = (x, min = 0, max = 100) => Math.max(min, Math.min(max, x));
    const shift = (difficulty - 50) / 2;
    return {
        low: [0, 0, clamp(50 + shift)],
        medium: [
            clamp(30 + shift / 2),
            clamp(50 + shift),
            clamp(70 + shift / 2),
        ],
        high: [clamp(50 + shift), 100, 100],
    };
}
exports.getFuzzyMembershipByAxisDifficulty = getFuzzyMembershipByAxisDifficulty;
