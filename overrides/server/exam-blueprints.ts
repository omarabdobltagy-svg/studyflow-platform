export type ExamComponent = {
  id: string;
  label: string;
  marks: number | null;
  questionCount?: number | null;
  assessmentShare: number | null;
  priorityNote: string;
};

export type SubjectExamBlueprint = {
  subjectKey: "arabic" | "english" | "history" | "programming_ai";
  label: string;
  grade: "second_secondary_baccalaureate";
  track: "engineering_and_computing";
  appliesTo: "annual_baccalaureate_exam" | "annual_baccalaureate_policy";
  status: "official_paper_spec" | "official_general_policy" | "partial_official_evidence";
  annualSubjectMarks: number;
  paperMarks: number | null;
  durationMinutes: number | null;
  mcqShare: number | null;
  essayShare: number | null;
  components: ExamComponent[];
  unverified: string[];
  sourceUrls: string[];
};

const arabicAnnualPolicy: SubjectExamBlueprint = {
  subjectKey: "arabic",
  label: "اللغة العربية",
  grade: "second_secondary_baccalaureate",
  track: "engineering_and_computing",
  appliesTo: "annual_baccalaureate_exam",
  status: "partial_official_evidence",
  annualSubjectMarks: 100,
  paperMarks: null,
  durationMinutes: null,
  mcqShare: 0.5,
  essayShare: 0.5,
  components: [],
  unverified: [
    "شكل ورقة امتحان نهاية السنة للصفين الثاني والثالث بكالوريا: 50% اختيار من متعدد و50% مقالي؛ هذا يصف شكل الورقة فقط ولا يحدد الوزن النسبي لكل وحدة أو فرع.",
    "المحاولة الأولى الإلزامية في مايو 2027، وتوجد فرصة ثانية اختيارية في يوليو 2027؛ لا تُعامل فرصة يوليو كترم أو امتحان فصلي.",

    "الدرجة السنوية للمادة في الصف الثاني 100 درجة، وهذه ليست درجة ورقة الامتحان وحدها.",
    "لا يوجد امتحان ترم أول في النظام المعتمد لهذا المخطط؛ الهدف هو الاستعداد لامتحان نهاية السنة.",
    "لم تتوفر في هذه النسخة مواصفة سنوية رسمية تفصيلية توزع درجات ورقة العربي على الفروع؛ لا تُستخدم أي أوزان منشورة لفترة أخرى في ترتيب النهائي.",
  ],
  sourceUrls: ["https://sis.gov.eg/ar/%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%B2-%D8%A7%D9%84%D8%A5%D8%B9%D9%84%D8%A7%D9%85%D9%8A/%D8%A7%D9%84%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1/%D8%A7%D9%84%D9%85%D8%AC%D9%84%D8%B3-%D8%A7%D9%84%D8%A3%D8%B9%D9%84%D9%89-%D9%84%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85-%D9%82%D8%A8%D9%84-%D8%A7%D9%84%D8%AC%D8%A7%D9%85%D8%B9%D9%8A-%D9%8A%D8%B3%D8%AA%D8%B9%D8%B1%D8%B6-%D8%A2%D9%84%D9%8A%D8%A7%D8%AA-%D8%AA%D8%B7%D8%A8%D9%8A%D9%82-%D9%86%D8%B8%D8%A7%D9%85-%D8%B4%D9%87%D8%A7%D8%AF%D8%A9-%D8%A7%D9%84%D8%A8%D9%83%D8%A7%D9%84%D9%88%D8%B1%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B5%D8%B1%D9%8A%D8%A9/"],
};

