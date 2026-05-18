import { MiniGameInstance } from "../utils/order-miniGames";
import defaultTestConfigJson from "../config/default-test-config.json";
import { GameType } from "./mini-game-types";

// ---------------------------------------------------------------------------
// FORGIVENESS_RULES
// How many MISTAKES are tolerated within a single game attempt before that
// attempt is considered failed and the student must retry (or exhaust retries).
// ---------------------------------------------------------------------------
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
    multi_step_problem: 3,
  },
};

// ---------------------------------------------------------------------------
// MAX_ATTEMPTS
// How many ATTEMPTS (replays of the same game) a student gets before the
// test advances past this game or ends.
// ---------------------------------------------------------------------------
export const MAX_ATTEMPTS = {
  defaultMaxAttempts: 2,
  overridePerGame: {
    vertical_operations: 3,
    choose_answer: 2,
    identify_place_value: 2,
    what_number_do_you_hear: 2,
    find_previous_next_number: 2,
    write_number_in_letters: 2,
    tap_matching_pairs: 3,
    multi_step_problem: 2,
  },
};

// ---------------------------------------------------------------------------
// RELAX_THETA
// Per-game config deltas applied on each retry. Keys match the field names
// in the config interfaces in mini-game-types.ts. Values are ADDED (negative
// = reduce). Applied after each failed attempt to ease difficulty.
// ---------------------------------------------------------------------------
export const RELAX_THETA: Partial<Record<GameType, Record<string, number>>> = {
  tap_matching_pairs: { maxNumberRange: -1, numPairs: -1 },
  what_number_do_you_hear: { maxNumberRange: -1 },
  read_number_aloud: { maxNumberRange: -1 },
  find_previous_next_number: { maxNumberRange: -1 },
  compare_numbers: { maxNumberRange: -1 },
  order_numbers: { maxNumberRange: -1, maxNumbersInSequence: -1 },
  decompose_number: { maxNumberRange: -1 },
  identify_place_value: { maxNumberRange: -1 },
  write_number_in_letters: { maxNumberRange: -1 },
  choose_answer: { maxNumberRange: -1, numOptions: -1 },
  find_compositions: { maxNumberRange: -1 },
  vertical_operations: { maxNumberRange: -1, numOperations: -1 },
  multi_step_problem: { maxNumberRange: -1, numSteps: -1 },
};

// ---------------------------------------------------------------------------
// GRADE_ENTRY_NODE
// TaRL-aligned entry point per grade for the diagnostic assessment.
// The roadmap starts every tested level with number reading.
// ---------------------------------------------------------------------------
export const GRADE_ENTRY_NODE: Record<string, GameType> = {
  "1": "read_number_aloud",
  "2": "read_number_aloud",
  "3": "read_number_aloud",
  "4": "read_number_aloud",
  "5": "read_number_aloud",
  "6": "read_number_aloud",
};

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
export interface DecisionChild {
  /** "true" or "false" */
  condition: "true" | "false";
  nodeId: string;
}

export interface DecisionNode {
  nodeId: string;
  gameType: GameType;
  configKey: string; // e.g. "gradeConfig"
  children: DecisionChild[];
}

type GradeDecisionTreeSequences = Record<string, GameType[]>;

const gradeDecisionTreeSequences =
  ((defaultTestConfigJson as any).gradeDecisionTreeSequences ||
    {}) as GradeDecisionTreeSequences;

function normalizeGradeKey(grade?: string | number | null): string {
  return grade == null ? "default" : String(grade);
}

function getSequenceForGrade(grade?: string | number | null): GameType[] {
  const gradeKey = normalizeGradeKey(grade);
  return (
    gradeDecisionTreeSequences[gradeKey] ||
    gradeDecisionTreeSequences.default ||
    []
  );
}

function buildLinearDecisionTreeFromGameTypes(
  gameTypes: GameType[],
): DecisionNode[] {
  return gameTypes.map((gameType, i) => {
    const isLast = i === gameTypes.length - 1;
    const nextId = isLast ? null : gameTypes[i + 1];

    return {
      nodeId: gameType,
      gameType,
      configKey: "gradeConfig",
      children: isLast
        ? []
        : [
            { condition: "true", nodeId: nextId! },
            { condition: "false", nodeId: gameType },
          ],
    };
  });
}

