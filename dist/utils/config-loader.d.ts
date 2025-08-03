import miniGamesJson from "../config/mini-games.json";
import defaultTestConfigJson from "../config/default-test-config.json";
import { CommonGameParams, GameType } from "../types/mini-game-types";
import { DecisionNode } from "../types/decision-tree";
export declare function getGameConfig(type: GameType, grade: string): CommonGameParams;
/**
 * Returns the raw defaultConfig object for a given gameType,
 * so you can inspect gradeConfig + any other keys.
 */
export declare function getGameDefaultConfig(type: GameType): any;
/**
 * Grab the JSON decisionTree array from our default-test-config.json
 */
export declare function getDefaultDecisionTree(): DecisionNode[];
export { miniGamesJson as miniGames, defaultTestConfigJson as defaultTestConfig, };