const englishAnnualPolicy: SubjectExamBlueprint = {
  subjectKey: "english",
  label: "اللغة الإنجليزية الأولى",
  grade: "second_secondary_baccalaureate",
  track: "engineering_and_computing",
  appliesTo: "annual_baccalaureate_exam",
  status: "partial_official_evidence",
  annualSubjectMarks: 100,
  paperMarks: null,
  durationMinutes: null,
  mcqShare: 0.5,
  essayShare: 0.5,
  components: [],
  unverified: [
    "شكل ورقة امتحان نهاية السنة للصفين الثاني والثالث بكالوريا: 50% اختيار من متعدد و50% مقالي؛ هذا يصف شكل الورقة فقط ولا يحدد الوزن النسبي لكل وحدة أو فرع.",
    "المحاولة الأولى الإلزامية في مايو 2027، وتوجد فرصة ثانية اختيارية في يوليو 2027؛ لا تُعامل فرصة يوليو كترم أو امتحان فصلي.",

    "الدرجة السنوية للمادة في الصف الثاني 100 درجة، وهذه ليست درجة ورقة الامتحان وحدها.",
    "لا يوجد امتحان ترم أول في النظام المعتمد لهذا المخطط؛ الهدف هو الاستعداد لامتحان نهاية السنة.",
    "لم تتوفر في هذه النسخة مواصفة سنوية رسمية تفصيلية توزع درجات ورقة الإنجليزي على الفروع؛ لا تُستخدم أي أوزان منشورة لفترة أخرى في ترتيب النهائي.",
  ],
  sourceUrls: ["https://sis.gov.eg/ar/%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%B2-%D8%A7%D9%84%D8%A5%D8%B9%D9%84%D8%A7%D9%85%D9%8A/%D8%A7%D9%84%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1/%D8%A7%D9%84%D9%85%D8%AC%D9%84%D8%B3-%D8%A7%D9%84%D8%A3%D8%B9%D9%84%D9%89-%D9%84%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85-%D9%82%D8%A8%D9%84-%D8%A7%D9%84%D8%AC%D8%A7%D9%85%D8%B9%D9%8A-%D9%8A%D8%B3%D8%AA%D8%B9%D8%B1%D8%B6-%D8%A2%D9%84%D9%8A%D8%A7%D8%AA-%D8%AA%D8%B7%D8%A8%D9%8A%D9%82-%D9%86%D8%B8%D8%A7%D9%85-%D8%B4%D9%87%D8%A7%D8%AF%D8%A9-%D8%A7%D9%84%D8%A8%D9%83%D8%A7%D9%84%D9%88%D8%B1%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B5%D8%B1%D9%8A%D8%A9/"],
};

const historyPolicy: SubjectExamBlueprint = {
  subjectKey: "history",
  label: "التاريخ المصري",
  grade: "second_secondary_baccalaureate",
  track: "engineering_and_computing",
  appliesTo: "annual_baccalaureate_policy",
  status: "partial_official_evidence",
  annualSubjectMarks: 100,
  paperMarks: null,
  durationMinutes: null,
  mcqShare: 0.5,
  essayShare: 0.5,
  components: [],
  unverified: [
    "شكل ورقة امتحان نهاية السنة للصفين الثاني والثالث بكالوريا: 50% اختيار من متعدد و50% مقالي؛ هذا يصف شكل الورقة فقط ولا يحدد الوزن النسبي لكل وحدة أو فرع.",
    "المحاولة الأولى الإلزامية في مايو 2027، وتوجد فرصة ثانية اختيارية في يوليو 2027؛ لا تُعامل فرصة يوليو كترم أو امتحان فصلي.",

    "درجة المادة في الصف الثاني 100 ضمن مواد هذا الصف.",
    "قالب امتحان البكالوريا العام يوازن بين الاختيار من متعدد والمقالي، لكن لم يثبت بعد توزيع درجات كل وحدة أو موضوع في التاريخ للامتحان السنوي.",
    "لا توجد في هذه النسخة مواصفة سنوية تفصيلية معتمدة لتوزيع درجات ورقة التاريخ على الوحدات.",
  ],
  sourceUrls: ["https://sis.gov.eg/ar/%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%B2-%D8%A7%D9%84%D8%A5%D8%B9%D9%84%D8%A7%D9%85%D9%8A/%D8%A7%D9%84%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1/%D8%A7%D9%84%D9%85%D8%AC%D9%84%D8%B3-%D8%A7%D9%84%D8%A3%D8%B9%D9%84%D9%89-%D9%84%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85-%D9%82%D8%A8%D9%84-%D8%A7%D9%84%D8%AC%D8%A7%D9%85%D8%B9%D9%8A-%D9%8A%D8%B3%D8%AA%D8%B9%D8%B1%D8%B6-%D8%A2%D9%84%D9%8A%D8%A7%D8%AA-%D8%AA%D8%B7%D8%A8%D9%8A%D9%82-%D9%86%D8%B8%D8%A7%D9%85-%D8%B4%D9%87%D8%A7%D8%AF%D8%A9-%D8%A7%D9%84%D8%A8%D9%83%D8%A7%D9%84%D9%88%D8%B1%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B5%D8%B1%D9%8A%D8%A9/"],
};

