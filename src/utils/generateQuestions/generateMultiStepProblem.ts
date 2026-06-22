import { MultiStepProblemConfig, Operation } from "../../types/mini-game-types";

export type MultiStepStep = {
  operation: Operation;
  operand1: number;
  operand2: number;
  correctAnswer: number;
};

export type MultiStepQuestion = {
  id: string;
  text: string;
  steps: MultiStepStep[];
};

export function evalStep(op: Operation, a: number, b: number): number {
  switch (op) {
    case "Addition": return a + b;
    case "Subtraction": return a - b;
    case "Multiplication": return a * b;
    case "Division": return Math.floor(a / b);
    default: return NaN as any;
  }
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const TEMPLATES = [
  {
    id: "karim-shopping",
    requiredOps: ["Addition", "Subtraction"],
    generate: (maxDigits: number, lang: "ar" | "fr" | "en"): MultiStepQuestion => {
      const maxVal = Math.pow(10, maxDigits) - 1;
      const minVal = maxDigits === 1 ? 5 : Math.pow(10, maxDigits - 1);

      const total = getRandomInt(minVal, maxVal);
      const item1 = getRandomInt(1, Math.floor(total / 2));
      const item2 = getRandomInt(1, Math.floor(total / 2) - 1);
      const step1Ans = item1 + item2;

      const text = {
        ar: `كريم لديه ${total} درهمًا. اشترى كتابًا بـ ${item1} درهمًا وقلمًا بـ ${item2} دراهم. كم تبقى لديه بعد الشراء؟`,
        fr: `Karim a ${total} dirhams. Il a acheté un livre pour ${item1} dirhams et un stylo pour ${item2} dirhams. Combien lui reste-t-il après l'achat ?`,
        en: `Karim has ${total} dirhams. He bought a book for ${item1} dirhams and a pen for ${item2} dirhams. How much does he have left?`,
      }[lang];

      return {
        id: `msp_karim_${Date.now()}_${Math.random()}`,
        text,
        steps: [
          { operation: "Addition" as Operation, operand1: item1, operand2: item2, correctAnswer: step1Ans },
          { operation: "Subtraction" as Operation, operand1: total, operand2: step1Ans, correctAnswer: total - step1Ans },
        ],
      };
    },
  },
  {
    id: "worker-wage",
    requiredOps: ["Multiplication"],
    generate: (maxDigits: number, lang: "ar" | "fr" | "en"): MultiStepQuestion => {
      const maxVal = Math.pow(10, maxDigits) - 1;
      const minVal = maxDigits === 1 ? 2 : Math.pow(10, maxDigits - 1);

      const wage = getRandomInt(minVal, maxVal);
      const hours = getRandomInt(2, 10);
      const days = getRandomInt(15, 30);

      const step1Ans = hours * wage;
      const step2Ans = step1Ans * days;

      const text = {
        ar: `يشتغل عامل في باخرة ${hours} ساعات في اليوم، وتؤدى له ${wage} درهما عن كل ساعة. إذا عمل ${days} يوما في الشهر، فما هي أجرته الشهرية؟`,
        fr: `Un ouvrier travaille sur un bateau ${hours} heures par jour, payé ${wage} dirhams l'heure. S'il travaille ${days} jours, quel est son salaire mensuel ?`,
        en: `A worker works on a boat for ${hours} hours a day, paid ${wage} dirhams an hour. If he works ${days} days, what is his monthly wage?`,
      }[lang];

      return {
        id: `msp_worker_${Date.now()}_${Math.random()}`,
        text,
        steps: [
          { operation: "Multiplication" as Operation, operand1: hours, operand2: wage, correctAnswer: step1Ans },
          { operation: "Multiplication" as Operation, operand1: step1Ans, operand2: days, correctAnswer: step2Ans },
        ],
      };
    },
  },
  {
    id: "saad-savings",
    requiredOps: ["Addition"],
    generate: (maxDigits: number, lang: "ar" | "fr" | "en"): MultiStepQuestion => {
      const maxVal = Math.pow(10, maxDigits) - 1;
      const minVal = maxDigits === 1 ? 2 : Math.pow(10, maxDigits - 1);
      const cap = Math.floor(maxVal / 3);

      const w1 = getRandomInt(minVal, cap);
      const w2 = getRandomInt(1, cap);
      const w3 = getRandomInt(1, cap);

      const step1Ans = w1 + w2;
      const step2Ans = step1Ans + w3;

      const text = {
        ar: `وفّر سعد ${w1} درهماً في الأسبوع الأول، و${w2} درهماً في الأسبوع الثاني، و${w3} درهماً في الأسبوع الثالث. كم درهماً وفّر سعد في المجموع؟`,
        fr: `Saad a économisé ${w1} dirhams la première semaine, ${w2} dirhams la deuxième et ${w3} dirhams la troisième. Combien a-t-il économisé au total ?`,
        en: `Saad saved ${w1} dirhams the first week, ${w2} dirhams the second week, and ${w3} dirhams the third week. How much did Saad save in total?`,
      }[lang];

      return {
        id: `msp_savings_${Date.now()}_${Math.random()}`,
        text,
        steps: [
          { operation: "Addition" as Operation, operand1: w1, operand2: w2, correctAnswer: step1Ans },
          { operation: "Addition" as Operation, operand1: step1Ans, operand2: w3, correctAnswer: step2Ans },
        ],
      };
    },
  },
  {
    id: "field-harvest",
    requiredOps: ["Multiplication", "Division"],
    generate: (maxDigits: number, lang: "ar" | "fr" | "en"): MultiStepQuestion => {
      const rows = getRandomInt(2, 10);
      const cols = getRandomInt(2, 10);
      const boxes = getRandomInt(2, 5);
      const totalPlants = rows * cols;
      const plantsPerBox = Math.floor(totalPlants / boxes);

      const text = {
        ar: `في حقل ${rows} صفوف، كل صف يحتوي على ${cols} نبتة. إذا وُزّعت النباتات بالتساوي على ${boxes} صناديق، كم نبتة في كل صندوق؟`,
        fr: `Un champ a ${rows} rangées de ${cols} plants chacune. Les plants sont répartis également dans ${boxes} caisses. Combien de plants y a-t-il par caisse ?`,
        en: `A field has ${rows} rows with ${cols} plants each. The plants are divided equally into ${boxes} boxes. How many plants are in each box?`,
      }[lang];

      return {
        id: `msp_field_${Date.now()}_${Math.random()}`,
        text,
        steps: [
          { operation: "Multiplication" as Operation, operand1: rows, operand2: cols, correctAnswer: totalPlants },
          { operation: "Division" as Operation, operand1: totalPlants, operand2: boxes, correctAnswer: plantsPerBox },
        ],
      };
    },
  },
  {
    id: "juice-shop",
    requiredOps: ["Multiplication", "Addition"],
    generate: (maxDigits: number, lang: "ar" | "fr" | "en"): MultiStepQuestion => {
      const maxPrice = Math.max(5, Math.pow(10, Math.floor(maxDigits / 2) || 1));
      const price1 = getRandomInt(2, maxPrice);
      const price2 = getRandomInt(2, maxPrice);
      const count1 = getRandomInt(5, 20);
      const count2 = getRandomInt(5, 20);

      const step1Ans = count1 * price1;
      const step2Ans = count2 * price2;
      const finalAns = step1Ans + step2Ans;

      const text = {
        ar: `في محل نوعان من العصير: ${count1} علبة بسعر ${price1} درهم للواحدة، و ${count2} علب بسعر ${price2} دراهم للواحدة. كم تكلف جميع العلب؟`,
        fr: `Une boutique a 2 types de jus : ${count1} boîtes à ${price1} DH chacune, et ${count2} boîtes à ${price2} DH chacune. Combien coûtent toutes les boîtes ?`,
        en: `A shop has 2 types of juice: ${count1} boxes at ${price1} DH each, and ${count2} boxes at ${price2} DH each. How much do all the boxes cost?`,
      }[lang];

      return {
        id: `msp_juice_${Date.now()}_${Math.random()}`,
        text,
        steps: [
          { operation: "Multiplication" as Operation, operand1: count1, operand2: price1, correctAnswer: step1Ans },
          { operation: "Multiplication" as Operation, operand1: count2, operand2: price2, correctAnswer: step2Ans },
          { operation: "Addition" as Operation, operand1: step1Ans, operand2: step2Ans, correctAnswer: finalAns },
        ],
      };
    },
  },
  {
    id: "apple-orange-weight",
    requiredOps: ["Multiplication", "Addition"],
    generate: (maxDigits: number, lang: "ar" | "fr" | "en"): MultiStepQuestion => {
      const maxWeight = Math.max(5, Math.pow(10, Math.floor(maxDigits / 2) || 1));
      const weight1 = getRandomInt(2, maxWeight);
      const weight2 = getRandomInt(2, maxWeight);
      const count1 = getRandomInt(3, 15);
      const count2 = getRandomInt(3, 15);

      const step1Ans = count1 * weight1;
      const step2Ans = count2 * weight2;
      const finalAns = step1Ans + step2Ans;

      const text = {
        ar: `في متجر ${count1} أكياس من التفاح يزن كل كيس ${weight1} كيلوغرامات، و ${count2} أكياس من البرتقال يزن كل كيس ${weight2} كيلوغرامات. ما الوزن الكلي؟`,
        fr: `Un magasin a ${count1} sacs de pommes (${weight1} kg chacun) et ${count2} sacs d'oranges (${weight2} kg chacun). Quel est le poids total ?`,
        en: `A store has ${count1} bags of apples (${weight1} kg each) and ${count2} bags of oranges (${weight2} kg each). What is the total weight?`,
      }[lang];

      return {
        id: `msp_weight_${Date.now()}_${Math.random()}`,
        text,
        steps: [
          { operation: "Multiplication" as Operation, operand1: count1, operand2: weight1, correctAnswer: step1Ans },
          { operation: "Multiplication" as Operation, operand1: count2, operand2: weight2, correctAnswer: step2Ans },
          { operation: "Addition" as Operation, operand1: step1Ans, operand2: step2Ans, correctAnswer: finalAns },
        ],
      };
    },
  },
  {
    id: "amina-reading",
    requiredOps: ["Subtraction"],
    generate: (maxDigits: number, lang: "ar" | "fr" | "en"): MultiStepQuestion => {
      const maxVal = Math.pow(10, maxDigits) - 1;
      const minVal = maxDigits === 1 ? 5 : Math.pow(10, maxDigits - 1);

      const totalPages = getRandomInt(minVal, maxVal);
      const day1 = getRandomInt(1, Math.floor(totalPages / 3));
      const day2 = getRandomInt(1, Math.floor(totalPages / 3));

      const step1Ans = totalPages - day1;
      const finalAns = step1Ans - day2;

      const text = {
        ar: `كتاب يتكون من ${totalPages} صفحة. قرأت أمينة ${day1} صفحة في اليوم الأول، و ${day2} صفحة في اليوم الثاني. كم صفحة بقيت لها لتنهي الكتاب؟`,
        fr: `Un livre contient ${totalPages} pages. Amina a lu ${day1} pages le premier jour et ${day2} pages le deuxième jour. Combien de pages lui reste-t-il à lire ?`,
        en: `A book has ${totalPages} pages. Amina read ${day1} pages on the first day and ${day2} pages on the second day. How many pages does she have left to read?`,
      }[lang];

      return {
        id: `msp_reading_${Date.now()}_${Math.random()}`,
        text,
        steps: [
          { operation: "Subtraction" as Operation, operand1: totalPages, operand2: day1, correctAnswer: step1Ans },
          { operation: "Subtraction" as Operation, operand1: step1Ans, operand2: day2, correctAnswer: finalAns },
        ],
      };
    },
  },
  {
    id: "school-distribution",
    requiredOps: ["Division"],
    generate: (maxDigits: number, lang: "ar" | "fr" | "en"): MultiStepQuestion => {
      const studentsPerGroup = getRandomInt(2, 5);
      const groupsPerClass = getRandomInt(2, 5);
      const classes = getRandomInt(2, 5);
      const multiplier = maxDigits === 1 ? 1 : Math.pow(10, maxDigits - 2);

      const totalStudents = studentsPerGroup * groupsPerClass * classes * multiplier;
      const finalClasses = classes * multiplier;

      const step1Ans = totalStudents / finalClasses;
      const finalAns = step1Ans / groupsPerClass;

      const text = {
        ar: `مدرسة بها ${totalStudents} تلميذاً، تم توزيعهم بالتساوي على ${finalClasses} أقسام. ثم تم تقسيم كل قسم إلى ${groupsPerClass} مجموعات. كم عدد التلاميذ في كل مجموعة؟`,
        fr: `Une école compte ${totalStudents} élèves, répartis également dans ${finalClasses} classes. Chaque classe est ensuite divisée en ${groupsPerClass} groupes. Combien y a-t-il d'élèves par groupe ?`,
        en: `A school has ${totalStudents} students, distributed equally into ${finalClasses} classes. Each class is then divided into ${groupsPerClass} groups. How many students are in each group?`,
      }[lang];

      return {
        id: `msp_school_${Date.now()}_${Math.random()}`,
        text,
        steps: [
          { operation: "Division" as Operation, operand1: totalStudents, operand2: finalClasses, correctAnswer: step1Ans },
          { operation: "Division" as Operation, operand1: step1Ans, operand2: groupsPerClass, correctAnswer: finalAns },
        ],
      };
    },
  },
];

export function generateMultiStepProblem(
  config: MultiStepProblemConfig,
  language: "ar" | "fr" | "en",
): { questions: MultiStepQuestion[] } {
  const { numQuestions, maxNumberRange, operationsAllowed } = config;

  let validTemplates = TEMPLATES.filter((tpl) =>
    tpl.requiredOps.every((op) => operationsAllowed.includes(op as Operation)),
  );

  if (validTemplates.length === 0) {
    validTemplates = TEMPLATES;
  }

  const questions: MultiStepQuestion[] = [];
  let attempts = 0;

  while (questions.length < numQuestions && attempts < 100) {
    attempts++;
    const tpl = validTemplates[getRandomInt(0, validTemplates.length - 1)];
    const question = tpl.generate(maxNumberRange, language);
    if (!questions.some((q) => q.text === question.text)) {
      questions.push(question);
    }
  }

  while (questions.length < numQuestions) {
    const tpl = validTemplates[getRandomInt(0, validTemplates.length - 1)];
    questions.push(tpl.generate(maxNumberRange, language));
  }

  return { questions };
}
