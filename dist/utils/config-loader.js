// src/utils/config-loader.ts
import miniGamesJson from "../config/mini-games.json";
import defaultTestConfigJson from "../config/default-test-config.json";
// pull out the miniGames map in a typed way
const miniGames = miniGamesJson.miniGames;
export function getGameConfig(type, grade) {
    const game = miniGames[type];
    if (!game) {
        throw new Error(`Game type ${type} not found in mini-games.json`);
    }
    const gradeConfig = game.defaultConfig.gradeConfig;
    // pick the grade override or fall back to “default”
    const cfg = grade in gradeConfig ? gradeConfig[grade] : gradeConfig.default;
    return cfg;
}
/**
 * Returns the raw defaultConfig object for a given gameType,
 * so you can inspect gradeConfig + any other keys.
 */
export function getGameDefaultConfig(type) {
    const game = miniGames[type];
    if (!game) {
        throw new Error(`Game type ${type} not found in mini-games.json`);
    }
    return game.defaultConfig;
}
/**
 * Grab the JSON decisionTree array from our default-test-config.json
 */
export function getDefaultDecisionTree() {
    return defaultTestConfigJson.decisionTree || [];
}
export { miniGamesJson as miniGames, defaultTestConfigJson as defaultTestConfig, };
