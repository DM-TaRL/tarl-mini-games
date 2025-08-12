import { WeakSkill } from "./weak-skill-detector";

export type FuzzySkillScores = {
  arithmetic_fluidity: number; // e.g. 0.3 means weak
  number_sense: number;
  sequential_thinking: number;
  comparison_skill: number;
  visual_matching: number;
  audio_recognition: number;
};

/**
 * Compute normalized fuzzy skill scores from extracted weakSkills.
 */
export function computeFuzzyScores(
  weakSkills: WeakSkill[] = []
): FuzzySkillScores {
  const score = (penalty: number, max = 5): number =>
    Math.max(0, 1 - penalty / max);

  const arithmeticMistakes = weakSkills.filter(
    (s) =>
      s.questionType === "Arithmetic" ||
      ["Addition", "Subtraction", "Multiplication", "Division"].includes(
        s.operation || ""
      )
  ).length;

  const numberSenseMistakes = weakSkills.filter(
    (s) =>
      ["PlaceValueIdentification", "Decomposition"].includes(
        s.questionType || ""
      ) || (s.mistakeType || "").includes("PlaceValue")
  ).length;

  const sequentialThinkingMistakes = weakSkills.filter(
    (s) =>
      ["PreviousNumber", "NextNumber", "Ordering"].includes(
        s.questionType || ""
      ) ||
      ["MissingNext", "MissingPrevious", "TensTransitionMistake"].includes(
        s.mistakeType || ""
      )
  ).length;

  const comparisonMistakes = weakSkills.filter(
    (s) => s.questionType === "Comparison"
  ).length;

  const visualMatchingMistakes = weakSkills.filter(
    (s) => s.questionType === "MatchingPair"
  ).length;

  const audioRecognitionMistakes = weakSkills.filter(
    (s) => s.questionType === "NumberRecognitionByAudio"
  ).length;

  return {
    arithmetic_fluidity: score(arithmeticMistakes),
    number_sense: score(numberSenseMistakes),
    sequential_thinking: score(sequentialThinkingMistakes),
    comparison_skill: score(comparisonMistakes),
    visual_matching: score(visualMatchingMistakes),
    audio_recognition: score(audioRecognitionMistakes),
  };
}

type FuzzyLevel = "low" | "medium" | "high";

function toFuzzyLevel(score: number): FuzzyLevel {
  if (score <= 0.33) return "low";
  if (score <= 0.66) return "medium";
  return "high";
}

function inferGradeLevel(skills: FuzzySkillScores): number {
  const {
    arithmetic_fluidity,
    number_sense,
    sequential_thinking,
    comparison_skill,
    visual_matching,
    audio_recognition,
  } = skills;

  // Weighted average with fuzzy logic
  const score =
    0.25 * arithmetic_fluidity +
    0.2 * number_sense +
    0.15 * sequential_thinking +
    0.15 * comparison_skill +
    0.15 * visual_matching +
    0.1 * audio_recognition;

  if (score <= 0.2) return 1; // severe difficulty
  if (score <= 0.35) return 2;
  if (score <= 0.5) return 3;
  if (score <= 0.65) return 4;
  if (score <= 0.7) return 5;
  return 6;
}

type RemediationTier = "light" | "moderate" | "intense";

function inferRemediationTier(skills: FuzzySkillScores): RemediationTier {
  const averageScore = Object.values(skills).reduce((a, b) => a + b, 0) / 6;

  if (averageScore < 0.4) return "intense";
  if (averageScore < 0.7) return "moderate";
  return "light";
}

function getPeerGroupSignature(skills: FuzzySkillScores): string {
  const levels = Object.entries(skills).map(
    ([key, val]) => `${key}:${toFuzzyLevel(val)}`
  );
  return levels.join("|"); // unique fuzzy signature
}

export function evaluateFuzzyStudentProfile(skills: FuzzySkillScores) {
  const level = inferGradeLevel(skills);
  const tier = inferRemediationTier(skills);
  const peerGroup = getPeerGroupSignature(skills);

  return {
    inferredGrade: level,
    remediationTier: tier,
    peerGroupSignature: peerGroup,
    fuzzyLevels: Object.fromEntries(
      Object.entries(skills).map(([k, v]) => [k, toFuzzyLevel(v)])
    ),
  };
}
