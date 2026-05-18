// src/utils/order-miniGames.ts
import { GameType } from "../types/mini-game-types";
import raw from "../config/default-test-config.json";
import {
  DecisionNode,
  getDefaultGameSequenceForGrade,
} from "../types/decision-tree";

export interface MiniGameInstance {
  gameType: GameType;
  config: Record<string, any>;
  // …etc
}

/**
 * Given the raw student test.miniGames list and your default JSON tree,
 * return a new array where the instances come in the same order
 * as they appear in the default decision-tree.
 */
export function orderMiniGamesByTree(
  instances: MiniGameInstance[],
  grade?: string | number | null,
): MiniGameInstance[] {
  // which gameTypes the teacher actually chose
  const picked = new Set<GameType>(instances.map((m) => m.gameType));

  const canonicalOrder =
    grade == null
      ? (raw.decisionTree as DecisionNode[]).map((node) => node.gameType)
      : getDefaultGameSequenceForGrade(grade);

  // walk the tree in order, picking only the ones we have
  const ordered: MiniGameInstance[] = [];
  for (const gameType of canonicalOrder) {
    if (picked.has(gameType)) {
      // find the matching instance
      const inst = instances.find((m) => m.gameType === gameType);
      if (inst) ordered.push(inst);
    }
  }

  return ordered;
}
