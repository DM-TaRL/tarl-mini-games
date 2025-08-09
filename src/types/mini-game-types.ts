// Shared types used by all mini-games
export type Operation =
  | "Addition"
  | "Subtraction"
  | "Multiplication"
  | "Division";

export type LanguageCode = "fr" | "ar" | "en";

export interface FindCompositionsConfig {
  minNumCompositions: number;
  maxNumberRange: number;
  operation: Operation;
  requiredCorrectAnswersMinimumPercent: number;
}

export interface VerticalOperationsConfig {
  numOperations: number;
  maxNumberRange: number;
  operationsAllowed: Operation[];
  requiredCorrectAnswersMinimumPercent: number;
  allowCarry?: boolean; // For Addition
  allowBorrow?: boolean; // For Subtraction
  allowMultiStepMul?: boolean; // For Multiplication (e.g., >1 digit in operand2)
  allowMultiStepDiv?: boolean; // For Division (e.g., not exact, remainder steps)
}

export interface ChooseAnswerConfig {
  numOptions: number;
  maxNumberRange: number;
  operationsAllowed: Operation[];
  numQuestions: number;
  requiredCorrectAnswersMinimumPercent: number;
}

export interface MultiStepProblemConfig {
  numQuestions: number;
  maxNumberRange: number;
  numSteps: number;
  operationsAllowed: Operation[];
  requiredCorrectAnswersMinimumPercent: number;
}

export interface FindPreviousNextNumberConfig {
  numQuestions: number;
  maxNumberRange: number;
  requiredCorrectAnswersMinimumPercent: number;
}

export interface TapMatchingPairsConfig {
  numPairs: number;
  maxNumberRange: number;
  requiredCorrectAnswersMinimumPercent: number;
}

export interface OrderNumbersConfig {
  numQuestions: number;
  maxNumberRange: number;
  maxNumbersInSequence: number;
  requiredCorrectAnswersMinimumPercent: number;
}

export interface CompareNumbersConfig {
  numQuestions: number;
  maxNumberRange: number;
  requiredCorrectAnswersMinimumPercent: number;
}

export interface WhatNumberDoYouHearConfig {
  numQuestions: number;
  maxNumberRange: number;
  requiredCorrectAnswersMinimumPercent: number;
}

export interface DecomposeNumberConfig {
  numQuestions: number;
  maxNumberRange: number;
  requiredCorrectAnswersMinimumPercent: number;
}

export interface WriteNumberInLettersConfig {
  numQuestions: number;
  maxNumberRange: number;
  requiredCorrectAnswersMinimumPercent: number;
}

export interface IdentifyPlaceValueConfig {
  numQuestions: number;
  maxNumberRange: number;
  requiredCorrectAnswersMinimumPercent: number;
}

export interface ReadNumberAloudConfig {
  numQuestions: number;
  maxNumberRange: number;
  displayTime: number;
  requiredCorrectAnswersMinimumPercent: number;
}

/**
 * The union of all mini‐game identifiers (must match IDs in mini‐games.json)
 */
export type GameType =
  | "find_compositions"
  | "vertical_operations"
  | "choose_answer"
  | "multi_step_problem"
  | "find_previous_next_number"
  | "tap_matching_pairs"
  | "order_numbers"
  | "compare_numbers"
  | "what_number_do_you_hear"
  | "decompose_number"
  | "write_number_in_letters"
  | "identify_place_value"
  | "read_number_aloud";
/**
 * The common params shape for any mini‐game
 */
export type CommonGameParams =
  | FindCompositionsConfig
  | VerticalOperationsConfig
  | ChooseAnswerConfig
  | MultiStepProblemConfig
  | FindPreviousNextNumberConfig
  | TapMatchingPairsConfig
  | OrderNumbersConfig
  | CompareNumbersConfig
  | WhatNumberDoYouHearConfig
  | DecomposeNumberConfig
  | WriteNumberInLettersConfig
  | IdentifyPlaceValueConfig
  | ReadNumberAloudConfig;

export const configLabels: Record<string, string> = {
  minNumCompositions: "الحد الأدنى لعدد التركيبات",
  numOperations: "عدد العمليات",
  operation: "العملية",
  numSteps: "عدد الخطوات",
  numPairs: "عدد الأزواج",
  maxNumberRange: "نطاق الأرقام الأقصى",
  operationsAllowed: "العمليات المسموح بها",
  requiredCorrectAnswersMinimumPercent:
    "النسبة المئوية للأجوبة الصحيحة المطلوبة",
  numOptions: "عدد الخيارات",
  numQuestions: "عدد الأسئلة",
  maxNumbersInSequence: "الحد الأقصى لطول السلسلة",
  displayTime: "زمن العرض (بالثواني)",
  allowCarry: "السماح بالاحتفاظ (الجمع)",
  allowBorrow: "السماح بالاستلاف (الطرح)",
  allowMultiStepMul: "السماح بضرب من عدة خطوات",
  allowMultiStepDiv: "السماح بالقسمة من عدة خطوات",
};

export const operationLabels: Record<string, string> = {
  Addition: "الجمع",
  Subtraction: "الطرح",
  Multiplication: "الضرب",
  Division: "القسمة",
};

export type TimeCategory = "fast" | "medium" | "slow";
