import { GameType } from "./mini-game-types";

export const FORGIVENESS_RULES = {
  defaultMaxMistakes: 3,
  overridePerGame: {
    vertical_operations: 3,
    choose_answer: 3,
    identify_place_value: 4,
    what_number_do_you_hear: 4,
    find_previous_next_number: 3,
    write_number_in_letters: 3,
    tap_matching_pairs: 3,
  },
};

export const MAX_ATTEMPTS = {
  defaultMaxAttempts: 2,
  overridePerGame: {
    vertical_operations: 3,
    choose_answer: 2,
    identify_place_value: 2,
    what_number_do_you_hear: 2,
    find_previous_next_number: 2,
    write_number_in_letters: 2,
    tap_matching_pairs: 2,
  },
};

export interface DecisionChild {
  /** “true” or “false” */
  condition: "true" | "false";
  nodeId: string;
}

export interface DecisionNode {
  nodeId: string;
  gameType: GameType;
  configKey: string; // e.g. "gradeConfig"
  children: DecisionChild[];
}

/** Tracks the state of a single node’s execution */
export class NodeState {
  attempts = 0;
  lastResult: boolean | null = null;

  recordResult(success: boolean) {
    this.attempts++;
    this.lastResult = success;
  }
}

/**
 * Walks a tree of DecisionNode to figure out “what’s the next node?”.
 */
export class DecisionTreeRunner {
  private nodesById: Record<string, DecisionNode> = {};
  private nodeStates: Record<string, NodeState> = {};

  constructor(public tree: DecisionNode[]) {
    for (const node of tree) {
      this.nodesById[node.nodeId] = node;
      this.nodeStates[node.nodeId] = new NodeState();
    }
  }

  /**
   * Call this after a mini-game finishes.
   * @param nodeId     the node that just ran
   * @param success    whether the student passed that node
   * @returns the next nodeId, or null if the flow is over
   */
  recordAndAdvance(nodeId: string, success: boolean): string | null {
    const state = this.nodeStates[nodeId];
    state.recordResult(success);

    const node = this.nodesById[nodeId];
    if (!node) throw new Error(`Unknown node "${nodeId}"`);

    // Get the maximum allowed attempts for this game type
    const maxAttempts =
      FORGIVENESS_RULES.overridePerGame[
        nodeId as keyof typeof MAX_ATTEMPTS.overridePerGame
      ] ?? MAX_ATTEMPTS.defaultMaxAttempts;

    // Check if player exceeded maximum allowed mistakes
    if (!success && state.attempts >= maxAttempts) {
      return null; // End the test if max mistakes reached
    }

    // If failed but still has attempts left, return same node to repeat
    if (!success && state.attempts < maxAttempts) {
      return nodeId;
    }

    // Only look for next node if succeeded or if we want to proceed despite failure
    const match = node.children.find((c) => c.condition === String(success));
    if (!match) return null; // no branch → end

    return match.nodeId;
  }

  recordAttempt(nodeId: string) {
    const state = this.nodeStates[nodeId];
    if (!state) {
      throw new Error(`Unknown node "${nodeId}"`);
    }
    state.attempts++;
    state.lastResult = null; // Reset last result since this is a new attempt
  }

  isLastAttempt(nodeId: string): boolean {
    const state = this.nodeStates[nodeId];
    const maxMistakes =
      FORGIVENESS_RULES.overridePerGame[
        nodeId as keyof typeof FORGIVENESS_RULES.overridePerGame
      ] ?? FORGIVENESS_RULES.defaultMaxMistakes;

    return state.attempts >= maxMistakes - 1;
  }

  /** First element in `tree` is the root */
  getRoot(): DecisionNode {
    if (this.tree.length === 0) throw new Error("Empty decision tree");
    return this.tree[0];
  }

  public getNodeState(id: string): NodeState {
    return this.nodeStates[id];
  }
}

/**
 * Given a flat array of MiniGameInstance (in the order teachers laid them out),
 * build a default “linear” decision tree where each node:
 *   - on true  → next node
 *   - on false → repeat same node
 * The last node emits only the “false” branch (you’ll get `null` on success).
 */
export function buildDefaultDecisionTree(
  miniGames: Array<{ gameType: string }>
): DecisionNode[] {
  return miniGames.map((mg, idx) => {
    const isLast = idx === miniGames.length - 1;
    const trueTarget = !isLast ? miniGames[idx + 1].gameType : "";
    const children: DecisionChild[] = [];

    if (!isLast) {
      children.push({ condition: "true", nodeId: trueTarget });
    }

    // always allow a retry on failure
    children.push({ condition: "false", nodeId: mg.gameType });

    return {
      nodeId: mg.gameType,
      gameType: mg.gameType as GameType,
      configKey: "gradeConfig",
      children,
    };
  });
}
