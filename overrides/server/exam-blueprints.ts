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
  appliesTo: "first_term_2026_2027" | "annual_baccalaureate_policy";
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

const englishFirstTerm: SubjectExamBlueprint = {
  subjectKey: "english",
  label: "اللغة الإنجليزية الأولى",
  grade: "second_secondary_baccalaureate",
  track: "engineering_and_computing",
  appliesTo: "first_term_2026_2027",
  status: "official_paper_spec",
  annualSubjectMarks: 100,
  paperMarks: 30,
  durationMinutes: 180,
  mcqShare: 8 / 30 + 7 / 30,
  essayShare: 4 / 30 + 3 / 30 + 8 / 30,
  components: [
    { id: "vocabulary_grammar", label: "المفردات والتراكيب والقواعد", marks: 8, questionCount: 14, assessmentShare: 8 / 30, priorityNote: "وزن مرتفع نسبيًا؛ لا تُهمَل القواعد والمفردات" },
    { id: "reading", label: "القراءة والفهم", marks: 7, questionCount: 7, assessmentShare: 7 / 30, priorityNote: "وزن مرتفع نسبيًا مع تدريب على قطعة غير مسبوقة" },
    { id: "translation", label: "الترجمة في الاتجاهين", marks: 4, questionCount: 4, assessmentShare: 4 / 30, priorityNote: "وزن متوسط؛ تتطلب ممارسة تحريرية قصيرة" },
    { id: "story", label: "القصة المقررة", marks: 3, questionCount: 3, assessmentShare: 3 / 30, priorityNote: "وزن أقل من القواعد والقراءة والكتابة؛ لا تجعلها الأولوية الأولى تلقائيًا" },
    { id: "writing", label: "إعادة الصياغة والتعبير", marks: 8, questionCount: 4, assessmentShare: 8 / 30, priorityNote: "وزن مرتفع نسبيًا؛ يشمل إعادة الصياغة وموضوعًا من 180 كلمة" },
  ],
  unverified: [
    "هذه مواصفة الفصل الدراسي الأول 2026/2027 وليست مواصفة نهائي آخر السنة.",
    "لا يجوز إسقاط هذا التوزيع على الفصل الثاني أو الامتحان السنوي ما لم تصدر مواصفة معتمدة لهما.",
  ],
  sourceUrls: [
    "https://shbabbek.com/show/288302",
    "https://www.masrawy.com/news/education-schooleducation/details/2026/11/11/3077187",
  ],
};

const arabicFirstTerm: SubjectExamBlueprint = {
  subjectKey: "arabic",
  label: "اللغة العربية",
  grade: "second_secondary_baccalaureate",
  track: "engineering_and_computing",
  appliesTo: "first_term_2026_2027",
  status: "partial_official_evidence",
  annualSubjectMarks: 100,
  paperMarks: 60,
  durationMinutes: 180,
  mcqShare: 0.5,
  essayShare: 0.5,
  components: [
    { id: "reading", label: "القراءة والنصوص المعلوماتية والأدبية", marks: null, assessmentShare: null, priorityNote: "مكوّن رسمي في الورقة؛ الوزن التفصيلي غير مثبت هنا" },
    { id: "literature", label: "الأدب والنصوص الشعرية والنثرية", marks: null, assessmentShare: null, priorityNote: "مكوّن رسمي في الورقة؛ الوزن التفصيلي غير مثبت هنا" },
    { id: "rhetoric", label: "البلاغة", marks: null, assessmentShare: null, priorityNote: "مكوّن رسمي في الورقة؛ الوزن التفصيلي غير مثبت هنا" },
    { id: "grammar", label: "النحو", marks: null, assessmentShare: null, priorityNote: "مكوّن رسمي في الورقة؛ الوزن التفصيلي غير مثبت هنا" },
    { id: "expression", label: "التعبير الوظيفي والإبداعي", marks: null, assessmentShare: null, priorityNote: "مكوّن رسمي في الورقة؛ الوزن التفصيلي غير مثبت هنا" },
  ],
  unverified: [
    "المتاح حاليًا يثبت أن الورقة من 60 درجة و40 سؤالًا وزمنها 3 ساعات مع توازن 50% اختيار من متعدد و50% مقالي.",
    "لا نعتمد توزيعًا رقميًا فرعيًا على المكوّنات لأن النسخة التفصيلية المتداولة تجمع إلى 59 لا 60؛ يلزم استخراج جدول PDF الأصلي قبل استخدام أرقام فرعية.",
    "هذه مواصفة الفصل الدراسي الأول 2026/2027 وليست مواصفة نهائي آخر السنة.",
  ],
  sourceUrls: [
    "https://shbabbek.com/show/287545",
    "https://aloostaz.com/eg/manahej/thanawi/saf-2/term-1/",
  ],
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
  mcqShare: null,
  essayShare: null,
  components: [],
  unverified: [
    "درجة المادة في الصف الثاني 100 ضمن مواد هذا الصف.",
    "قالب امتحان البكالوريا العام يوازن بين الاختيار من متعدد والمقالي، لكن لم يثبت بعد توزيع درجات كل وحدة أو موضوع في التاريخ للامتحان السنوي.",
    "توجد مواصفة ورقة امتحانية للفصل الأول 2026/2027 منشورة بتاريخ 21 نوفمبر 2026؛ لم يُعتمد منها توزيع رقمي تفصيلي في هذه النسخة.",
  ],
  sourceUrls: [
    "https://aloostaz.com/eg/manahej/thanawi/saf-2/term-1/",
    "https://nceee.edu.eg/puplic/images/nceee/pdf/MOASFAT2023/T-3-C.pdf",
  ],
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
  mcqShare: null,
  essayShare: null,
  components: [],
  unverified: [
    "درجة مادة التخصص في الصف الثاني 100.",
    "لم يتم التحقق من جدول رسمي يوزع درجات امتحان البرمجة والذكاء الاصطناعي على وحدات الكتاب؛ لا تُنشأ أوزان موضوعية متخيلة.",
    "إلى حين توفر مواصفة رسمية للامتحان السنوي، تُبنى أولوية الوحدة من موضع الطالب، والمتطلبات السابقة، والاختبارات التشخيصية، وحجم المحتوى، لا من ادعاء عدد أسئلة غير موثق.",
  ],
  sourceUrls: [],
};

