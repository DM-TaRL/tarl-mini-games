# 🧩 tarl-mini-games

> Shared configuration and utilities for Mathoria’s **DM-TaRL** mini-games and adaptive test logic.

This package provides:

- ✅ Mini-game configuration per grade
- ✅ Default adaptive test decision tree
- ✅ Game type definitions and shared config types
- ✅ Utility functions to load configs or reorder games
- ✅ Compatible with both **React** and **Angular**

---

## 📦 Installation

You must clone this repo locally and link it from your frontend project:

```bash
# From your web project root (e.g. math-level-test-web or math-web)
npm install ../tarl-mini-games
```

Use TypeScript for best typing support in both React and Angular projects.

---

## 📁 Exports Overview

```ts
// src/index.ts
export * from "./types/mini-game-types"; // all config types (shared between both web apps)
export * from "./types/decision-tree"; // decision tree node structures
export * from "./utils/order-miniGames"; // reorder mini-games based on decision tree
export * from "./utils/config-loader"; // load game config by type or grade

export { miniGames, defaultTestConfig }; // raw JSON config
```

---

## 🔧 Usage Examples

### 1. 🔄 Reorder Games by Decision Tree Flow

```ts
import { orderMiniGamesByTree } from "tarl-mini-games";

const testGames = [
  { gameType: "vertical_operations", config: {...} },
  { gameType: "choose_answer", config: {...} },
  // ...
];

const ordered = orderMiniGamesByTree(testGames);
```

### 2. 🧠 Load Default Game Config by Grade

```ts
import { getGameConfig } from "tarl-mini-games";

const config = getGameConfig("vertical_operations", "4");
// returns: { numOperations: 3, maxNumberRange: 3, ... }
```

### 3. 🌲 Walk the Adaptive Decision Tree

```ts
import { getDefaultDecisionTree, DecisionTreeRunner } from "tarl-mini-games";

const tree = getDefaultDecisionTree();
const runner = new DecisionTreeRunner(tree);

// After finishing a mini-game
const next = runner.recordAndAdvance("vertical_operations", true);
```

### 4. 🏗️ Build a Linear Tree (e.g. Teacher-Defined Test)

```ts
import { buildDefaultDecisionTree } from "tarl-mini-games";

const tree = buildDefaultDecisionTree([
  { gameType: "choose_answer" },
  { gameType: "vertical_operations" },
]);
```

---

## 🧪 Mini-Game Types & Parameters

```ts
import type { GameType, CommonGameParams } from "tarl-mini-games";

const type: GameType = "find_compositions";

const config: CommonGameParams = {
  minNumCompositions: 3,
  maxNumberRange: 5,
  operation: "Addition",
  requiredCorrectAnswersMinimumPercent: 75,
};
```

Includes full support for:

- `choose_answer`
- `vertical_operations`
- `multi_step_problem`
- `tap_matching_pairs`
- `read_number_aloud`
- …and many more!

---

## 📂 File Structure

```
src/
├── types/
│   ├── mini-game-types.ts        ← Game config types & enums
│   └── decision-tree.ts          ← DecisionNode, DecisionTreeRunner
├── utils/
│   ├── config-loader.ts          ← Load config per game/grade
│   └── order-miniGames.ts        ← Sort instances based on tree
├── config/
│   ├── mini-games.json           ← Definitions + grade overrides
│   └── default-test-config.json  ← Default decision tree per level
└── index.ts
```

---

## 🛠 Build Instructions

If modifying the code:

```bash
npm install
npm run build
```

This compiles to `/dist`, ready for consumption in your web projects.

---

## 🤝 Compatibility

- ✅ React (17 or 18)
- ✅ Angular with `tsconfig.paths` + `esModuleInterop`

---

## 📚 License

Internal usage for **Mathoria / DM-TaRL** only

---

## 🙋 Need Help?

For bugs, improvements, or questions, reach out via ClickUp.
