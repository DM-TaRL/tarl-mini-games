import { GameType } from "../types/mini-game-types";
export interface MiniGameInstance {
    gameType: GameType;
    config: Record<string, any>;
}
/**
 * Given the raw student test.miniGames list and your default JSON tree,
 * return a new array where the instances come in the same order
 * as they appear in the default decision-tree.
 */
export declare function orderMiniGamesByTree(instances: MiniGameInstance[]): MiniGameInstance[];
