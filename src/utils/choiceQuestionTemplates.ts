import { Operation } from "../types/mini-game-types";

// choiceQuestionTemplates.ts
interface QuestionTemplate {
  id: string;
  templates: {
    ar: string;
    fr: string;
    en: string;
  };
  operation: Operation;
  variables: string[]; // e.g., ['A', 'B'] or ['k', 'p']
  generateNumbers: (maxDigits: number) => Record<string, number>;
  correctExpression: (nums: Record<string, number>) => string;
  generateWrongExpressions: (
    nums: Record<string, number>,
    correct: string,
  ) => string[];
}

export interface GeneratedQuestion {
  text: {
    ar: string;
    fr: string;
    en: string;
  };
  numbersInOptions: number[];
  operationsInOptions: Operation[];
  options: Array<{
    text: string;
    correct: boolean;
  }>;
}

export interface GeneratorConfig {
  maxDigitsRange: number[];
  questionsPerDigitRange: number;
  optionsPerQuestion: number;
  languages: ("ar" | "fr" | "en")[];
}

export const templates: QuestionTemplate[] = [
  {
    id: "addition-basic",
    templates: {
      ar: "لديك {A} درهم ومنحك والده {B} درهما. كم أصبح لديك من درهم؟",
      fr: "Tu as {A} dirhams et ton père t'a donné {B} dirhams. Combien de dirhams as-tu maintenant ?",
      en: "You have {A} dirhams and your father gave you {B} dirhams. How many dirhams do you have now?",
    },
    operation: "Addition",
    variables: ["A", "B"],
    // 1. addition-basic
    generateNumbers: (maxDigits) => {
      const min = maxDigits === 1 ? 1 : Math.pow(10, maxDigits - 1);
      const max = Math.pow(10, maxDigits) - 1;
      const A = Math.floor(Math.random() * (max - min + 1)) + min;
      const B = Math.floor(Math.random() * (max - min + 1)) + min;
      return { A, B };
    },
    correctExpression: (nums) => `${nums.A} + ${nums.B}`,
    generateWrongExpressions: (nums, correct) => [
      `${nums.A} - ${nums.B}`,
      `${nums.B} - ${nums.A}`,
      `${nums.A} × ${nums.B}`,
      `${nums.A} + ${nums.A}`,
      `${nums.B} + ${nums.B}`,
    ],
  },
  {
    id: "subtraction-basic",
    templates: {
      ar: "كان لديك {A} تفاحة وأكلت {B}. كم بقي؟",
      fr: "Tu avais {A} pommes et tu en as mangé {B}. Combien en reste-t-il ?",
      en: "You had {A} apples and ate {B}. How many are left?",
    },
    operation: "Subtraction",
    variables: ["A", "B"],
    // 2. subtraction-basic
    generateNumbers: (maxDigits) => {
      const min = maxDigits === 1 ? 1 : Math.pow(10, maxDigits - 1);
      const max = Math.pow(10, maxDigits) - 1;
      const A = Math.floor(Math.random() * (max - min + 1)) + min;
      // Ensure B is smaller than A, but still the same digit length
      const B = Math.floor(Math.random() * (A - min + 1)) + min;
      return { A, B };
    },
    correctExpression: (nums) => `${nums.A} - ${nums.B}`,
    generateWrongExpressions: (nums, correct) => [
      `${nums.A} + ${nums.B}`,
      `${nums.B} - ${nums.A}`,
      `${nums.A} × ${nums.B}`,
      `${nums.A} - ${nums.A}`,
      `${nums.B} + ${nums.B}`,
    ],
  },
  {
    id: "multiplication-count",
    templates: {
      ar: "لدى {k} صناديق، كل صندوق يحتوي على {p} قطعة. كم قطعة في المجموع؟",
      fr: "Il y a {k} boîtes, chaque boîte contient {p} pièces. Combien y a-t-il de pièces en tout ?",
      en: "There are {k} boxes, each box contains {p} pieces. How many pieces are there in total?",
    },
    operation: "Multiplication",
    variables: ["k", "p"],
    // 3. multiplication-count
    generateNumbers: (maxDigits) => {
      const factorDigits = Math.max(1, Math.floor(maxDigits / 2));
      const min = factorDigits === 1 ? 2 : Math.pow(10, factorDigits - 1);
      const max = Math.pow(10, factorDigits) - 1;
      const k = Math.floor(Math.random() * (max - min + 1)) + min;
      const p = Math.floor(Math.random() * (max - min + 1)) + min;
      return { k, p };
    },
    correctExpression: (nums) => `${nums.k} × ${nums.p}`,
    generateWrongExpressions: (nums, correct) => [
      `${nums.k} + ${nums.p}`,
      `${nums.k} - ${nums.p}`,
      `${nums.p} - ${nums.k}`,
      `${nums.k} × (${nums.p} + 1)`,
      `(${nums.k} + 1) × ${nums.p}`,
    ],
  },
  {
    id: "multiplication-price",
    templates: {
      ar: "اشترى أحمد {k} كيلو من التفاح بسعر {p} درهمًا للكيلو. كم دفع أحمد في المجمل؟",
      fr: "Ahmed a acheté {k} kilos de pommes à {p} dirhams le kilo. Combien Ahmed a-t-il payé en tout ?",
      en: "Ahmed bought {k} kilos of apples at {p} dirhams per kilo. How much did Ahmed pay in total?",
    },
    operation: "Multiplication",
    variables: ["k", "p"],
    // 4. multiplication-price
    generateNumbers: (maxDigits) => {
      const factorDigits = Math.max(1, Math.floor(maxDigits / 2));
      const min = factorDigits === 1 ? 2 : Math.pow(10, factorDigits - 1);
      const max = Math.pow(10, factorDigits) - 1;
      const k = Math.floor(Math.random() * (max - min + 1)) + min;
      const p = Math.floor(Math.random() * (max - min + 1)) + min;
      return { k, p };
    },
    correctExpression: (nums) => `${nums.k} × ${nums.p}`,
    generateWrongExpressions: (nums, correct) => [
      `${nums.k} + ${nums.p}`,
      `${nums.p} - ${nums.k}`,
      `${nums.k} × (${nums.p} - 1)`,
      `${nums.p} × ${nums.k} + ${nums.k}`,
      `${nums.k} + ${nums.p} × 2`,
    ],
  },
  {
    id: "division-basic",
    templates: {
      ar: "لدى {A} قطعة حلوى، أريد توزيعها بالتساوي على {b} أطفال. كم قطعة يحصل كل طفل؟",
      fr: "J'ai {A} bonbons, je veux les partager équitablement entre {b} enfants. Combien de bonbons chaque enfant recevra-t-il ?",
      en: "I have {A} candies, I want to share them equally among {b} children. How many candies will each child get?",
    },
    operation: "Division",
    variables: ["A", "b"],
    // 5. division-basic
    generateNumbers: (maxDigits) => {
      const min = maxDigits === 1 ? 1 : Math.pow(10, maxDigits - 1);
      const max = Math.pow(10, maxDigits) - 1;
      const b = Math.floor(Math.random() * 8) + 2; // Keep divisor simple (2-9)

      // Target A = b * x, ensuring A stays perfectly within the digit range
      const minX = Math.ceil(min / b);
      const maxX = Math.floor(max / b);
      const x = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
      const A = b * x;
      return { A, b };
    },
    correctExpression: (nums) => `${nums.A} ÷ ${nums.b}`,
    generateWrongExpressions: (nums, correct) => [
      `${nums.A} × ${nums.b}`,
      `${nums.A} + ${nums.b}`,
      `${nums.A} - ${nums.b}`,
      `${nums.b} ÷ ${nums.A}`,
      `${nums.A} ÷ (${nums.b} + 1)`,
    ],
  },
  {
    id: "subtraction-money",
    templates: {
      ar: "لدى أحمد {A} درهما، وأعطى {B} درهما لصديقه. كم تبقى لديه؟",
      fr: "Ahmed a {A} dirhams, et il a donné {B} dirhams à son ami. Combien lui reste-t-il ?",
      en: "Ahmed has {A} dirhams, and he gave {B} dirhams to his friend. How much does he have left?",
    },
    operation: "Subtraction",
    variables: ["A", "B"],
    // 6. subtraction-money
    generateNumbers: (maxDigits) => {
      const min = maxDigits === 1 ? 1 : Math.pow(10, maxDigits - 1);
      const max = Math.pow(10, maxDigits) - 1;
      const A = Math.floor(Math.random() * (max - min + 1)) + min;
      const B = Math.floor(Math.random() * (A - min + 1)) + min;
      return { A, B };
    },
    correctExpression: (nums) => `${nums.A} - ${nums.B}`,
    generateWrongExpressions: (nums, correct) => [
      `${nums.A} + ${nums.B}`,
      `${nums.B} - ${nums.A}`,
      `${nums.A} × ${nums.B}`,
      `${nums.A} ÷ ${nums.B}`,
      `${nums.A} - (${nums.B} - 1)`,
    ],
  },
];