const programmingPolicy: SubjectExamBlueprint = {
  subjectKey: "programming_ai",
  label: "البرمجة والذكاء الاصطناعي",
  grade: "second_secondary_baccalaureate",
  track: "engineering_and_computing",
  appliesTo: "annual_baccalaureate_policy",
  status: "partial_official_evidence",
  annualSubjectMarks: 100,
  paperMarks: null,
  durationMinutes: null,
  mcqShare: 0.5,
  essayShare: 0.5,
  components: [],
  unverified: [
    "شكل ورقة امتحان نهاية السنة للصفين الثاني والثالث بكالوريا: 50% اختيار من متعدد و50% مقالي؛ هذا يصف شكل الورقة فقط ولا يحدد الوزن النسبي لكل وحدة أو فرع.",
    "المحاولة الأولى الإلزامية في مايو 2027، وتوجد فرصة ثانية اختيارية في يوليو 2027؛ لا تُعامل فرصة يوليو كترم أو امتحان فصلي.",

    "درجة مادة التخصص في الصف الثاني 100.",
    "لم يتم التحقق من جدول رسمي يوزع درجات امتحان البرمجة والذكاء الاصطناعي على وحدات الكتاب؛ لا تُنشأ أوزان موضوعية متخيلة.",
    "إلى حين توفر مواصفة رسمية للامتحان السنوي، تُبنى أولوية الوحدة من موضع الطالب، والمتطلبات السابقة، والاختبارات التشخيصية، وحجم المحتوى، لا من ادعاء عدد أسئلة غير موثق.",
  ],
  sourceUrls: ["https://sis.gov.eg/ar/%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%B2-%D8%A7%D9%84%D8%A5%D8%B9%D9%84%D8%A7%D9%85%D9%8A/%D8%A7%D9%84%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1/%D8%A7%D9%84%D9%85%D8%AC%D9%84%D8%B3-%D8%A7%D9%84%D8%A3%D8%B9%D9%84%D9%89-%D9%84%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85-%D9%82%D8%A8%D9%84-%D8%A7%D9%84%D8%AC%D8%A7%D9%85%D8%B9%D9%8A-%D9%8A%D8%B3%D8%AA%D8%B9%D8%B1%D8%B6-%D8%A2%D9%84%D9%8A%D8%A7%D8%AA-%D8%AA%D8%B7%D8%A8%D9%8A%D9%82-%D9%86%D8%B8%D8%A7%D9%85-%D8%B4%D9%87%D8%A7%D8%AF%D8%A9-%D8%A7%D9%84%D8%A8%D9%83%D8%A7%D9%84%D9%88%D8%B1%D9%8A%D8%A7-%D8%A7%D9%84%D9%85%D8%B5%D8%B1%D9%8A%D8%A9/"],
};

const subjectMatchers: Array<{ key: SubjectExamBlueprint["subjectKey"]; test: RegExp }> = [
  { key: "arabic", test: /ARB|عرب|اللغة\s*العربية/iu },
  { key: "english", test: /ENG|ENGLISH|انجليز|إنجليز/iu },
  { key: "history", test: /HIS|تاريخ/iu },
  { key: "programming_ai", test: /PROG|PROGRAM|برمج|ذكاء\s*اصطناعي/iu },
];

const blueprints: Record<SubjectExamBlueprint["subjectKey"], SubjectExamBlueprint> = {
  arabic: arabicAnnualPolicy,
  english: englishAnnualPolicy,
  history: historyPolicy,
  programming_ai: programmingPolicy,
};

export function getSubjectExamBlueprint(subjectId: string, subjectName = ""): SubjectExamBlueprint | null {
  const source = subjectId + " " + subjectName;
  const match = subjectMatchers.find(item => item.test.test(source));
  return match ? blueprints[match.key] : null;
}

export function getExamComponentForText(subjectId: string, subjectName: string, text: string): ExamComponent | null {
  const blueprint = getSubjectExamBlueprint(subjectId, subjectName);
  if (!blueprint) return null;
  const normalized = text.normalize("NFKC").toLocaleLowerCase("ar")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي");

  if (blueprint.subjectKey === "arabic") {
    const componentId =
      /النص المعلوماتي|القراءة|قراءة/u.test(normalized) ? "reading"
        : /وا اسلاماه|القصة|النص الادبي/u.test(normalized) ? "story_literary"
          : /النصوص الشعريه|النصوص النثريه|الشعر|النثر/u.test(normalized) ? "poetry_prose"
            : /الادب|البلاغه/u.test(normalized) ? "literature_rhetoric"
              : /النحو|قواعد/u.test(normalized) ? "grammar"
                : /التعبير الوظيفي|دعوه|اعلان|تعليق/u.test(normalized) ? "functional_writing"
                  : /التعبير الابداعي|موضوع تعبيري/u.test(normalized) ? "creative_writing"
                    : null;
    return componentId ? blueprint.components.find(component => component.id === componentId) ?? null : null;
  }

  if (blueprint.subjectKey !== "english") return null;
  const componentId =
    /قصة|story|novel|رواية/u.test(normalized) ? "story"
      : /ترجم|translation/u.test(normalized) ? "translation"
        : /قراءة|فهم|reading|passage/u.test(normalized) ? "reading"
          : /تعبير|كتابة|writing|rewrite|اعادة صياغة/u.test(normalized) ? "writing"
            : /قواعد|نحو|مفردات|تراكيب|grammar|vocabulary/u.test(normalized) ? "vocabulary_grammar"
              : null;
  return componentId ? blueprint.components.find(component => component.id === componentId) ?? null : null;
}

