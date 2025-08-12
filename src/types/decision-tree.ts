import { GameType } from "./mini-game-types";
import raw from "./../config/default-test-config.json";

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

    // NEW LOGIC: always advance linearly if possible, even on failure.
    // Try to pick a branch for this result; if none, try a "true" branch (forward) to avoid being stuck.
    let match = node.children.find((c) => c.condition === String(success));
    if (!match) {
      // fallback: use any forward (true) branch
      match = node.children.find((c) => c.condition === "true");
    }
    if (!match) return null; // end of flow
    return match.nodeId || null;
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
 *   - on false → next node (modified logic so l'enfant passe tout le test)
 * The last node has no children → whatever the result, flow ends.
 */
export function buildDefaultDecisionTree(
  miniGames: Array<{ gameType: string }>
): DecisionNode[] {
  return miniGames.map((mg, idx) => {
    const isLast = idx === miniGames.length - 1;
    const trueTarget = !isLast ? miniGames[idx + 1].gameType : "";
    const children: DecisionChild[] = [];

    // On success go to next (if any)
    if (!isLast) {
      children.push({ condition: "true", nodeId: trueTarget });
    }

    // On failure ALSO go to next (no repeat loops) so the child passe tous les jeux
    if (!isLast) {
      children.push({ condition: "false", nodeId: trueTarget });
    }
    // If last: no children so flow ends whatever the result

    return {
      nodeId: mg.gameType,
      gameType: mg.gameType as GameType,
      configKey: "gradeConfig",
      children,
    };
  });
}
