// src/utils/config-loader.ts
import miniGamesJson from "../config/mini-games.json";
import defaultTestConfigJson from "../config/default-test-config.json";
import { CommonGameParams, GameType } from "../types/mini-game-types";
import {
  buildDefaultDecisionTreeForGrade,
  DecisionNode,
} from "../types/decision-tree";

// pull out the miniGames map in a typed way
const miniGames: Record<GameType, any> = (miniGamesJson as any).miniGames;

export function getGameConfig(type: GameType, grade: string): CommonGameParams {
  const game = miniGames[type];
  if (!game) {
    throw new Error(`Game type ${type} not found in mini-games.json`);
  }
  const gradeConfig = game.defaultConfig.gradeConfig as Record<string, any>;
  // pick the grade override or fall back to “default”
  const cfg = grade in gradeConfig ? gradeConfig[grade] : gradeConfig.default;
  return cfg as CommonGameParams;
}

/**
 * Returns the raw defaultConfig object for a given gameType,
 * so you can inspect gradeConfig + any other keys.
 */
export function getGameDefaultConfig(type: GameType): any {
  const game = miniGames[type];
  if (!game) {
    throw new Error(`Game type ${type} not found in mini-games.json`);
  }
  return game.defaultConfig;
}

/**
 * Grab the default decision tree for a grade. Without a grade, this returns
 * the legacy canonical tree from default-test-config.json.
 */
export function getDefaultDecisionTree(
  grade?: string | number | null,
): DecisionNode[] {
  if (grade != null) {
    return buildDefaultDecisionTreeForGrade(grade);
  }

  return (defaultTestConfigJson as any).decisionTree || [];
}

export {
  miniGamesJson as miniGames,
  defaultTestConfigJson as defaultTestConfig,
};
