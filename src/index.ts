// src/index.ts
export * from "./types/mini-game-types";
export * from "./types/decision-tree";
export * from "./utils/order-miniGames";
export * from "./utils/config-loader";
export * from "./utils/generateQuestions/generateWhatNumberDoYouHear";
export * from "./utils/generateQuestions/generateChooseAnswer";
export * from "./utils/generateQuestions/generateVerticalOperation";
export * from "./utils/generateQuestions/generateFindCompositions";

import miniGames from "./config/mini-games.json";
import defaultTestConfig from "./config/default-test-config.json";
export { miniGames, defaultTestConfig };
