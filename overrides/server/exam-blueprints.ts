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


export const SECOND_YEAR_BAC_EXAM_WINDOW_2026_2027 = {
  academicYear: "2026/2027",
  start: "2027-06-12",
  end: "2027-06-22",
  planningReadyBy: "2027-06-11",
  precision: "approximate_user_confirmed",
  source: "user_confirmed",
} as const;

const noDetailedBlueprint = [
  "لم تصدر النماذج الاسترشادية أو المواصفة التفصيلية المعتمدة لامتحان الصف الثاني بكالوريا في نطاق العمل الحالي.",
  "لا توجد بيانات معتمدة عن عدد الأسئلة أو توزيع الاختياري والمقالي أو درجات الفروع والوحدات؛ تظل هذه الحقول غير مثبتة ولا تدخل في حساب الأولوية.",
  "يمكن الاستفادة من أنماط المهارات العامة في نماذج الصف الثالث الثانوي كاستلهام نوعي فقط، وليس كنموذج امتحاني للصف الثاني بكالوريا.",
  "لا ينشئ StudyFlow اختبارات أو أسئلة للطالب، ولا يقيّمه في مهارات المنهج.",
];

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
  mcqShare: null,
  essayShare: null,
  components: [],
  unverified: [
    ...noDetailedBlueprint,
    "يظل فرع النحو ذا أولوية تأسيسية وفق قاعدة المنتج؛ لا يعني ذلك نسبة درجات أو إسقاط بقية الفروع.",
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
  mcqShare: null,
  essayShare: null,
  components: [],
  unverified: [
    ...noDetailedBlueprint,
    "Grammar وVocabulary أولوية متابعة أساسية وفق قاعدة المنتج واستلهام نوعي من مهارات نماذج الثانوية العامة، من دون وزن رقمي.",
    "لا يوجد وزن موثق للقصة أو الفقرة أو أي فرع آخر؛ لا تُسقط أي فرع من الكتالوج بناءً على تخمين.",
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
  mcqShare: null,
  essayShare: null,
  components: [],
  unverified: [
    ...noDetailedBlueprint,
    "جميع دروس التاريخ غير المكتملة تظل ضمن التغطية السنوية؛ ترتيب الأولوية لا يسمح بحذفها.",
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
  mcqShare: null,
  essayShare: null,
  components: [],
  unverified: [
    ...noDetailedBlueprint,
    "جميع دروس البرمجة والذكاء الاصطناعي غير المكتملة تظل ضمن التغطية السنوية؛ ترتيب الأولوية لا يسمح بحذفها.",
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
    if (!blueprint) return subject.name + ": لا توجد بيانات امتحانية موثقة؛ لا تخترع مواصفة.";
    return [
      "المادة: " + blueprint.label,
      "حالة المواصفة: لا توجد حتى الآن نماذج استرشادية أو مواصفة تفصيلية معتمدة لامتحان الصف الثاني بكالوريا.",
      "عدد الأسئلة: غير معروف وغير مسموح بتخمينه.",
      "توزيع الاختياري والمقالي: غير معروف وغير مسموح بنقله من الصف الثالث.",
      "درجات الفروع والوحدات: غير متاحة؛ لا توجد أوزان رقمية تدخل في حساب الأولوية.",
      "توجيه المتابعة: " + blueprint.unverified.filter(line => !noDetailedBlueprint.includes(line)).join(" | "),
    ].join("\\n");
  });

  return [
    "نطاق الامتحان: الصف الثاني بكالوريا المصرية، مسار الهندسة وعلوم الحاسب.",
    "لا توجد في هذا المحرك حاليًا نماذج استرشادية أو مواصفة تفصيلية منشورة للامتحان؛ لا تخترع عددًا للأسئلة أو شكل السؤال أو درجات أو أوزان فروع.",
    "يُسمح بالاستلهام النوعي فقط من مهارات نماذج الصف الثالث الثانوي، لا من أعداد الأسئلة أو شكل الورقة أو توزيع الدرجات أو نسب الاختياري والمقالي.",
    "الاستلهام النوعي المسموح: الإنجليزي Grammar وVocabulary، وفهم المقروء والاستدلال وتنظيم الفقرة؛ التاريخ تفسير الأدلة والوثائق والأسباب والنتائج؛ العربي الالتزام بأهداف الكتاب وفروعه الحالية؛ البرمجة فهم السياق التقني والمفاهيم وتسلسلها.",
    "لا يحوّل هذا الاستلهام إلى اختبارات أو أسئلة يجيب عنها الطالب. المدرس هو المسؤول عن التدريب والتقييم.",
    "نافذة الامتحانات التي أكدها المستخدم تقريبًا: من 12 يونيو 2027 إلى 22 يونيو 2027. يستخدمها المخطط كنافذة تخطيطية غير نهائية، ويستهدف إتمام المحتوى الأساسي قبل 11 يونيو 2027 لترك هامش داخل النافذة.",
    ...subjectLines,
  ].join("\\n");
}