const subjectMatchers: Array<{ key: SubjectExamBlueprint["subjectKey"]; test: RegExp }> = [
  { key: "arabic", test: /ARB|عرب|اللغة\s*العربية/iu },
  { key: "english", test: /ENG|ENGLISH|انجليز|إنجليز/iu },
  { key: "history", test: /HIS|تاريخ/iu },
  { key: "programming_ai", test: /PROG|PROGRAM|برمج|ذكاء\s*اصطناعي/iu },
];

const blueprints: Record<SubjectExamBlueprint["subjectKey"], SubjectExamBlueprint> = {
  arabic: arabicFirstTerm,
  english: englishFirstTerm,
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
  if (!blueprint || blueprint.subjectKey !== "english" || blueprint.appliesTo !== "first_term_2026_2027") return null;
  const normalized = text.normalize("NFKC").toLocaleLowerCase("ar")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي");
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
      "نطاق المواصفة: " + (blueprint.appliesTo === "first_term_2026_2027" ? "الفصل الأول 2026/2027 فقط" : "سياسة عامة/دليل جزئي، وليست توزيع وحدات للنهائي"),
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
    "مراجع مواصفات الامتحان المتاحة لهذا الطالب:",
    "مواد الصف الثاني الأربع في مسار الهندسة وعلوم الحاسب متساوية في الدرجة السنوية: 100 لكل مادة (400 إجمالًا لهذا الصف). هذا لا يعني تساوي كل درس داخل المادة.",
    ...subjectLines,
    "منظومة الأداءات والتقييمات منفصلة عن توزيع ورقة الامتحان: المشروع 15%، التقييم الأسبوعي 20%، الأداء المنزلي/الحصة 15%، السلوك والمواظبة 10%، التقييم الشهري الأول 20%، والثاني 20%. شرط دخول الفرصة الأولى 60% إنجاز من تلك المنظومة. لا تحسب هذه النسب ضمن درجات مكوّنات الورقة.",
    "لا تخترع توزيع درجات أو عدد أسئلة لأي مادة أو فترة لا تملك وثيقة رسمية مطابقة لها.",
    "استخدم النسب الرقمية فقط عندما تكون مطابقة لنطاق المواصفة. إذا كانت المواصفة للفصل الأول فلا تنقلها إلى النهائي السنوي أو الفصل الثاني. في المكوّنات التي لا تملك توزيعًا رسميًا، اكتب أن الوزن غير مثبت، واستخدم اختبار الطالب التشخيصي ونتائجه والمتطلبات السابقة وحجم المنهج لتقدير الأولوية، مع وسم الثقة بأنها منخفضة/تقديرية.",
  ].join("\n");
}