export function buildExamBlueprintContext(subjects: Array<{ id: string; name: string }>): string {
  const subjectLines = subjects.map(subject => {
    const blueprint = getSubjectExamBlueprint(subject.id, subject.name);
    if (!blueprint) return subject.name + ": لا توجد مواصفة ورقة امتحانية موثقة في ملف المحرك حتى الآن؛ لا تخترع توزيع درجات.";
    const components = blueprint.components.length
      ? blueprint.components.map(item =>
          item.label + ": " + (item.marks === null ? "الدرجة الفرعية غير مثبتة" : item.marks + " من " + blueprint.paperMarks)
          + (item.questionCount === undefined ? "" : "؛ عدد البنود/الأسئلة الموصوفة " + item.questionCount)
          + (item.priorityNote ? "؛ " + item.priorityNote : "")
        ).join(" | ")
      : "لا توجد أوزان فرعية موثقة قابلة للاستخدام بعد.";
    return [
      "المادة: " + blueprint.label,
      "نطاق المواصفة: " + (blueprint.appliesTo === "annual_baccalaureate_exam" ? "الامتحان السنوي لنهاية الصف الثاني" : "سياسة سنوية عامة/دليل جزئي، وليست توزيعًا تفصيليًا للوحدات"),
      "حالة الدليل: " + blueprint.status,
      "الدرجة السنوية للمادة في الصف الثاني: " + blueprint.annualSubjectMarks + " من 100",
      "درجة ورقة الامتحان: " + (blueprint.paperMarks === null ? "غير مثبتة في هذا الدليل" : blueprint.paperMarks + " درجة") + "؛ لا تخلط بين درجة الورقة والدرجة السنوية للمادة",
      "زمن الورقة بالدقائق: " + (blueprint.durationMinutes ?? "غير مثبت"),
      "اختيار من متعدد: " + (blueprint.mcqShare === null ? "غير مثبت" : Math.round(blueprint.mcqShare * 100) + "%")
        + "؛ مقالي: " + (blueprint.essayShare === null ? "غير مثبت" : Math.round(blueprint.essayShare * 100) + "%"),
      "مكونات الورقة: " + components,
      "حدود الدليل: " + blueprint.unverified.join(" | "),
      "المراجع: " + blueprint.sourceUrls.join(" | "),
    ].join("\n");
  });
  return [
    "الهدف الأساسي للمخطط: الاستعداد للامتحان السنوي في نهاية الصف الثاني بكالوريا، وليس امتحان ترم أول. لا يوجد امتحان ترم أول ضمن هذا المسار.",
    "مراجع مواصفات الامتحان السنوي المتاحة لهذا الطالب:",
    "الهدف الزمني للمخطط: الجاهزية للمحاولة الأولى الإلزامية في مايو 2027. يوليو 2027 فرصة ثانية اختيارية في نفس العام الدراسي، وليست ترمًا أو امتحانًا فصليًا.",
    "شكل ورقة امتحان نهاية السنة للصفين الثاني والثالث بكالوريا في 2026/2027: 50% اختيار من متعدد و50% مقالي. هذه نسبة شكل الورقة، وليست توزيعًا لدرجات الوحدات أو الدروس.",
    "مواد الصف الثاني الأربع في مسار الهندسة وعلوم الحاسب متساوية في الدرجة السنوية: 100 لكل مادة (400 إجمالًا لهذا الصف). هذه الدرجة السنوية تشمل منظومة التقييم، ولا يجوز افتراض أنها درجة ورقة النهائي وحدها أو أن وحدات المادة متساوية الوزن.",
    ...subjectLines,
    "منظومة الأداءات والتقييمات منفصلة عن توزيع ورقة الامتحان: المشروع 15%، التقييم الأسبوعي 20%، الأداء المنزلي/الحصة 15%، السلوك والمواظبة 10%، التقييم الشهري الأول 20%، والثاني 20%. شرط دخول الفرصة الأولى 60% إنجاز من تلك المنظومة. لا تحسب هذه النسب ضمن درجات مكوّنات الورقة.",
    "لا تخترع توزيع درجات أو عدد أسئلة لأي مادة أو فترة لا تملك وثيقة رسمية مطابقة لها.",
    "استخدم النسب الرقمية فقط عندما تكون موثقة صراحة للامتحان السنوي لنهاية الصف الثاني. لا تستخدم مواصفات ترم أول أو فترة تقييم أخرى لتقدير أوزان النهائي. في المكوّنات التي لا تملك توزيعًا سنويًا رسميًا، اكتب أن الوزن غير مثبت، واستخدم اختبار الطالب التشخيصي ونتائجه والمتطلبات السابقة وحجم المنهج لتقدير الأولوية، مع وسم الثقة بأنها منخفضة/تقديرية.",
  ].join("\n");
}
