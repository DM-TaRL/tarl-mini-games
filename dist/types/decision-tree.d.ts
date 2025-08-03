import { GameType } from "./mini-game-types";
export interface DecisionChild {
    /** “true” or “false” */
    condition: "true" | "false";
    nodeId: string;
}
export interface DecisionNode {
    nodeId: string;
    gameType: GameType;
    configKey: string;
    children: DecisionChild[];
}
/** Tracks the state of a single node’s execution */
export declare class NodeState {
    attempts: number;
    lastResult: boolean | null;
    recordResult(success: boolean): void;
}
/**
 * Walks a tree of DecisionNode to figure out “what’s the next node?”.
 */
export declare class DecisionTreeRunner {
    tree: DecisionNode[];
    private nodesById;
    private nodeStates;
    constructor(tree: DecisionNode[]);
    /**
     * Call this after a mini-game finishes.
     * @param nodeId     the node that just ran
     * @param success    whether the student passed that node
     * @returns the next nodeId, or null if the flow is over
     */
    recordAndAdvance(nodeId: string, success: boolean): string | null;
    /** First element in `tree` is the root */
    getRoot(): DecisionNode;
    getNodeState(id: string): NodeState;
}
/**
 * Given a flat array of MiniGameInstance (in the order teachers laid them out),
 * build a default “linear” decision tree where each node:
 *   - on true  → next node
 *   - on false → repeat same node
 * The last node emits only the “false” branch (you’ll get `null` on success).
 */
export declare function buildDefaultDecisionTree(miniGames: Array<{
    gameType: string;
}>): DecisionNode[];