// ---------------------------------------------------------------------------
// NodeState
// Tracks how many times this node has been attempted and what the last
// recorded outcome was. Attempts is incremented exactly once per attempt,
// in recordAttempt(). lastResult is only written when a final outcome is
// committed via recordResult().
// ---------------------------------------------------------------------------
export class NodeState {
  attempts = 0;
  lastResult: boolean | null = null;

  /** Called once per attempt, BEFORE the attempt starts. */
  incrementAttempt() {
    this.attempts++;
  }

  /** Called once when the attempt's final outcome is committed. */
  recordResult(success: boolean) {
    this.lastResult = success;
    // NOTE: does NOT increment attempts — incrementAttempt() already did that.
  }
}

// ---------------------------------------------------------------------------
// DecisionTreeRunner
// Walks a tree of DecisionNode to figure out “what’s the next node?”.
// ---------------------------------------------------------------------------
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
   * Call this BEFORE a mini-game attempt starts.
   * Increments the attempt counter for the node. This is the only place
   * attempts is incremented — do not increment it anywhere else.
   */
  recordAttempt(nodeId: string): void {
    const state = this.nodeStates[nodeId];
    if (!state) throw new Error(`Unknown node "${nodeId}"`);
    state.incrementAttempt();
    // Do NOT reset lastResult here — it holds the previous attempt's outcome
    // and is needed by analytics readers between attempts.
  }

  /**
   * Call this after a mini-game attempt ENDS (success or final failure).
   * Commits the outcome and returns the next nodeId, or null to end the test.
   *
   * Do NOT call this on intermediate retries — only call it when:
   *   (a) the student passed, or
   *   (b) the student failed and max attempts have been exhausted.
   *
   * The caller (TestPage) is responsible for detecting the retry case and
   * re-rendering the game without calling this method.
   * @param nodeId     the node that just ran
   * @param success    whether the student passed that node
   * @returns the next nodeId, or null if the flow is over
   */
  recordAndAdvance(nodeId: string, success: boolean): void {
    const node = this.nodesById[nodeId];
    if (!node) throw new Error(`Unknown node "${nodeId}"`);

    // Commit the final outcome. Does NOT increment attempts.
    const state = this.nodeStates[nodeId];
    state.recordResult(success);
  }

  isLastAttempt(nodeId: string): boolean {
    const state = this.nodeStates[nodeId];
    const maxAttempts =
      MAX_ATTEMPTS.overridePerGame[ // ← was FORGIVENESS_RULES
        nodeId as keyof typeof MAX_ATTEMPTS.overridePerGame
      ] ?? MAX_ATTEMPTS.defaultMaxAttempts; // ← was defaultMaxMistakes
    return state.attempts >= maxAttempts - 1;
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

// ---------------------------------------------------------------------------
// Tree builders
// ---------------------------------------------------------------------------

/**
 * Builds a linear decision tree from a teacher-ordered game list.
 * Each node: true → next, false → retry same.
 * The last node has no children (null on success ends the test).
 *
 * Use this as the primary builder. buildDefaultDecisionTree is kept only
 * for backward compatibility with existing call sites; it produces identical
 * output via this function.
 */

export function buildDecisionTreeFromSequence(
  instances: MiniGameInstance[],
): DecisionNode[] {
  return buildLinearDecisionTreeFromGameTypes(
    instances.map((inst) => inst.gameType),
  );
}

export function getDefaultGameSequenceForGrade(
  grade?: string | number | null,
): GameType[] {
  return [...getSequenceForGrade(grade)];
}

export function buildDefaultDecisionTreeForGrade(
  grade?: string | number | null,
): DecisionNode[] {
  return buildLinearDecisionTreeFromGameTypes(getSequenceForGrade(grade));
}

/**
 * @deprecated Use buildDecisionTreeFromSequence instead.
 * Kept for backward compatibility — delegates to buildDecisionTreeFromSequence.
 */
export function buildDefaultDecisionTree(
  miniGames: Array<{ gameType: string }>,
  grade?: string | number | null,
): DecisionNode[] {
  if (grade != null) {
    const picked = new Set(miniGames.map((mg) => mg.gameType as GameType));
    const ordered = getSequenceForGrade(grade)
      .filter((gameType) => picked.has(gameType))
      .map((gameType) => ({ gameType }));

    return buildDecisionTreeFromSequence(ordered as MiniGameInstance[]);
  }

  return buildDecisionTreeFromSequence(
    miniGames.map((mg) => ({
      gameType: mg.gameType as GameType,
    })) as MiniGameInstance[],
  );
}
