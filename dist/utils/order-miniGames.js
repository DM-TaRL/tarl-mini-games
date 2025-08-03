import raw from "../config/default-test-config.json";
/**
 * Given the raw student test.miniGames list and your default JSON tree,
 * return a new array where the instances come in the same order
 * as they appear in the default decision-tree.
 */
export function orderMiniGamesByTree(instances) {
    // which gameTypes the teacher actually chose
    const picked = new Set(instances.map((m) => m.gameType));
    // load the canonical tree
    const fullTree = raw.decisionTree;
    // walk the tree in order, picking only the ones we have
    const ordered = [];
    for (const node of fullTree) {
        if (picked.has(node.gameType)) {
            // find the matching instance
            const inst = instances.find((m) => m.gameType === node.gameType);
            if (inst)
                ordered.push(inst);
        }
    }
    return ordered;
}
