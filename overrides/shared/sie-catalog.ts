export type SIESystemId = "EG_BACCALAUREATE" | "EG_GENERAL_SECONDARY";
export type SIEEducationSystem = "baccalaureate" | "general_secondary";

export type SIESubject = {
  subjectId: string;
  nameAr: string;
  curriculumAvailable: boolean;
  note?: string;
  core?: boolean;
};

export type SIETrack = {
  trackId: string;
  systemId: SIESystemId;
  nameAr: string;
  gradeYear: string;
  requiredSubjectIds: string[];
  electiveOptions: SIESubject[][];
  fixedSubjectIds?: string[];
  note?: string;
};

export type SIETeacher = {
  teacherId: string;
  nameAr: string;
  brandName: string;
  subjectIds: string[];
  profileUrl: string;
  lastChecked: string;
  coursePresence: string;
  publicAudienceMetric?: number;
  publicAudienceMetricDate?: string;
  popularitySignal?: string;
  latestPublicCheckpoint?: string;
  teachingAdvice?: string;
  teachingAdviceEvidence?: string;
  evidenceLabel: string;
  confidenceLabel: string;
  evidenceNote: string;
  systemCourseVerification: Record<string, string>;
  sourceId: string;
  shortlistPosition: number;
  courseVerifiedFor: string;
  courseProgressEvidence: string;
  latestCheckpointDate: string;
  scheduleEvidence: string;
  scheduleEntries: Array<{ date?: string; time?: string; event?: string }>;
  progressConfidence: string;
  selectionLabel: string;
  teacherNotes: string;
  paidCoursePositionStatus: string;
  studentInputRequired: boolean;
  adminFollowup: string;
  studentAttendedFrontierStatus: string;
  mappedCurriculumNodeIds: string[];
  publicSegments?: Array<{ title: string; timestamp?: string; curriculumNodeIds: string[]; mappingStatus: string; note?: string }>;
  paidCourseCatalogFrontier?: { courseTitle: string; courseUrl: string; checkedAt: string; lessonCount?: number; sequenceVisible: boolean; note: string };
  conflictOptions?: Array<{ label: string; sourceDate: string; sourceLabel: string; confidence: string }>;
};

const BAC_SYSTEM: SIESystemId = "EG_BACCALAUREATE";
const GENERAL_SYSTEM: SIESystemId = "EG_GENERAL_SECONDARY";
const GRADE_YEAR = "الصف الثاني الثانوي – دفعة 2027";
const ACADEMIC_YEAR = "2026/2027";

export const SIE_CATALOG_META = {
  packageVersion: "2026-11-21-no-design",
  academicYear: ACADEMIC_YEAR,
  gradeYear: GRADE_YEAR,
  gradeId: "G11_EQ_G2",
  teacherRecommendationLimit: 5,
  teacherPolicy:
    "ترشيحات أولية مبنية على وجود أدلة للمادة والصف والسنة، وليست ترتيبًا لأفضل أو أشهر المدرسين على مستوى مصر.",
} as const;

export const SIE_SYSTEMS: Array<{
  systemId: SIESystemId;
  nameAr: string;
  description: string;
  verificationNote: string;
}> = [
  {
    systemId: BAC_SYSTEM,
    nameAr: "البكالوريا المصرية",
    description: "الصف الثاني الثانوي – دفعة 2027",
    verificationNote: "المواد الأساسية وفهارس الكتب المرفوعة متاحة وفق نسخة الحزمة.",
  },
  {
    systemId: GENERAL_SYSTEM,
    nameAr: "الثانوية العامة",
    description: "الصف الثاني الثانوي – دفعة 2027",
    verificationNote:
      "قوائم الشعب مستندة إلى إعادة نشر القرار 234 لسنة 2025؛ تأكيد دليل الوزارة التنفيذي لعام 2026/2027 ما زال مطلوبًا.",
  },
];

export const SIE_SUBJECTS: SIESubject[] = [
  { subjectId: "ARB_G2_BAC", nameAr: "اللغة العربية", curriculumAvailable: true, core: true, note: "فهرس الجزء الأول موثق: 3 وحدات و9 دروس." },
  { subjectId: "ENG1_G2_BAC", nameAr: "اللغة الإنجليزية الأولى", curriculumAvailable: true, core: true, note: "فهرس الجزء الأول موثق: 5 وحدات و20 موضوعًا." },
  { subjectId: "HIS_G2_BAC", nameAr: "التاريخ", curriculumAvailable: true, core: true, note: "فهرس الجزء الأول موثق: 3 وحدات و12 درسًا." },
  { subjectId: "PROG_AI_G2_BAC", nameAr: "البرمجة والذكاء الاصطناعي", curriculumAvailable: true, note: "فهرسا الجزأين موثقان: 7 فصول و23 درسًا." },
  { subjectId: "PHY_G2_BAC_PENDING", nameAr: "الفيزياء", curriculumAvailable: false, note: "المادة ضمن اختيار المسار، لكن فهرسها غير محمّل في الحزمة." },
  { subjectId: "MATH_G2_BAC_PENDING", nameAr: "الرياضيات", curriculumAvailable: false, note: "المادة ضمن اختيار المسار، لكن فهرسها غير محمّل في الحزمة." },
  { subjectId: "CHEM_G2_BAC_PENDING", nameAr: "الكيمياء", curriculumAvailable: false, note: "المادة ضمن اختيار المسار، لكن فهرسها غير محمّل في الحزمة." },
  { subjectId: "ACCOUNTING_G2_BAC_PENDING", nameAr: "المحاسبة", curriculumAvailable: false, note: "المادة ضمن اختيار المسار، لكن فهرسها غير محمّل في الحزمة." },
  { subjectId: "BUSINESS_G2_BAC_PENDING", nameAr: "إدارة الأعمال", curriculumAvailable: false, note: "المادة ضمن اختيار المسار، لكن فهرسها غير محمّل في الحزمة." },
  { subjectId: "PSYCHOLOGY_G2_BAC_PENDING", nameAr: "علم النفس", curriculumAvailable: false, note: "المادة ضمن اختيار المسار، لكن فهرسها غير محمّل في الحزمة." },
  { subjectId: "ARB_G2_GENERAL", nameAr: "اللغة العربية", curriculumAvailable: false, note: "يلزم تحميل فهرس الثانوية العامة المنفصل." },
  { subjectId: "ENG1_G2_GENERAL", nameAr: "اللغة الأجنبية الأولى", curriculumAvailable: false, note: "يلزم تحميل فهرس الثانوية العامة المنفصل." },
  { subjectId: "HIS_G2_GENERAL", nameAr: "التاريخ", curriculumAvailable: false, note: "يلزم تحميل فهرس الثانوية العامة المنفصل." },
  { subjectId: "MATH_G2_GENERAL", nameAr: "الرياضيات", curriculumAvailable: false, note: "يلزم تحميل فهرس الثانوية العامة المنفصل." },
  { subjectId: "CHEM_G2_GENERAL", nameAr: "الكيمياء", curriculumAvailable: false, note: "يلزم تحميل فهرس الثانوية العامة المنفصل." },
  { subjectId: "PHY_G2_GENERAL", nameAr: "الفيزياء", curriculumAvailable: false, note: "يلزم تحميل فهرس الثانوية العامة المنفصل." },
  { subjectId: "GEO_G2_GENERAL", nameAr: "الجغرافيا", curriculumAvailable: false, note: "يلزم تحميل فهرس الثانوية العامة المنفصل." },
  { subjectId: "PSYCHOLOGY_G2_GENERAL", nameAr: "علم النفس", curriculumAvailable: false, note: "يلزم تحميل فهرس الثانوية العامة المنفصل." },
];

const bacCore = ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC"];
export const SIE_TRACKS: SIETrack[] = [
  {
    trackId: "BAC_MED_LIFE", systemId: BAC_SYSTEM, nameAr: "الطب وعلوم الحياة",
    gradeYear: GRADE_YEAR, requiredSubjectIds: bacCore,
    electiveOptions: [[
      SIE_SUBJECTS.find(s => s.subjectId === "PHY_G2_BAC_PENDING")!,
      SIE_SUBJECTS.find(s => s.subjectId === "MATH_G2_BAC_PENDING")!,
    ]],
    note: "اختر مادة واحدة من الفيزياء أو الرياضيات.",
  },
  {
    trackId: "BAC_ENG_CS", systemId: BAC_SYSTEM, nameAr: "الهندسة وعلوم الحاسب",
    gradeYear: GRADE_YEAR, requiredSubjectIds: bacCore,
    electiveOptions: [[
      SIE_SUBJECTS.find(s => s.subjectId === "CHEM_G2_BAC_PENDING")!,
      SIE_SUBJECTS.find(s => s.subjectId === "PROG_AI_G2_BAC")!,
    ]],
    note: "اختر مادة واحدة من الكيمياء أو البرمجة والذكاء الاصطناعي.",
  },
  {
    trackId: "BAC_BUSINESS", systemId: BAC_SYSTEM, nameAr: "الأعمال",
    gradeYear: GRADE_YEAR, requiredSubjectIds: bacCore,
    electiveOptions: [[
      SIE_SUBJECTS.find(s => s.subjectId === "ACCOUNTING_G2_BAC_PENDING")!,
      SIE_SUBJECTS.find(s => s.subjectId === "BUSINESS_G2_BAC_PENDING")!,
    ]],
    note: "اختر مادة واحدة من المحاسبة أو إدارة الأعمال.",
  },
  {
    trackId: "BAC_ARTS_HUM", systemId: BAC_SYSTEM, nameAr: "الآداب والفنون",
    gradeYear: GRADE_YEAR, requiredSubjectIds: [...bacCore, "PSYCHOLOGY_G2_BAC_PENDING"],
    electiveOptions: [],
    note: "علم النفس هو المادة التخصصية المعتمدة في مسار الآداب والفنون.",
  },
  {
    trackId: "GENERAL_SCIENCE", systemId: GENERAL_SYSTEM, nameAr: "الشعبة العلمية",
    gradeYear: GRADE_YEAR, requiredSubjectIds: [], electiveOptions: [],
    fixedSubjectIds: ["ARB_G2_GENERAL", "ENG1_G2_GENERAL", "MATH_G2_GENERAL", "HIS_G2_GENERAL", "CHEM_G2_GENERAL", "PHY_G2_GENERAL"],
    note: "قائمة مواد وفق إعادة نشر القرار 234 لسنة 2025؛ تأكيد العام الدراسي الحالي مطلوب.",
  },
  {
    trackId: "GENERAL_LITERARY", systemId: GENERAL_SYSTEM, nameAr: "الشعبة الأدبية",
    gradeYear: GRADE_YEAR, requiredSubjectIds: [], electiveOptions: [],
    fixedSubjectIds: ["ARB_G2_GENERAL", "ENG1_G2_GENERAL", "HIS_G2_GENERAL", "GEO_G2_GENERAL", "PSYCHOLOGY_G2_GENERAL", "MATH_G2_GENERAL"],
    note: "قائمة مواد وفق إعادة نشر القرار 234 لسنة 2025؛ تأكيد العام الدراسي الحالي مطلوب.",
  },
];

export const SIE_TEACHERS: SIETeacher[] = [
  {
    teacherId: "T_AR_MOHAMED_SALAH", nameAr: "محمد صلاح", brandName: "بسطتهالك",
    subjectIds: ["ARB_G2_BAC"], profileUrl: "https://bassthalk.com/userprofile/",
    lastChecked: "2026-10-13",
    publicAudienceMetric: 6020000,
    publicAudienceMetricDate: "2024-06-29",
    popularitySignal: "قناة واسعة الوصول؛ لقطة تاريخية تقارب 6.02M مشترك في 2024",
    latestPublicCheckpoint: "مراجعة شهر أكتوبر المنشورة 13 أكتوبر: الأسماء الخمسة؛ حكايات الغريب؛ العلم بين القانون والضمير؛ الخلق جوهر الفضيلة؛ الفقرة الحجاجية ونقد المقال.",
    teachingAdvice: "لا تساوِ بين مشاهدة المحاضرة وبين تعلّم الدرس؛ اختبر الفهم بالسؤال والتطبيق، واستخدم أخطاء الواجب والامتحان لتحديد ما يحتاج تصحيحًا.",
    teachingAdviceEvidence: "ملخص وصف فيديو منشور 29 أكتوبر 2026؛ ليس تفريغًا حرفيًا.",
    shortlistPosition: 1,
    coursePresence: "verified_on_platform",
    courseVerifiedFor: "2 Bac 2027 Arabic",
    courseProgressEvidence: "منصة بسطتهالك أظهرت باقة الشهر الثاني للصف الثاني بكالوريا بتاريخ 3 أكتوبر 2026؛ اللقطة لا تعرض رقم محاضرة أو المحتوى الداخلي.",
    latestCheckpointDate: "2026-10-13",
    scheduleEvidence: "لا يوجد موعد حالي دقيق موثوق في اللقطة الحالية.",
    scheduleEntries: [],
    progressConfidence: "medium_public_checkpoint",
    selectionLabel: "ترشيح واسع الانتشار",
    teacherNotes: "المراجعة تثبت موضوعات عامة فقط؛ لا تثبت موضع الكورس المدفوع ولا أن الطالب شاهدها.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: true,
    adminFollowup: "المراجعة تثبت موضوعات عامة فقط؛ لا تثبت موضع الكورس المدفوع ولا أن الطالب شاهدها. عند تعذر التحقق، استخدم مسار تحديد الموضع داخل المنصة ولا توقف الخطة.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: ["ARB_U1_L1","ARB_U1_L2"],
    publicSegments: [{"title":"النحو - الأسماء الخمسة","timestamp":"00:03:50","curriculumNodeIds":[],"mappingStatus":"skill_only_not_a_separate_toc_node"},{"title":"القصة - حكايات الغريب","timestamp":"01:16:28","curriculumNodeIds":["STORY_W01"],"mappingStatus":"provisional_companion_mapping","note":"مورد أدبي مرافق؛ ارتباطه الرسمي بالصف غير محسوم."},{"title":"العلم بين القانون والضمير","timestamp":"02:14:45","curriculumNodeIds":["ARB_U1_L1"],"mappingStatus":"title_match"},{"title":"الخلق جوهر الفضيلة","timestamp":"02:47:53","curriculumNodeIds":["ARB_U1_L2"],"mappingStatus":"title_match"},{"title":"الفقرة الحجاجية ونقد المقال","timestamp":"03:35:36","curriculumNodeIds":[],"mappingStatus":"integrated_skill"}],
    evidenceLabel: "ظهور باقة للصف الثاني بكالوريا على المنصة",
    confidenceLabel: "ثقة متوسطة – نقطة عامة منشورة",
    evidenceNote: "مراجعة أكتوبر المنشورة تثبت موضوعات عامة فقط؛ لا تثبت رقم الكورس المدفوع ولا أن الطالب شاهد هذه الموضوعات.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_MOHAMED_SALAH_OCT_REVIEW",
  },
  {
    teacherId: "T_AR_REDA_FAROUK", nameAr: "رضا الفاروق", brandName: "رضا الفاروق",
    subjectIds: ["ARB_G2_BAC"], profileUrl: "https://youtube.com/channel/UC7fHSfm6zxGJYC-P7RMzX7w",
    lastChecked: "2026-08-08",
    publicAudienceMetric: 1570000,
    publicAudienceMetricDate: "2026-11-14",
    popularitySignal: "قناة موثقة؛ قرابة 1.57M مشترك في لقطة عامة",
    latestPublicCheckpoint: "تأسيس النص المعلوماتي ومهارات الفكرة المحورية والرئيسية وتحليل الحجج والرأي المخالف؛ لا توجد نقطة مدفوعة أحدث مؤكدة.",
    teachingAdvice: "حدّد النقطة الأساسية في الفرع، افهمها، ثم طبّق عليها بأسئلة وامتحانات وتحقق من الإجابة. إذا تعثرت في سؤال، انتقل مؤقتًا ثم عد إليه.",
    teachingAdviceEvidence: "مقابلة صحفية 2024؛ نصيحة عامة وليست ترتيبًا إلزاميًا لامتحان 2027.",
    shortlistPosition: 2,
    coursePresence: "verified_public_content",
    courseVerifiedFor: "2 Bac 2027 Arabic",
    courseProgressEvidence: "فيديو 20 أغسطس يصف مراحل الكورس: شرح، حل وتطبيق، موجز وواجب، ثم امتحان. وفيديو 8 أغسطس يشرح أساسيات النص المعلوماتي.",
    latestCheckpointDate: "2026-08-08",
    scheduleEvidence: "فيديو تفاصيل مواعيد موجود لكن لم يتم تثبيت جدول حالي محدد.",
    scheduleEntries: [],
    progressConfidence: "low_to_medium_public_foundation_only",
    selectionLabel: "ترشيح واسع الانتشار",
    teacherNotes: "إطار عمل لأربع مراحل وليس نمط لقاء أسبوعي؛ لا تستنتج رقم محاضرة.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: false,
    adminFollowup: "إطار عمل لأربع مراحل وليس نمط لقاء أسبوعي؛ لا تستنتج رقم محاضرة. عند تعذر التحقق، استخدم مسار تحديد الموضع داخل المنصة ولا توقف الخطة.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    publicSegments: [{"title":"الفكرة المحورية والرئيسية والفرعية","curriculumNodeIds":[],"mappingStatus":"skill_only"},{"title":"تحليل الحجج والأدلة والرأي المخالف","curriculumNodeIds":[],"mappingStatus":"skill_only"}],
    evidenceLabel: "محتوى تأسيسي/عام للصف الثاني بكالوريا",
    confidenceLabel: "ثقة منخفضة إلى متوسطة – محتوى عام",
    evidenceNote: "المصدر يدعم وجود محتوى عام؛ لا يثبت موضع الكورس المدفوع الحالي.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_REDA_FAROUK_FOUNDATION",
  },
  {
    teacherId: "T_AR_MOHAMED_TAREK", nameAr: "محمد طارق", brandName: "القيصر",
    subjectIds: ["ARB_G2_BAC"], profileUrl: "https://youtube.com/@mr.mohamed_tarek",
    lastChecked: "2026-08-20",
    publicAudienceMetric: 422000,
    publicAudienceMetricDate: "2026-11-10",
    popularitySignal: "قناة تعليمية عامة تقارب 422K مشترك في لقطة نوفمبر 2026؛ مؤشر انتشار عام وليس تقييم جودة",
    latestPublicCheckpoint: "محتوى تأسيسي منشور 20 أغسطس عن فهم النص وتحليله ومناقشته وتوظيف اللغة والتحدث والكتابة.",
    shortlistPosition: 3,
    coursePresence: "verified_bac_listing_with_conflicting_generic_catalog",
    courseVerifiedFor: "2 Bac 2027 Arabic",
    courseProgressEvidence: "صفحة الكورس التفصيلية تعرض محاضرة أولى للصف الثاني ونوع التعليم بكالوريا؛ الكتالوج العام يعرض محاضرة سابعة للصف الثاني دون تعريف نفس مسار البكالوريا.",
    latestCheckpointDate: "2026-08-20",
    scheduleEvidence: "لا يوجد جدول حالي دقيق موثق في المصادر التي تم فحصها.",
    scheduleEntries: [],
    progressConfidence: "low_conflicting_catalog_evidence",
    selectionLabel: "ترشيح واسع الانتشار؛ المركز الثالث وفق مؤشرات الجمهور المتاحة",
    teacherNotes: "لا تعتبر المحاضرة السابعة هي الحالية لهذا الكورس؛ تعارض هوية الكورس يحتاج تحققًا.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: true,
    adminFollowup: "لا تعتبر المحاضرة السابعة هي الحالية لهذا الكورس؛ تعارض هوية الكورس يحتاج تحققًا. عند تعذر التحقق، استخدم مسار تحديد الموضع داخل المنصة ولا توقف الخطة.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    publicSegments: [{"title":"الفهم والتحليل والمناقشة وتوظيف اللغة والتحدث والكتابة","curriculumNodeIds":[],"mappingStatus":"foundation_skills_only"}],
    conflictOptions: [{"label":"صفحة كورس خاصة بالصف الثاني تعرض المحاضرة الأولى","sourceDate":"2026-08-20","sourceLabel":"صفحة الكورس التفصيلية","confidence":"هوية بكالوريا أوضح"},{"label":"الكتالوج العام يعرض المحاضرة السابعة مع هوية سنة/مسار غير محسومة","sourceDate":"2026-08-20","sourceLabel":"الكتالوج العام","confidence":"متعارضة وغير كافية"}],
    evidenceLabel: "ظهور قائمة بكالوريا مع تعارض في كتالوج عام",
    confidenceLabel: "ثقة منخفضة – توجد بيانات متعارضة",
    evidenceNote: "المصادر لا تحسم موضع الكورس المدفوع؛ لا نعتمد رقم محاضرة من هذه البيانات.",
    systemCourseVerification: { EG_BACCALAUREATE: "official_course_listing_and_public_2027_content", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_TAREK_CATALOG_CONFLICT",
  },
  {
    teacherId: "T_EN_MAHMOUD_RADWAN", nameAr: "محمود رضوان", brandName: "إنجلشاوي",
    subjectIds: ["ENG1_G2_BAC"], profileUrl: "https://www.youtube.com/@MahmoudRadwan.Englishawy",
    lastChecked: "2026-10-13",
    publicAudienceMetric: 1510000,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "قناة عامة قرابة 1.51M مشترك في لقطة حديثة",
    latestPublicCheckpoint: "Unit 1 - الجزء الثاني: كلمات الدرس الثالث، جرامر حالات If، كلمات الدرسين الرابع والخامس، وتقييمات الوزارة (13 أكتوبر 2026).",
    shortlistPosition: 1,
    coursePresence: "verified_public_2027_course_package_and_public_unit1_reviews",
    courseVerifiedFor: "2 Bac 2027 English",
    courseProgressEvidence: "فيديو 25 سبتمبر يصف باقة الترم الأول: كلمات وجرامر وحدات 1-3 بالجزء الأول، ووحدات 4-5 بالثاني، مع المهارات والقصة وبنوك الأسئلة. مراجعتا 11 و13 أكتوبر تفصلان محتوى Unit 1.",
    latestCheckpointDate: "2026-10-13",
    scheduleEvidence: "لا يوجد جدول حالي موثق؛ لا تعمم نمط أسبوعي أو عدد محاضرات ثابت.",
    scheduleEntries: [],
    progressConfidence: "medium_public_multi_segment_checkpoint",
    selectionLabel: "ترشيح واسع الانتشار",
    teacherNotes: "الفيديو الواحد قد يجمع Vocabulary وGrammar وتقييمات لأكثر من درس؛ لا تستنتج أن المدرس في Unit 3 أو أن رقم درس المفردات هو رقم المحاضرة.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: true,
    adminFollowup: "الفيديو الواحد قد يجمع Vocabulary وGrammar وعدة دروس؛ لا تستنتج أن المدرس في Unit 3 أو أن رقم درس المفردات هو رقم المحاضرة. عند تعذر التحقق، استخدم مسار تحديد الموضع داخل المنصة ولا توقف الخطة.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: ["ENG_U1_SEC_A_T1","ENG_U1_SEC_A_T2","ENG_U1_SEC_B_T1","ENG_U1_SEC_B_T2"],
    publicSegments: [{"title":"كلمات الدرس الأول وجرامره","timestamp":"2026-10-11","curriculumNodeIds":["ENG_U1_SEC_A_T1","ENG_U1_SEC_A_T2","ENG_U1_SEC_B_T1","ENG_U1_SEC_B_T2"],"mappingStatus":"unit_level_mapping"},{"title":"كلمات الدرس الثاني وجرامره","timestamp":"2026-10-11","curriculumNodeIds":["ENG_U1_SEC_A_T1","ENG_U1_SEC_A_T2","ENG_U1_SEC_B_T1","ENG_U1_SEC_B_T2"],"mappingStatus":"unit_level_mapping"},{"title":"كلمات الدرس الثالث","timestamp":"2026-10-13","curriculumNodeIds":["ENG_U1_SEC_A_T1","ENG_U1_SEC_A_T2","ENG_U1_SEC_B_T1","ENG_U1_SEC_B_T2"],"mappingStatus":"unit_level_mapping"},{"title":"جرامر حالات If","timestamp":"2026-10-13","curriculumNodeIds":["ENG_U1_SEC_A_T1","ENG_U1_SEC_A_T2","ENG_U1_SEC_B_T1","ENG_U1_SEC_B_T2"],"mappingStatus":"unit_level_mapping"},{"title":"كلمات الدرسين الرابع والخامس مع التقييمات","timestamp":"2026-10-13","curriculumNodeIds":["ENG_U1_SEC_A_T1","ENG_U1_SEC_A_T2","ENG_U1_SEC_B_T1","ENG_U1_SEC_B_T2"],"mappingStatus":"unit_level_mapping"}],
    evidenceLabel: "باقة/محتوى منشور للصف الثاني بكالوريا",
    confidenceLabel: "ثقة متوسطة – نقاط عامة متعددة",
    evidenceNote: "المراجعات العامة لا تثبت ترتيب الكورس المدفوع أو تقدم الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_ENGLISHWAY_UNIT1_OCT13",
  },
  {
    teacherId: "T_EN_SHERIF", nameAr: "شريف المصري", brandName: "شريف المصري",
    subjectIds: ["ENG1_G2_BAC"], profileUrl: "https://sherifelmassry.com/",
    lastChecked: "2026-11-01",
    publicAudienceMetric: 250000,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "قناة عامة قرابة 250K مشترك",
    latestPublicCheckpoint: "مراجعة Unit 1 وشرح القصة منشوران علنًا؛ لا يثبت ذلك آخر نقطة في الكورس المدفوع.",
    shortlistPosition: 2,
    coursePresence: "verified_teacher_platform_and_channel",
    courseVerifiedFor: "2 Bac 2027 English",
    courseProgressEvidence: "مراجعات Unit 1 Part 1/Part 2 مرصودة، وشرح The Lost World منشور 1 نوفمبر 2026.",
    latestCheckpointDate: "2026-11-01",
    scheduleEvidence: "لا يوجد جدول حالي موثّق.",
    scheduleEntries: [],
    progressConfidence: "low",
    selectionLabel: "ترشيح واسع الانتشار",
    teacherNotes: "وجود فيديو القصة لا يعني التقدم الحالي في كورس الوحدة.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: true,
    adminFollowup: "تحقق من التسلسل الحالي للكورس المدفوع، ثم اربط مقاطع المدرس بعقد المنهج الرسمي.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    evidenceLabel: "وجود منصة وقناة ومحتوى عام",
    confidenceLabel: "موضع الكورس المدفوع يحتاج تأكيدًا من الطالب",
    evidenceNote: "المتاح يثبت وجود المدرس ومحتوى عام فقط؛ لا يثبت ترتيب الكورس المدفوع.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_SHERIF",
  },
  {
    teacherId: "T_EN_AHMED_SOBHY", nameAr: "أحمد صبحي", brandName: "إنجليزي البكالوريا",
    subjectIds: ["ENG1_G2_BAC"], profileUrl: "https://zolotube.com/channel?id=UCP4vtEvANSvCszyJFBEiqOA",
    lastChecked: "2026-11-17",
    publicAudienceMetric: 6350,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "قناة عامة قرابة 6.35K مشترك مع محتوى 2 Bac 2027 حديث",
    latestPublicCheckpoint: "شرح Unit 4 منشور علنًا؛ قد يكون محتوى إضافيًا ولا يثبت ترتيب الكورس المدفوع.",
    shortlistPosition: 3,
    coursePresence: "verified_public_content",
    courseVerifiedFor: "2 Bac 2027 English",
    courseProgressEvidence: "لقطة عامة قرب 17 نوفمبر تعرض اختبار الوحدات الثلاث الأولى وشرح Unit 4.",
    latestCheckpointDate: "2026-11-17",
    scheduleEvidence: "لا يوجد جدول حالي موثوق.",
    scheduleEntries: [],
    progressConfidence: "medium_public_post_only",
    selectionLabel: "خيار متخصص أصغر انتشارًا",
    teacherNotes: "عدد المتابعين ليس تقييمًا لجودة التدريس.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: false,
    adminFollowup: "تحقق من التسلسل الحالي للكورس المدفوع، ثم اربط مقاطع المدرس بعقد المنهج الرسمي.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    evidenceLabel: "محتوى عام مرتبط بالصف الثاني",
    confidenceLabel: "ثقة متوسطة – منشور عام",
    evidenceNote: "المحتوى العام لا يثبت تسلسل كورس مدفوع مطابقًا أو تقدم الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_AHMED_SOBHY",
  },
  {
    teacherId: "T_HIS_AHMED_GHONIEM", nameAr: "أحمد غنيم", brandName: "أحمد غنيم",
    subjectIds: ["HIS_G2_BAC"], profileUrl: "https://ahmedghoniem.com/",
    lastChecked: "2026-08-29",
    publicAudienceMetric: 186000,
    publicAudienceMetricDate: "2026-08-29",
    popularitySignal: "قناة موثقة تقارب 186K متابع",
    latestPublicCheckpoint: "إعلان الخطة السنوية فقط؛ آخر درس مدفوع غير معروف. بعض مقاطع المدرس تستخدم تقسيمات خاصة لا تساوي فهرس الوزارة.",
    teachingAdvice: "في التاريخ: حدّد الحدث وأسبابه ونتائجه وموقعه الزمني وعلاقته بحدث آخر، ثم مارس تحليل النص والخريطة ونقطة التحول والاستثناء.",
    teachingAdviceEvidence: "مهارات يصفها المعلم في محاضرته التأسيسية؛ أفكار تدريب وليست مواصفة رسمية للامتحان.",
    shortlistPosition: 1,
    coursePresence: "verified_teacher_primary",
    courseVerifiedFor: "2 Bac 2027 History",
    courseProgressEvidence: "فيديو 29 أغسطس يعلن خطة سنوية لتاريخ تانية بكالوريا حتى أول جمعة في أبريل؛ لا توجد قائمة مدفوعة مؤرخة بآخر الموضوعات.",
    latestCheckpointDate: "2026-08-29",
    scheduleEvidence: "خريطة عامة لنهاية الكورس؛ لم تُستخرج مواعيد لقاءات محددة.",
    scheduleEntries: [],
    progressConfidence: "low_public_annual_plan_only",
    selectionLabel: "ترشيح واسع الانتشار",
    teacherNotes: "لا تنسخ وحدات المدرس كأنها وحدات كتاب الوزارة؛ طابق عناوين الموضوعات.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: false,
    adminFollowup: "لا تنسخ وحدات المدرس كأنها وحدات كتاب الوزارة؛ طابق عناوين الموضوعات. عند تعذر التحقق، استخدم مسار تحديد الموضع داخل المنصة ولا توقف الخطة.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    evidenceLabel: "خطة سنوية منشورة من موقع المدرس",
    confidenceLabel: "ثقة منخفضة – خطة عامة فقط",
    evidenceNote: "الخطة السنوية لا تثبت رقم المحاضرة المدفوعة أو تقدم الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_AHMED_GHONIEM_YEAR_PLAN",
  },
  {
    teacherId: "T_HIS_MARWAN", nameAr: "مروان حسن", brandName: "المؤرخ مروان حسن",
    subjectIds: ["HIS_G2_BAC"], profileUrl: "https://youtube.com/channel/UCJqSCcNDCxe4b259TXPZbcw",
    lastChecked: "2026-11-15",
    publicAudienceMetric: 66200,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "لقطة تحليلات قناة عامة قرابة 66.2K مشترك",
    latestPublicCheckpoint: "مقاطع عامة عن دروس 4-6؛ ترتيب المدرس غير مطابق آليًا للكتاب.",
    teachingAdvice: "استخدم السرد والربط بين الأحداث بدل حفظ كل حدث منفصلًا، ثم اختبر الفهم بأسئلة متدرجة.",
    teachingAdviceEvidence: "ملخص وصف القناة العامة.",
    shortlistPosition: 2,
    coursePresence: "verified_public_content",
    courseVerifiedFor: "2 Bac 2027 History",
    courseProgressEvidence: "مقاطع حديثة عن دروس 4-6 ومحتوى على الوحدة الثانية؛ لا توجد مطابقة موثوقة بين ترقيم الفيديوهات وترقيم الكتاب.",
    latestCheckpointDate: "2026-11-15",
    scheduleEvidence: "وقت النشر على القناة ليس موعد حصة؛ لا يوجد جدول حالي موثق.",
    scheduleEntries: [],
    progressConfidence: "low_to_medium",
    selectionLabel: "ترشيح متوسط الانتشار",
    teacherNotes: "لا تستعمل وقت نشر YouTube كموعد دراسة.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: false,
    adminFollowup: "تحقق من التسلسل الحالي للكورس المدفوع، ثم اربط مقاطع المدرس بعقد المنهج الرسمي.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    evidenceLabel: "محتوى تاريخ عام منشور",
    confidenceLabel: "ثقة منخفضة إلى متوسطة – محتوى عام",
    evidenceNote: "المحتوى العام لا يثبت ترتيب كورس مدفوع أو موعدًا ثابتًا.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_MARWAN",
  },
  {
    teacherId: "T_HIS_ABDELHADY", nameAr: "محمود عبدالهادي", brandName: "محمود عبدالهادي",
    subjectIds: ["HIS_G2_BAC"], profileUrl: "https://zolotube.com/channel?id=UCThV5LrCMIWs9tyDvZ9IC2w",
    lastChecked: "2026-11-17",
    publicAudienceMetric: 27700,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "قناة عامة قرابة 27.7K مشترك ومحتوى تاريخ بكالوريا حديث",
    latestPublicCheckpoint: "حل واجب الدرس الرابع مع شرح الدرس الثالث في الوحدة الثانية قبلها.",
    shortlistPosition: 3,
    coursePresence: "verified_public_content",
    courseVerifiedFor: "2 Bac 2027 History",
    courseProgressEvidence: "مقاطع حديثة على الدرسين 2 و3 من الوحدة الثانية، وحل واجب الدرس الرابع مرصود في 17 نوفمبر.",
    latestCheckpointDate: "2026-11-17",
    scheduleEvidence: "لا يوجد جدول حالي موثق.",
    scheduleEntries: [],
    progressConfidence: "medium_public_post_only",
    selectionLabel: "خيار متخصص أصغر انتشارًا",
    teacherNotes: "موضع محتوى عام؛ لا يثبت تسلسل منصة الاشتراك.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: false,
    adminFollowup: "تحقق من التسلسل الحالي للكورس المدفوع، ثم اربط مقاطع المدرس بعقد المنهج الرسمي.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    evidenceLabel: "محتوى تاريخ عام منشور",
    confidenceLabel: "ثقة متوسطة – منشور عام",
    evidenceNote: "المصدر العام لا يثبت موضع المحتوى المدفوع أو تقدم الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_ABDELHADY",
  },
  {
    teacherId: "T_PROG_IMAD_SHARAF", nameAr: "عماد شرف", brandName: "WE4CODE",
    subjectIds: ["PROG_AI_G2_BAC"], profileUrl: "https://we4code.com/course/7",
    lastChecked: "2026-11-17",
    shortlistPosition: 1,
    coursePresence: "verified_platform_course_listing",
    courseVerifiedFor: "الصف الثاني بكالوريا 2027 - البرمجة والذكاء الاصطناعي (إدراجات شهرية على WE4CODE)",
    courseProgressEvidence: "صفحة الشهر الأول تعرض عناصر للدرس الأول وشرحًا وملفات وواجبًا وتقييمات؛ توجد صفحة شهر ثانٍ منفصلة.",
    latestPublicCheckpoint: "فهرس كورس الشهر الأول يعرض عناصر مرتبطة بالدرس الأول وفق كتاب EXO CODE وكتاب الوزارة؛ لا يُعرف أحدث عنصر مدفوع حاليًا.",
    latestCheckpointDate: "2026-11-17",
    popularitySignal: "موجود في كتالوج منصة تعليمية يعرض كورسات للشهر الأول والثاني لتانية بكالوريا؛ لا تتوفر مقارنة جمهور موحدة.",
    scheduleEvidence: "إحدى صفحات المنصة تذكر موعد إصدار يوم الأربعاء؛ لا يُحوّل ذلك إلى خيار إدخال للطالب ولا يُستخدم كتكرار مستقبلي دون تحديث.",
    scheduleEntries: [],
    progressConfidence: "medium_course_catalog_presence_only",
    selectionLabel: "مرشح بكورس ظاهر على منصة",
    teacherNotes: "مرشح أولي بناءً على وجود كتالوج دورة محددة؛ لا يوجد ترتيب شهرة موحد. لا تعرض الموضع المدفوع الحالي قبل فحص صفحة الكورس المحدثة.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: true,
    adminFollowup: "الكتالوج/الفيديو يثبت وجود محتوى عام أو إدراج دورة فقط؛ لم يثبت رقم المحاضرة المدفوعة الحالي. استخدم مسار تحديد الموضع داخل المنصة ولا تستنتج رقمًا.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    evidenceLabel: "إدراج كورس للصف الثاني بكالوريا على WE4CODE",
    confidenceLabel: "ثقة متوسطة – وجود الكورس في الكتالوج",
    evidenceNote: "إدراج المنصة يثبت وجود الكورس، لكنه لا يعرض فهرسًا كاملًا أو تقدم الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "course_listing_for_2027_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_PROG_WE4CODE_IMAD",
  },
  {
    teacherId: "T_PROG_ANAS_AHMED", nameAr: "د. أنس أحمد", brandName: "Code-UP",
    subjectIds: ["PROG_AI_G2_BAC"], profileUrl: "https://www.code-up.tech/",
    lastChecked: "2026-11-17",
    shortlistPosition: 2,
    coursePresence: "verified_platform_course_listing",
    courseVerifiedFor: "الصف الثاني بكالوريا - كورس نوفمبر للبرمجة والذكاء الاصطناعي",
    courseProgressEvidence: "قائمة الكورسات تعرض كورسًا نظريًا بعنوان ثانية بكالوريا - كورس شهر نوفمبر - البرمجة والذكاء الاصطناعي - د/ أنس أحمد.",
    latestPublicCheckpoint: "إدراج كورس شهر نوفمبر؛ محتوى المحاضرات وترقيم أحدث عنصر غير ظاهرين في نتيجة الفهرسة.",
    latestCheckpointDate: "2026-11-17",
    popularitySignal: "منصة Code-UP تعلن أكثر من 1000 متعلم إجمالًا وتعرض كورسًا لشهر نوفمبر للبرمجة لتانية بكالوريا باسم د. أنس أحمد؛ الرقم ليس عدد طلاب هذا المدرس أو هذا الكورس.",
    scheduleEvidence: "لا يوجد موعد دقيق منشور أمكن التحقق منه.",
    scheduleEntries: [],
    progressConfidence: "low_to_medium_course_listing_only",
    selectionLabel: "مرشح بكورس ظاهر على منصة",
    teacherNotes: "العدد 1000+ يخص المنصة ككل؛ لا تنسبه للمدرس ولا تستخدمه مقياس شهرة شخصي. فهرس المحاضرات يحتاج مراجعة داخل صفحة الكورس.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: true,
    adminFollowup: "الكتالوج/الفيديو يثبت وجود محتوى عام أو إدراج دورة فقط؛ لم يثبت رقم المحاضرة المدفوعة الحالي. استخدم مسار تحديد الموضع داخل المنصة ولا تستنتج رقمًا.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    evidenceLabel: "إدراج كورس نوفمبر على Code-UP",
    confidenceLabel: "ثقة منخفضة إلى متوسطة – إدراج كتالوج",
    evidenceNote: "الإدراج يثبت وجود منتج للكورس، والفهرس الداخلي غير مكتمل.",
    systemCourseVerification: { EG_BACCALAUREATE: "course_listing_for_2026_2027_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_PROG_CODEUP_ANAS",
  },
  {
    teacherId: "T_PROG_KHALED_ASHRAF", nameAr: "خالد أشرف", brandName: "برمجة بكالوريا",
    subjectIds: ["PROG_AI_G2_BAC"], profileUrl: "https://www.youtube.com/watch?v=oIYgUBLUJxU",
    lastChecked: "2026-08-27",
    publicAudienceMetric: 6150,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "لقطة قناة عامة تظهر نحو 6,150 مشتركًا وفيديو الدرس الثاني نحو 46,389 مشاهدة وقت الفهرسة؛ هذه أرقام وصول لا جودة تدريس.",
    latestPublicCheckpoint: "الدرس الثاني: كيف يعمل الذكاء الاصطناعي، ويتناول AI وML وDL وANN وGenAI والهلوسة.",
    shortlistPosition: 3,
    coursePresence: "verified_public_video_for_grade_and_subject",
    courseVerifiedFor: "محتوى عام للصف الثاني بكالوريا 2027 - درس كيف يعمل الذكاء الاصطناعي",
    courseProgressEvidence: "فيديو منشور 27 أغسطس 2026 وموسوم صراحة بأنه الدرس الثاني من منهج البرمجة والذكاء الاصطناعي لتانية بكالوريا 2027.",
    latestCheckpointDate: "2026-08-27",
    scheduleEvidence: "لا يوجد جدول مواعيد حالي موثق.",
    scheduleEntries: [],
    progressConfidence: "medium_public_checkpoint_only",
    selectionLabel: "مرشح بمحتوى عام موثق",
    teacherNotes: "الفيديو يثبت محتوى عامًا فقط، ولا يثبت وجود كورس مدفوع أو آخر محاضرة مدفوعة. لا تعرضه ككورس مدفوع مؤكد.",
    paidCoursePositionStatus: "not_verified_from_public_evidence",
    studentInputRequired: true,
    adminFollowup: "الكتالوج/الفيديو يثبت وجود محتوى عام أو إدراج دورة فقط؛ لم يثبت رقم المحاضرة المدفوعة الحالي. استخدم مسار تحديد الموضع داخل المنصة ولا تستنتج رقمًا.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: ["PROG_1_2"],
    publicSegments: [{"title":"ما هو الذكاء الاصطناعي","timestamp":"09:09","curriculumNodeIds":["PROG_1_2"],"mappingStatus":"content_match"},{"title":"التعلم الآلي","timestamp":"20:42","curriculumNodeIds":["PROG_1_2"],"mappingStatus":"segment_within_lesson"},{"title":"التعلم العميق","timestamp":"25:05","curriculumNodeIds":["PROG_1_2"],"mappingStatus":"segment_within_lesson"},{"title":"الشبكات العصبية الاصطناعية","timestamp":"30:51","curriculumNodeIds":["PROG_1_2"],"mappingStatus":"segment_within_lesson"},{"title":"الذكاء الاصطناعي التوليدي","timestamp":"33:40","curriculumNodeIds":["PROG_1_2"],"mappingStatus":"segment_within_lesson"},{"title":"هلوسة الذكاء الاصطناعي","timestamp":"43:17","curriculumNodeIds":["PROG_1_2"],"mappingStatus":"segment_within_lesson"}],
    evidenceLabel: "فيديو عام للصف الثاني – درس عن عمل الذكاء الاصطناعي",
    confidenceLabel: "ثقة متوسطة – نقطة عامة فقط",
    evidenceNote: "الفيديو لا يثبت وجود كورس مدفوع أو آخر محاضرة فيه.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_lesson_2_2027_found_paid_course_unverified", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_PROG_KHALED_OCT_LESSON2",
  },

  {
    teacherId: "T_HIS_AHMED_ADEL", nameAr: "أحمد عادل", brandName: "أحمد عادل",
    subjectIds: ["HIS_G2_BAC"], profileUrl: "https://www.mr-ahmed-adel.com/course/90",
    lastChecked: "2026-11-21",
    coursePresence: "verified_on_platform",
    courseVerifiedFor: "2 Bac 2027 — National History",
    courseProgressEvidence: "المنصة الرسمية تعرض باقة المنهج كاملًا في التاريخ الوطني للصف الثاني بكالوريا 2027. صفحة الكورس لا تعرض فهرس عناصر مدفوعة يمكن منه إثبات آخر محاضرة أو ترتيبها.",
    paidCourseCatalogFrontier: {
      courseTitle: "باقة المنهج كاملًا في التاريخ الوطني — الصف الثاني بكالوريا 2027",
      courseUrl: "https://www.mr-ahmed-adel.com/course/90",
      checkedAt: "2026-11-21",
      sequenceVisible: false,
      note: "وجود الباقة مثبت على المنصة الرسمية؛ أسماء وترتيب آخر العناصر المدفوعة غير ظاهرة في الفهرس العام."
    },
    latestCheckpointDate: "2026-11-21",
    scheduleEvidence: "لا يوجد موعد حالي محدد تم التحقق منه.",
    scheduleEntries: [],
    progressConfidence: "course_presence_only_paid_item_frontier_unknown",
    selectionLabel: "مدرس تاريخ — كورس رسمي للصف الثاني بكالوريا 2027",
    teacherNotes: "لا يُستنتج موضع المحاضرة المدفوعة من وجود الباقة وحده.",
    paidCoursePositionStatus: "catalog_bundle_verified_item_frontier_unknown",
    studentInputRequired: true,
    adminFollowup: "يلزم فهرس عام لعناصر الباقة أو موصل مصرح به لتحديث آخر عنصر مدفوع. لا تطلب كلمة مرور المنصة من الطالب.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    publicSegments: [],
    evidenceLabel: "كورس تاريخ وطني رسمي للصف الثاني بكالوريا",
    confidenceLabel: "وجود الكورس مثبت؛ موضعه التفصيلي غير مثبت",
    evidenceNote: "الصفحة الرسمية تعرض باقة المنهج الكامل، لكنها لا تثبت آخر عنصر مدفوع أو ما أنجزه الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "official_2bac_course_listing_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_AHMED_ADEL_OFFICIAL_2BAC_2027",
    shortlistPosition: 4,
  },
  {
    teacherId: "T_HIS_GOMAA_EL_SAYED", nameAr: "جمعة السيد", brandName: "منصة القيصر",
    subjectIds: ["HIS_G2_BAC"], profileUrl: "https://gomaa-elsayed.com/years/2",
    lastChecked: "2026-11-21",
    coursePresence: "verified_on_platform",
    courseVerifiedFor: "2 Bac 2027 — National History",
    courseProgressEvidence: "المنصة الرسمية تعرض كورسات تاريخ وطني للصف الثاني بكالوريا، بما فيها كورس الشهر الثالث. العرض العام لا يكشف أسماء عناصر الكورس المدفوع أو آخر عنصر متاح.",
    paidCourseCatalogFrontier: {
      courseTitle: "كورسات التاريخ الوطني — الصف الثاني بكالوريا",
      courseUrl: "https://gomaa-elsayed.com/years/2",
      checkedAt: "2026-11-21",
      sequenceVisible: false,
      note: "وجود كورسات الصف الثاني بكالوريا مثبت؛ فهرس العناصر المدفوعة التفصيلي غير ظاهر في المصدر العام."
    },
    latestCheckpointDate: "2026-11-21",
    scheduleEvidence: "لم يتم تثبيت جدول حالي محدد للمحاضرات.",
    scheduleEntries: [],
    progressConfidence: "course_presence_only_paid_item_frontier_unknown",
    selectionLabel: "مدرس تاريخ — كورسات بكالوريا موثقة",
    teacherNotes: "لا يُستنتج آخر درس مدفوع من عنوان الباقة أو شهرها.",
    paidCoursePositionStatus: "catalog_bundle_verified_item_frontier_unknown",
    studentInputRequired: true,
    adminFollowup: "يلزم فهرس علني لعناصر الكورس أو تكامل مصرح به لمعرفة العنصر المدفوع الأخير.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    publicSegments: [],
    evidenceLabel: "منصة رسمية تعرض كورسات التاريخ الوطني للصف الثاني بكالوريا",
    confidenceLabel: "وجود الكورس مثبت؛ موضعه التفصيلي غير مثبت",
    evidenceNote: "قائمة الكورسات تثبت ارتباط المدرس بالمادة والصف؛ لا تثبت ما شاهده الطالب أو آخر عنصر مدفوع.",
    systemCourseVerification: { EG_BACCALAUREATE: "official_2bac_course_listing_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_GOMAA_EL_SAYED_OFFICIAL_2BAC_2027",
    shortlistPosition: 5,
  },
  {
    teacherId: "T_PROG_MAZEN_ALI_BARMAGTHALK", nameAr: "م. مازن علي", brandName: "برمجتهالك",
    subjectIds: ["PROG_AI_G2_BAC"], profileUrl: "https://barmagthalk.pyramitech.com/",
    lastChecked: "2026-11-21",
    coursePresence: "verified_on_platform",
    courseVerifiedFor: "2 Bac 2027 — Programming & AI (Arabic and Languages)",
    courseProgressEvidence: "المنصة الرسمية تعرض كورس الشهر الثالث للصف الثاني بكالوريا (عربي/لغات) في 4 محاضرات مع تدريبات تفاعلية وامتحانات عملية. لا تعرض أسماء المحاضرات الأربعة أو آخر عنصر تم فتحه.",
    paidCourseCatalogFrontier: {
      courseTitle: "كورس الشهر الثالث للصف الثاني بكالوريا — عربي ولغات",
      courseUrl: "https://barmagthalk.pyramitech.com/",
      checkedAt: "2026-11-21",
      lessonCount: 4,
      sequenceVisible: false,
      note: "فهرس المنصة يثبت وجود كورس الشهر الثالث وأربع محاضرات؛ عناوين المحاضرات وترتيب آخر عنصر غير ظاهرين في المصدر العام."
    },
    latestCheckpointDate: "2026-11-21",
    scheduleEvidence: "لا يوجد جدول أسبوعي حالي مثبت من المصدر العام.",
    scheduleEntries: [],
    progressConfidence: "course_catalog_verified_item_sequence_unknown",
    selectionLabel: "منصة برمجة وبكالوريا موثقة",
    teacherNotes: "المصدر يثبت وجود الكورس وعدد محاضرات الباقة، لكنه لا يثبت آخر فيديو مدفوع أو إنجاز الطالب.",
    paidCoursePositionStatus: "catalog_bundle_verified_item_frontier_unknown",
    studentInputRequired: true,
    adminFollowup: "يلزم ربط رسمي أو موافقة من المنصة أو فهرس علني للعناصر لتحديث تقدم المدرس تلقائيًا؛ لا تطلب بيانات دخول الطالب.",
    studentAttendedFrontierStatus: "requires_student_signal_or_SIE_progress_event",
    mappedCurriculumNodeIds: [],
    publicSegments: [],
    evidenceLabel: "منصة برمجتهالك تعرض مسارات وكورسات برمجة للصف الثاني بكالوريا",
    confidenceLabel: "توفر الكورس وعدد عناصر الباقة مثبتان؛ عناوين العناصر غير متاحة علنًا",
    evidenceNote: "البيانات المستعملة من واجهة الكتالوج العام، وليست وصولًا إلى محتوى مدفوع.",
    systemCourseVerification: { EG_BACCALAUREATE: "official_2bac_course_listing_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_BARMAGTHALK_G2_MONTH3_CATALOG",
    shortlistPosition: 4,
  },

];

export function getSIETracks(systemId: SIESystemId) {
  return SIE_TRACKS.filter(track => track.systemId === systemId);
}

export function getSIETrack(trackId: string) {
  return SIE_TRACKS.find(track => track.trackId === trackId);
}

export function getSIESubject(subjectId: string) {
  return SIE_SUBJECTS.find(subject => subject.subjectId === subjectId);
}

export function getSIETeacher(teacherId: string) {
  return SIE_TEACHERS.find(teacher => teacher.teacherId === teacherId);
}

export function getSIESubjectsForTrack(trackId: string): SIESubject[] {
  const track = getSIETrack(trackId);
  if (!track) return [];
  const ids = track.fixedSubjectIds ?? track.requiredSubjectIds;
  return ids.map(getSIESubject).filter((item): item is SIESubject => Boolean(item));
}

export function getSIEElectiveGroups(trackId: string): SIESubject[][] {
  return getSIETrack(trackId)?.electiveOptions ?? [];
}

export function getSIETeachersForSubject(subjectId: string, systemId: SIESystemId): SIETeacher[] {
  return SIE_TEACHERS
    .filter(teacher => teacher.subjectIds.includes(subjectId))
    .filter(teacher => {
      const status = teacher.systemCourseVerification[systemId];
      return Boolean(status && status !== "not_verified_for_2026_2027");
    })
    .slice(0, SIE_CATALOG_META.teacherRecommendationLimit);
}

export function getSIEEducationSystem(systemId: SIESystemId): SIEEducationSystem {
  return systemId === BAC_SYSTEM ? "baccalaureate" : "general_secondary";
}

export function validateSIESubjectSelection(systemId: SIESystemId, trackId: string, subjectIds: string[]) {
  const track = getSIETrack(trackId);
  if (!track || track.systemId !== systemId || subjectIds.length === 0) return false;
  const uniqueIds = new Set(subjectIds);
  if (uniqueIds.size !== subjectIds.length) return false;
  if (track.fixedSubjectIds) {
    const valid = new Set(track.fixedSubjectIds);
    return subjectIds.length === valid.size && subjectIds.every(id => valid.has(id));
  }
  const required = new Set(track.requiredSubjectIds);
  if (!track.requiredSubjectIds.every(id => uniqueIds.has(id))) return false;
  const electives = track.electiveOptions.flat();
  const allowed = new Set([...required, ...electives.map(subject => subject.subjectId)]);
  if (!subjectIds.every(id => allowed.has(id))) return false;
  return track.electiveOptions.every(group => group.filter(subject => uniqueIds.has(subject.subjectId)).length === 1);
}


/** نقطة منهج رسمية مع فرع مستقل داخل بنية الكتاب. */
export type SIECheckpointChoice = {
  nodeId: string;
  title: string;
  unitTitle: string;
  note?: string;
  author?: string;
  unitNumber?: number;
  lessonNumber?: string;
  courseSequenceNumber?: number;
  lessonType?: "reading" | "poetry" | "prose" | "grammar" | "vocabulary" | "rhetoric" | "expression" | "spelling" | "story" | "topic";
  sourceLabel?: string;
  branchId?: string;
  branchTitle?: string;
  branchType?: "official_unit" | "official_section" | "course_track";
};

export type SIECheckpointBranch = {
  branchId: string;
  branchTitle: string;
  branchType: "official_unit" | "official_section" | "course_track";
  choices: SIECheckpointChoice[];
};

const ENGLISH_SECTION_TITLES: Record<string, string> = {
  ENG_U1_SEC_A: "Social Reflection",
  ENG_U1_SEC_B: "Shared Responsibility",
  ENG_U2_SEC_A: "Leisure in a Digital World",
  ENG_U2_SEC_B: "Lifelong Activity",
  ENG_U3_SEC_A: "Historical Landscape",
  ENG_U3_SEC_B: "Documenting History",
  ENG_U4_SEC_A: "Food Awareness",
  ENG_U4_SEC_B: "Online Consumption",
  ENG_U5_SEC_A: "Climate Change",
  ENG_U5_SEC_B: "Egypt’s Green Change Makers",
  ENG_U6_SEC_A: "Global Responsibility",
  ENG_U6_SEC_B: "Speaking Up for Others",
  ENG_U7_SEC_A: "Where Passion Begins",
  ENG_U7_SEC_B: "What Passion Leaves Behind",
  ENG_U8_SEC_A: "Bridging Skills and Future Careers",
  ENG_U8_SEC_B: "Building Future Professionals",
  ENG_U9_SEC_A: "A Sense of Belonging",
  ENG_U9_SEC_B: "Inclusion and Community Action",
  ENG_U10_SEC_A: "What We Don’t See",
  ENG_U10_SEC_B: "The Price We Don’t Count",
};

/**
 * التصنيف التفاعلي يراعي بنية المادة الفعلية:
 * العربية مسارات مهارية مستقلة، والإنجليزية Vocabulary/Grammar/GRE
 * إلى جانب موضوعات الكتاب، بينما التاريخ والبرمجة مساران خطيان كاملان.
 * المواد التي لم يكتمل فهرسها تظهر كمسار غير مكتمل بلا عناوين مخترعة؛
 * لا يُسمح للطالب بإنشاء نقاط منهج خارج الفهرس الرسمي.
 */
function getOfficialBranch(subjectId: string, choice: SIECheckpointChoice) {
  if (choice.branchId && choice.branchTitle && choice.branchType) {
    return { branchId: choice.branchId, branchTitle: choice.branchTitle, branchType: choice.branchType };
  }
  if (subjectId === "ENG1_G2_BAC") {
    const section = choice.nodeId.match(/^(ENG_U\d+_SEC_[AB])/i)?.[1];
    if (section) {
      const unitNumber = choice.unitNumber ?? Number(section.match(/^ENG_U(\d+)/i)?.[1] ?? 0);
      const sectionLetter = section.endsWith("_A") ? "A" : "B";
      const sectionTitle = ENGLISH_SECTION_TITLES[section] ?? choice.unitTitle;
      return {
        branchId: section,
        branchTitle: `Unit ${unitNumber} · Section ${sectionLetter} — ${sectionTitle}`,
        branchType: "official_section" as const,
      };
    }
  }

  const prefixPattern = subjectId === "PROG_AI_G2_BAC"
    ? /^(PROG_\d+)_/
    : subjectId === "ARB_G2_BAC"
      ? /^(ARB_U\d+)/
      : subjectId === "HIS_G2_BAC"
        ? /^(HIS_U\d+)/
        : null;
  const prefix = prefixPattern ? choice.nodeId.match(prefixPattern)?.[1] : null;
  return {
    branchId: prefix ?? `${subjectId}:${choice.unitTitle}`,
    branchTitle: choice.unitTitle,
    branchType: "official_unit" as const,
  };
}

export const SIE_CHECKPOINT_CHOICES: Record<string, SIECheckpointChoice[]> = {
  ARB_G2_BAC: [
    // Arabic teacher-course sequence: 21 lessons grouped by their real learning branch.
    { nodeId: "ARB_U1_L1", title: "العلم بين القانون والضمير", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "1", courseSequenceNumber: 1, lessonType: "reading", sourceLabel: "فهرس الدروس وكتاب الطالب", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U1_N1", title: "الأسماء الخمسة", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "1", courseSequenceNumber: 2, lessonType: "grammar", sourceLabel: "فهرس الدروس وكتاب الطالب", branchId: "ARB_NAHW", branchTitle: "النحو", branchType: "course_track" },
    { nodeId: "ARB_C03_HIJJAGI", title: "الأسلوب الحجاجي", unitTitle: "الترم الأول", courseSequenceNumber: 3, lessonType: "expression", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_C04_KHABARI_ENSHAEI", title: "الأسلوب الخبري والأسلوب الإنشائي", unitTitle: "الترم الأول", courseSequenceNumber: 4, lessonType: "rhetoric", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_BALAGHA", branchTitle: "البلاغة", branchType: "course_track" },
    { nodeId: "ARB_C05_MAIN_IDEA", title: "شرح الفكرة الرئيسة", unitTitle: "الترم الأول", courseSequenceNumber: 5, lessonType: "reading", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_C06_VIEWPOINT", title: "شرح زاوية الرؤية", unitTitle: "الترم الأول", courseSequenceNumber: 6, lessonType: "reading", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U1_L2", title: "الخلق جوهر الفضيلة", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "2", courseSequenceNumber: 7, lessonType: "prose", sourceLabel: "فهرس الدروس وكتاب الطالب", branchId: "ARB_TEXTS", branchTitle: "النصوص", branchType: "course_track" },
    { nodeId: "ARB_C08_IMPLICIT_MEANING", title: "شرح الدلالة الضمنية", unitTitle: "الترم الأول", courseSequenceNumber: 8, lessonType: "reading", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_C09_TAA_MARBUTA", title: "الفرق بين التاء المربوطة والهاء والتاء المفتوحة", unitTitle: "الترم الأول", courseSequenceNumber: 9, lessonType: "spelling", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_SPELLING", branchTitle: "الإملاء", branchType: "course_track" },
    { nodeId: "ARB_C10_ARGUMENT_PARA", title: "كيفية كتابة فقرة حجاجية", unitTitle: "الترم الأول", courseSequenceNumber: 10, lessonType: "expression", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_C11_FIGURE", title: "الصورة الخيالية", unitTitle: "الترم الأول", courseSequenceNumber: 11, lessonType: "rhetoric", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_BALAGHA", branchTitle: "البلاغة", branchType: "course_track" },
    { nodeId: "ARB_C12_STORY1", title: "حكايات الغريب", author: "جمال الغيطاني", unitTitle: "من روائع الأدب العربي", courseSequenceNumber: 12, lessonType: "story", sourceLabel: "كتاب من روائع الأدب العربي - 2027", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_U1_L3", title: "العلم نور", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "3", courseSequenceNumber: 13, lessonType: "poetry", sourceLabel: "فهرس الدروس وكتاب الطالب", branchId: "ARB_TEXTS", branchTitle: "النصوص", branchType: "course_track" },
    { nodeId: "ARB_U2_L1", title: "التقنية وصناعة الرأي العام", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "1", courseSequenceNumber: 14, lessonType: "reading", sourceLabel: "فهرس الدروس وكتاب الطالب", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U2_N1", title: "الممنوع من الصرف وعلل منعه", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "1", courseSequenceNumber: 15, lessonType: "grammar", sourceLabel: "فهرس الدروس وكتاب الطالب", branchId: "ARB_NAHW", branchTitle: "النحو", branchType: "course_track" },
    { nodeId: "ARB_C16_STORY2", title: "عودة الروح", author: "توفيق الحكيم", unitTitle: "من روائع الأدب العربي", courseSequenceNumber: 16, lessonType: "story", sourceLabel: "كتاب من روائع الأدب العربي - 2027", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_C17_TEXT_DISCOURSE", title: "أنواع الخطاب في النص المعلوماتي", unitTitle: "الترم الأول", courseSequenceNumber: 17, lessonType: "reading", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_C18_IJAZ", title: "الإيجاز في البلاغة", unitTitle: "الترم الأول", courseSequenceNumber: 18, lessonType: "rhetoric", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_BALAGHA", branchTitle: "البلاغة", branchType: "course_track" },
    { nodeId: "ARB_C19_ITNAB", title: "الإطناب", unitTitle: "الترم الأول", courseSequenceNumber: 19, lessonType: "rhetoric", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_BALAGHA", branchTitle: "البلاغة", branchType: "course_track" },
    { nodeId: "ARB_SPELL_U2_MIDDLE_HAMZA", title: "رسم الهمزة المتوسطة", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "إملاء", lessonType: "spelling", note: "درس إملائي مستقل وارد ضمن الوحدة الثانية من كتاب الطالب، وليس مجرد تدريب تطبيقي.", sourceLabel: "كتاب الطالب - الجزء الأول، الوحدة الثانية", branchId: "ARB_SPELLING", branchTitle: "الإملاء", branchType: "course_track" },
    { nodeId: "ARB_C20_HAMZA", title: "همزة القطع وألف الوصل", unitTitle: "الترم الأول", courseSequenceNumber: 20, lessonType: "spelling", sourceLabel: "فهرس منصة الشرح", branchId: "ARB_SPELLING", branchTitle: "الإملاء", branchType: "course_track" },
    { nodeId: "ARB_U2_L2", title: "بين الذوق والعقل", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "2", courseSequenceNumber: 21, lessonType: "prose", sourceLabel: "فهرس الدروس وكتاب الطالب", branchId: "ARB_TEXTS", branchTitle: "النصوص", branchType: "course_track" },

    // Additional official textbook checkpoints remain available even when they are not in the 21-item course index.
    { nodeId: "ARB_U1_N2", title: "تابع الأسماء الخمسة", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "2", lessonType: "grammar", sourceLabel: "كتاب الطالب", branchId: "ARB_NAHW", branchTitle: "النحو", branchType: "course_track" },
    { nodeId: "ARB_U2_N2", title: "تابع الممنوع من الصرف وعلل منعه", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "2", lessonType: "grammar", sourceLabel: "كتاب الطالب", branchId: "ARB_NAHW", branchTitle: "النحو", branchType: "course_track" },
    { nodeId: "ARB_U3_N1", title: "النعت والبدل والتمييز بينهما", unitTitle: "الإنسان وكرامته", unitNumber: 3, lessonNumber: "1", lessonType: "grammar", sourceLabel: "كتاب الطالب", branchId: "ARB_NAHW", branchTitle: "النحو", branchType: "course_track" },
    { nodeId: "ARB_U3_N2", title: "العطف", unitTitle: "الإنسان وكرامته", unitNumber: 3, lessonNumber: "2", lessonType: "grammar", sourceLabel: "كتاب الطالب", branchId: "ARB_NAHW", branchTitle: "النحو", branchType: "course_track" },
    { nodeId: "ARB_U1_N3", title: "تطبيق على الأسماء الخمسة", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "3", lessonType: "grammar", sourceLabel: "كتاب الطالب - الجزء الأول", branchId: "ARB_NAHW", branchTitle: "النحو", branchType: "course_track" },
    { nodeId: "ARB_U2_N3", title: "تطبيق على الممنوع من الصرف وعلل منعه", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "3", lessonType: "grammar", sourceLabel: "كتاب الطالب - الجزء الأول", branchId: "ARB_NAHW", branchTitle: "النحو", branchType: "course_track" },
    { nodeId: "ARB_U2_L3", title: "أثر الكلمة وحفظ اللسان", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "3", lessonType: "poetry", sourceLabel: "كتاب الطالب", branchId: "ARB_TEXTS", branchTitle: "النصوص", branchType: "course_track" },
    { nodeId: "ARB_U3_L1", title: "حقوق الإنسان بين العالمية والخصوصية", unitTitle: "الإنسان وكرامته", unitNumber: 3, lessonNumber: "1", lessonType: "reading", sourceLabel: "كتاب الطالب", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U3_L2", title: "الحرية الفكرية", unitTitle: "الإنسان وكرامته", unitNumber: 3, lessonNumber: "2", lessonType: "reading", sourceLabel: "كتاب الطالب", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U3_L3", title: "يا أخي الإنسان", unitTitle: "الإنسان وكرامته", unitNumber: 3, lessonNumber: "3", lessonType: "poetry", sourceLabel: "كتاب الطالب", branchId: "ARB_TEXTS", branchTitle: "النصوص", branchType: "course_track" },

    // Part 2 — units 4–6, named textbook readings and poems.
    { nodeId: "ARB_U4_L1", title: "المرأة وبناء الدولة الحديثة", unitTitle: "بناء الوعي", unitNumber: 4, lessonNumber: "1", lessonType: "reading", sourceLabel: "كتاب الطالب - الجزء الثاني", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U4_L2", title: "مصر الحقيقة والمرأة المصرية", unitTitle: "بناء الوعي", unitNumber: 4, lessonNumber: "2", lessonType: "reading", sourceLabel: "كتاب الطالب - الجزء الثاني", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U4_L3", title: "أهواك يا وطني", unitTitle: "بناء الوعي", unitNumber: 4, lessonNumber: "3", lessonType: "poetry", sourceLabel: "كتاب الطالب - الجزء الثاني", branchId: "ARB_TEXTS", branchTitle: "النصوص", branchType: "course_track" },
    { nodeId: "ARB_U5_L1", title: "التفاوض: استراتيجية القيادة الواعية", unitTitle: "فن التفاوض والقيادة", unitNumber: 5, lessonNumber: "1", lessonType: "reading", sourceLabel: "كتاب الطالب - الجزء الثاني", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U5_L2", title: "القيادة أمانة وعدل", unitTitle: "فن التفاوض والقيادة", unitNumber: 5, lessonNumber: "2", lessonType: "reading", sourceLabel: "كتاب الطالب - الجزء الثاني", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U5_L3", title: "دعوة إلى السلام", unitTitle: "فن التفاوض والقيادة", unitNumber: 5, lessonNumber: "3", lessonType: "poetry", sourceLabel: "كتاب الطالب - الجزء الثاني", branchId: "ARB_TEXTS", branchTitle: "النصوص", branchType: "course_track" },
    { nodeId: "ARB_U6_L1", title: "المثقف في العصر الرقمي", unitTitle: "الثقافة أسلوب حياة", unitNumber: 6, lessonNumber: "1", lessonType: "reading", sourceLabel: "كتاب الطالب - الجزء الثاني", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U6_L2", title: "الثقافة أداة لا حلية", unitTitle: "الثقافة أسلوب حياة", unitNumber: 6, lessonNumber: "2", lessonType: "reading", sourceLabel: "كتاب الطالب - الجزء الثاني", branchId: "ARB_READING", branchTitle: "القراءة", branchType: "course_track" },
    { nodeId: "ARB_U6_L3", title: "غُربة وحنين", unitTitle: "الثقافة أسلوب حياة", unitNumber: 6, lessonNumber: "3", lessonType: "poetry", sourceLabel: "كتاب الطالب - الجزء الثاني", branchId: "ARB_TEXTS", branchTitle: "النصوص", branchType: "course_track" },

    // Additional writing checkpoints extracted from embedded Ministry textbook tasks.
    { nodeId: "ARB_EXP_U1_POSITION_WRITE", title: "كتابة موقف نقدي موجز", unitTitle: "تطبيقات التعبير من الكتاب", lessonType: "expression", note: "تطبيق كتابي مدمج في كتاب الطالب، الجزء الأول، ص20؛ ليس درسًا وزاريًا مستقلًا.", sourceLabel: "كتاب الطالب - الجزء الأول، ص20", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U1_INFO_PARAGRAPH", title: "كتابة فقرة معلوماتية", unitTitle: "تطبيقات التعبير من الكتاب", lessonType: "expression", note: "نشاط كتابة فقرة معلوماتية عن مسؤولية العلم، الجزء الأول، ص21.", sourceLabel: "كتاب الطالب - الجزء الأول، ص21", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U1_INTERVIEW", title: "إعداد مقابلة قصيرة", unitTitle: "تطبيقات التعبير من الكتاب", lessonType: "expression", note: "نشاط محاكاة مقابلة قصيرة مع عالم، الجزء الأول، ص22.", sourceLabel: "كتاب الطالب - الجزء الأول، ص22", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U1_CRITICAL_PARAGRAPH", title: "كتابة فقرة نقدية", unitTitle: "تطبيقات التعبير من الكتاب", lessonType: "expression", note: "نشاط كتابة فقرة نقدية من 8 إلى 10 أسطر، الجزء الأول، ص36.", sourceLabel: "كتاب الطالب - الجزء الأول، ص36", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U1_OPINION_PARAGRAPH", title: "كتابة فقرة رأي", unitTitle: "تطبيقات التعبير من الكتاب", lessonType: "expression", note: "نشاط فقرة رأي بعنوان متى يصبح العلم سببًا لنهضة الأمة، الجزء الأول، ص49.", sourceLabel: "كتاب الطالب - الجزء الأول، ص49", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U1_SHORT_POSITION", title: "كتابة موقف شخصي موجز", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "تطبيق", lessonType: "expression", note: "نشاط كتابة موقف شخصي في خمسة أسطر حول قضية الدرس، الجزء الأول، ص35.", sourceLabel: "كتاب الطالب - الجزء الأول، ص35", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U1_DIALOGUE", title: "إعداد حوار حول العلم والضمير", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "تطبيق", lessonType: "expression", note: "نشاط إعداد حوار قصير يعكس العلاقة بين العلم والضمير، الجزء الأول، ص51.", sourceLabel: "كتاب الطالب - الجزء الأول، ص51", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U2_SHORT_STORY", title: "كتابة مشهد سردي موجز", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "تطبيق", lessonType: "expression", note: "مشهد سردي من ستة إلى ثمانية أسطر عن طالب واجه موقفًا صعبًا بعد خطأ ثم اكتشف الحقيقة، الجزء الأول، ص70.", sourceLabel: "كتاب الطالب - الجزء الأول، ص70", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U2_SUMMARY_REWRITE", title: "إعادة صياغة فقرة بإيجاز", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "تطبيق", lessonType: "expression", note: "إعادة صياغة فقرة في سطر واحد مع الحفاظ على المعنى الأساسي، الجزء الأول، ص70.", sourceLabel: "كتاب الطالب - الجزء الأول، ص70", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U2_POSITION", title: "كتابة موقف نقدي عن الذوق والنظام", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "تطبيق", lessonType: "expression", note: "نشاط كتابة موقف شخصي في أربعة أسطر حول احترام النظام والعدل، الجزء الأول، ص83.", sourceLabel: "كتاب الطالب - الجزء الأول، ص83", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U2_ORAL_PRESENTATION", title: "عرض شفهي منظم عن الذوق الرفيع", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "نشاط تحدث", lessonType: "expression", note: "نشاط تحدث شفهي لمدة دقيقة حول تهذيب السلوك الإنساني، الجزء الأول، ص84.", sourceLabel: "كتاب الطالب - الجزء الأول، ص84", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },
    { nodeId: "ARB_EXP_U2_ANALYTICAL_PARAGRAPH", title: "كتابة فقرة قراءة تحليلية قصيرة", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "تطبيق", lessonType: "expression", note: "فقرة تحليلية من ثمانية إلى عشرة أسطر حول الفكرة الرئيسة وطريقة عرض الكاتب ومراحلها وأثر السلوك في المجتمع، الجزء الأول، ص85.", sourceLabel: "كتاب الطالب - الجزء الأول، ص85", branchId: "ARB_EXPRESSION", branchTitle: "التعبير", branchType: "course_track" },

    // Spelling applications are kept distinct from the underlying lesson title.
    { nodeId: "ARB_SPELL_U1_HAMZA_PRACTICE", title: "تطبيقات على كتابة الهمزة", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "تطبيق", lessonType: "spelling", note: "تطبيق كتابي على تعليل كتابة الهمزة في كلمات مختارة، الجزء الأول، ص70؛ مع الحفاظ على معرف التقدم التاريخي.", sourceLabel: "كتاب الطالب - الجزء الأول، ص70", branchId: "ARB_SPELLING", branchTitle: "الإملاء", branchType: "course_track" },
    { nodeId: "ARB_SPELL_U1_TAA_MARBUTA", title: "تطبيقات التاء المربوطة والهاء", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "تطبيق", lessonType: "spelling", note: "تطبيقات على الكتابة الصحيحة وسبب كتابة كلمة «قوة» بالتاء المربوطة، الجزء الأول، ص22.", sourceLabel: "كتاب الطالب - الجزء الأول، ص22", branchId: "ARB_SPELLING", branchTitle: "الإملاء", branchType: "course_track" },
    { nodeId: "ARB_SPELL_U1_CORRECT_WRITING", title: "تصويب الكتابة الإملائية", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "تطبيق", lessonType: "spelling", note: "اختيار الكتابة الصحيحة وتعليل كتابة كلمات من نص الوحدة، الجزء الأول، ص39.", sourceLabel: "كتاب الطالب - الجزء الأول، ص39", branchId: "ARB_SPELLING", branchTitle: "الإملاء", branchType: "course_track" },
    { nodeId: "ARB_SPELL_U1_TAA_TYPES", title: "تمييز أنواع التاء وتصويب الكلمات", unitTitle: "العلم والضمير", unitNumber: 1, lessonNumber: "تطبيق", lessonType: "spelling", note: "تطبيق على التمييز بين أنواع التاء وتصويب أخطاء كتابية، الجزء الأول، ص51.", sourceLabel: "كتاب الطالب - الجزء الأول، ص51", branchId: "ARB_SPELLING", branchTitle: "الإملاء", branchType: "course_track" },
    { nodeId: "ARB_SPELL_U2_HAMZA_CORRECTION", title: "تصويب الهمزة وكتابة الكلمات", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "تطبيق", lessonType: "spelling", note: "تعليل كتابة الهمزة وتصويب كلمات مختارة، الجزء الأول، ص70.", sourceLabel: "كتاب الطالب - الجزء الأول، ص70", branchId: "ARB_SPELLING", branchTitle: "الإملاء", branchType: "course_track" },
    { nodeId: "ARB_SPELL_U2_ORTHOGRAPHY_REVIEW", title: "تطبيقات الاختيار والتصويب الإملائي", unitTitle: "سلطان الكلمة الرقمية", unitNumber: 2, lessonNumber: "تطبيق", lessonType: "spelling", note: "اختيار الكتابة الصحيحة وتعليل الهمزة وتصويب الكلمات، الجزء الأول، ص87.", sourceLabel: "كتاب الطالب - الجزء الأول، ص87", branchId: "ARB_SPELLING", branchTitle: "الإملاء", branchType: "course_track" },

    // Complete the independent story book: ten works in total.
    { nodeId: "ARB_C22_STORY3", title: "كفاح طيبة", author: "نجيب محفوظ", unitTitle: "من روائع الأدب العربي", courseSequenceNumber: 22, lessonType: "story", sourceLabel: "كتاب من روائع الأدب العربي - 2027", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_C23_STORY4", title: "الأرض", author: "عبد الرحمن الشرقاوي", unitTitle: "من روائع الأدب العربي", courseSequenceNumber: 23, lessonType: "story", sourceLabel: "كتاب من روائع الأدب العربي - 2027", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_C24_STORY5", title: "شمس وليل", author: "محمود تيمور", unitTitle: "من روائع الأدب العربي", courseSequenceNumber: 24, lessonType: "story", sourceLabel: "كتاب من روائع الأدب العربي - 2027", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_C25_STORY6", title: "العبرات", author: "مصطفى لطفي المنفلوطي", unitTitle: "من روائع الأدب العربي", courseSequenceNumber: 25, lessonType: "story", sourceLabel: "كتاب من روائع الأدب العربي - 2027", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_C26_STORY7", title: "وا إسلاماه", author: "علي أحمد باكثير", unitTitle: "من روائع الأدب العربي", courseSequenceNumber: 26, lessonType: "story", sourceLabel: "كتاب من روائع الأدب العربي - 2027", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_C27_STORY8", title: "عبقرية عمر", author: "عباس محمود العقاد", unitTitle: "من روائع الأدب العربي", courseSequenceNumber: 27, lessonType: "story", sourceLabel: "كتاب من روائع الأدب العربي - 2027", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_C28_STORY9", title: "رجل تحت الصفر", author: "مصطفى محمود", unitTitle: "من روائع الأدب العربي", courseSequenceNumber: 28, lessonType: "story", sourceLabel: "كتاب من روائع الأدب العربي - 2027", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_C29_STORY10", title: "صح النوم", author: "يحيى حقي", unitTitle: "من روائع الأدب العربي", courseSequenceNumber: 29, lessonType: "story", sourceLabel: "كتاب من روائع الأدب العربي - 2027", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_LITERATURE_CRITICISM_TERMS", title: "مصطلحات النقد الأدبي", unitTitle: "من روائع الأدب العربي", lessonType: "topic", note: "قسم المصطلحات النقدية المشار إليه في وصف بنية كتاب القصة لعام 2027؛ العناوين التفصيلية تحتاج مطابقة نسخة الكتاب.", sourceLabel: "كتاب من روائع الأدب العربي - 2027، قسم المصطلحات النقدية", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
    { nodeId: "ARB_LITERATURE_GENERAL_EXERCISES", title: "التدريبات العامة على الأعمال الأدبية", unitTitle: "من روائع الأدب العربي", lessonType: "topic", note: "قسم تدريبات عامة مرتبط بالأعمال الأدبية؛ تُستكمل عناوين التدريبات من نسخة الكتاب عند توفرها.", sourceLabel: "كتاب من روائع الأدب العربي - 2027، قسم التدريبات العامة", branchId: "ARB_LITERATURE", branchTitle: "الأدب والقصة", branchType: "course_track" },
  ],
  ENG1_G2_BAC: [
    { nodeId: "ENG_U1_SEC_A_T1", title: "Social Media and Self-Image", unitTitle: "Living Well in a Complex World", unitNumber: 1, lessonNumber: "1.1", lessonType: "topic" },
    { nodeId: "ENG_U1_SEC_A_T2", title: "Exploring Modern Lifestyles", unitTitle: "Living Well in a Complex World", unitNumber: 1, lessonNumber: "1.2", lessonType: "topic" },
    { nodeId: "ENG_U1_SEC_B_T1", title: "Whose Responsibility Is It?", unitTitle: "Living Well in a Complex World", unitNumber: 1, lessonNumber: "1.3", lessonType: "topic" },
    { nodeId: "ENG_U1_SEC_B_T2", title: "Understanding Mental Health", unitTitle: "Living Well in a Complex World", unitNumber: 1, lessonNumber: "1.4", lessonType: "topic" },

    { nodeId: "ENG_U2_SEC_A_T1", title: "Screen Time and Young People", unitTitle: "Leisure Time", unitNumber: 2, lessonNumber: "2.1", lessonType: "topic" },
    { nodeId: "ENG_U2_SEC_A_T2", title: "Creative Arts as Leisure Activities", unitTitle: "Leisure Time", unitNumber: 2, lessonNumber: "2.2", lessonType: "topic" },
    { nodeId: "ENG_U2_SEC_B_T1", title: "Sport and Physical Activity as Leisure", unitTitle: "Leisure Time", unitNumber: 2, lessonNumber: "2.3", lessonType: "topic" },
    { nodeId: "ENG_U2_SEC_B_T2", title: "Not Exactly a Relaxing Day", unitTitle: "Leisure Time", unitNumber: 2, lessonNumber: "2.4", lessonType: "topic" },

    { nodeId: "ENG_U3_SEC_A_T1", title: "Sites of Memory", unitTitle: "Echoes of the Past", unitNumber: 3, lessonNumber: "3.1", lessonType: "topic" },
    { nodeId: "ENG_U3_SEC_A_T2", title: "The Museum as a Storyteller", unitTitle: "Echoes of the Past", unitNumber: 3, lessonNumber: "3.2", lessonType: "topic" },
    { nodeId: "ENG_U3_SEC_B_T1", title: "The Viral Past", unitTitle: "Echoes of the Past", unitNumber: 3, lessonNumber: "3.3", lessonType: "topic" },
    { nodeId: "ENG_U3_SEC_B_T2", title: "Social Media and Historical Events", unitTitle: "Echoes of the Past", unitNumber: 3, lessonNumber: "3.4", lessonType: "topic" },

    { nodeId: "ENG_U4_SEC_A_T1", title: "Food Waste", unitTitle: "The Power of Choice", unitNumber: 4, lessonNumber: "4.1", lessonType: "topic" },
    { nodeId: "ENG_U4_SEC_A_T2", title: "Beyond the Brand", unitTitle: "The Power of Choice", unitNumber: 4, lessonNumber: "4.2", lessonType: "topic" },
    { nodeId: "ENG_U4_SEC_B_T1", title: "Digital Consumption", unitTitle: "The Power of Choice", unitNumber: 4, lessonNumber: "4.3", lessonType: "topic" },
    { nodeId: "ENG_U4_SEC_B_T2", title: "Black Friday and Sales Culture", unitTitle: "The Power of Choice", unitNumber: 4, lessonNumber: "4.4", lessonType: "topic" },

    { nodeId: "ENG_U5_SEC_A_T1", title: "The Climate Crisis", unitTitle: "The Greenhouse Effect", unitNumber: 5, lessonNumber: "5.1", lessonType: "topic" },
    { nodeId: "ENG_U5_SEC_A_T2", title: "Renewable Energy – Powering a Sustainable Future", unitTitle: "The Greenhouse Effect", unitNumber: 5, lessonNumber: "5.2", lessonType: "topic" },
    { nodeId: "ENG_U5_SEC_B_T1", title: "Greening Projects in Egypt", unitTitle: "The Greenhouse Effect", unitNumber: 5, lessonNumber: "5.3", lessonType: "topic" },
    { nodeId: "ENG_U5_SEC_B_T2", title: "Individual and Collective Actions", unitTitle: "The Greenhouse Effect", unitNumber: 5, lessonNumber: "5.4", lessonType: "topic" },

    // Part 2 — units 6–10, complete 40-topic textbook catalog.
    { nodeId: "ENG_U6_SEC_A_T1", title: "A World We Borrow", unitTitle: "The Space We Share", unitNumber: 6, lessonNumber: "6.1", lessonType: "topic" },
    { nodeId: "ENG_U6_SEC_A_T2", title: "When Needs Compete", unitTitle: "The Space We Share", unitNumber: 6, lessonNumber: "6.2", lessonType: "topic" },
    { nodeId: "ENG_U6_SEC_B_T1", title: "Voices for the Voiceless", unitTitle: "The Space We Share", unitNumber: 6, lessonNumber: "6.3", lessonType: "topic" },
    { nodeId: "ENG_U6_SEC_B_T2", title: "Global Citizens, Local Actions", unitTitle: "The Space We Share", unitNumber: 6, lessonNumber: "6.4", lessonType: "topic" },
    { nodeId: "ENG_U7_SEC_A_T1", title: "From Hobby to Opportunity", unitTitle: "Discovering Your Passion", unitNumber: 7, lessonNumber: "7.1", lessonType: "topic" },
    { nodeId: "ENG_U7_SEC_A_T2", title: "Building a Community Around Your Passion", unitTitle: "Discovering Your Passion", unitNumber: 7, lessonNumber: "7.2", lessonType: "topic" },
    { nodeId: "ENG_U7_SEC_B_T1", title: "Leaving Your Mark", unitTitle: "Discovering Your Passion", unitNumber: 7, lessonNumber: "7.3", lessonType: "topic" },
    { nodeId: "ENG_U7_SEC_B_T2", title: "Time Well Spent: Balancing Passion and Priorities", unitTitle: "Discovering Your Passion", unitNumber: 7, lessonNumber: "7.4", lessonType: "topic" },
    { nodeId: "ENG_U8_SEC_A_T1", title: "Vocational Education in Egypt", unitTitle: "Pathways to Progress", unitNumber: 8, lessonNumber: "8.1", lessonType: "topic" },
    { nodeId: "ENG_U8_SEC_A_T2", title: "International Vocational Voices Online", unitTitle: "Pathways to Progress", unitNumber: 8, lessonNumber: "8.2", lessonType: "topic" },
    { nodeId: "ENG_U8_SEC_B_T1", title: "The Egyptian-Japanese Schools (EJS)", unitTitle: "Pathways to Progress", unitNumber: 8, lessonNumber: "8.3", lessonType: "topic" },
    { nodeId: "ENG_U8_SEC_B_T2", title: "The Skills Employers Really Want", unitTitle: "Pathways to Progress", unitNumber: 8, lessonNumber: "8.4", lessonType: "topic" },
    { nodeId: "ENG_U9_SEC_A_T1", title: "Finding My Place", unitTitle: "Circles of Belonging", unitNumber: 9, lessonNumber: "9.1", lessonType: "topic" },
    { nodeId: "ENG_U9_SEC_A_T2", title: "Relationships That Help Us Grow", unitTitle: "Circles of Belonging", unitNumber: 9, lessonNumber: "9.2", lessonType: "topic" },
    { nodeId: "ENG_U9_SEC_B_T1", title: "No One Left Behind", unitTitle: "Circles of Belonging", unitNumber: 9, lessonNumber: "9.3", lessonType: "topic" },
    { nodeId: "ENG_U9_SEC_B_T2", title: "Community That Cares", unitTitle: "Circles of Belonging", unitNumber: 9, lessonNumber: "9.4", lessonType: "topic" },
    { nodeId: "ENG_U10_SEC_A_T1", title: "Hidden Cost of a Click", unitTitle: "Behind the Buy", unitNumber: 10, lessonNumber: "10.1", lessonType: "topic" },
    { nodeId: "ENG_U10_SEC_A_T2", title: "Chasing Validation", unitTitle: "Behind the Buy", unitNumber: 10, lessonNumber: "10.2", lessonType: "topic" },
    { nodeId: "ENG_U10_SEC_B_T1", title: "True Price of Fast Fashion", unitTitle: "Behind the Buy", unitNumber: 10, lessonNumber: "10.3", lessonType: "topic" },
    { nodeId: "ENG_U10_SEC_B_T2", title: "Rethinking What We Buy: A Community Response", unitTitle: "Behind the Buy", unitNumber: 10, lessonNumber: "10.4", lessonType: "topic" },

    // Separate official story book, not mixed with textbook topics or teacher course streams.
    { nodeId: "ENG_LOST_WORLD_CH1", title: "A Dream of Adventure", unitTitle: "The Lost World", lessonNumber: "1", lessonType: "story", sourceLabel: "كتاب القصة المقرر", branchId: "ENG_STORY", branchTitle: "القصة - The Lost World", branchType: "course_track" },
    { nodeId: "ENG_LOST_WORLD_CH2", title: "Professor Challenger’s Secret", unitTitle: "The Lost World", lessonNumber: "2", lessonType: "story", sourceLabel: "كتاب القصة المقرر", branchId: "ENG_STORY", branchTitle: "القصة - The Lost World", branchType: "course_track" },
    { nodeId: "ENG_LOST_WORLD_CH3", title: "The Expedition Is Chosen", unitTitle: "The Lost World", lessonNumber: "3", lessonType: "story", sourceLabel: "كتاب القصة المقرر", branchId: "ENG_STORY", branchTitle: "القصة - The Lost World", branchType: "course_track" },
    { nodeId: "ENG_LOST_WORLD_CH4", title: "Into the Unknown", unitTitle: "The Lost World", lessonNumber: "4", lessonType: "story", sourceLabel: "كتاب القصة المقرر", branchId: "ENG_STORY", branchTitle: "القصة - The Lost World", branchType: "course_track" },
    { nodeId: "ENG_LOST_WORLD_CH5", title: "Trapped in the Lost World", unitTitle: "The Lost World", lessonNumber: "5", lessonType: "story", sourceLabel: "كتاب القصة المقرر", branchId: "ENG_STORY", branchTitle: "القصة - The Lost World", branchType: "course_track" },
    { nodeId: "ENG_LOST_WORLD_CH6", title: "Malone’s Night Adventure", unitTitle: "The Lost World", lessonNumber: "6", lessonType: "story", sourceLabel: "كتاب القصة المقرر", branchId: "ENG_STORY", branchTitle: "القصة - The Lost World", branchType: "course_track" },
    { nodeId: "ENG_LOST_WORLD_CH7", title: "Prisoners of the Ape-Men", unitTitle: "The Lost World", lessonNumber: "7", lessonType: "story", sourceLabel: "كتاب القصة المقرر", branchId: "ENG_STORY", branchTitle: "القصة - The Lost World", branchType: "course_track" },
    { nodeId: "ENG_LOST_WORLD_CH8", title: "The Battle for the Plateau", unitTitle: "The Lost World", lessonNumber: "8", lessonType: "story", sourceLabel: "كتاب القصة المقرر", branchId: "ENG_STORY", branchTitle: "القصة - The Lost World", branchType: "course_track" },
    { nodeId: "ENG_LOST_WORLD_CH9", title: "The Hidden Way Home", unitTitle: "The Lost World", lessonNumber: "9", lessonType: "story", sourceLabel: "كتاب القصة المقرر", branchId: "ENG_STORY", branchTitle: "القصة - The Lost World", branchType: "course_track" },
    { nodeId: "ENG_LOST_WORLD_CH10", title: "Proof Before the World", unitTitle: "The Lost World", lessonNumber: "10", lessonType: "story", sourceLabel: "كتاب القصة المقرر", branchId: "ENG_STORY", branchTitle: "القصة - The Lost World", branchType: "course_track" },
  ],
  HIS_G2_BAC: [
    { nodeId: "HIS_U1_L1", title: "بناء الدولة المصرية واستمرارها عبر التاريخ", unitTitle: "مصر بين الماضي والحاضر", unitNumber: 1, lessonNumber: "1.1", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U1_L2", title: "الدولة المصرية القديمة ومقاومة الاحتلال", unitTitle: "مصر بين الماضي والحاضر", unitNumber: 1, lessonNumber: "1.2", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U1_L3", title: "التحولات الكبرى في مصر (العصر الوسيط)", unitTitle: "مصر بين الماضي والحاضر", unitNumber: 1, lessonNumber: "1.3", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U1_L4", title: "التحولات الكبرى في مصر (العصر الحديث)", unitTitle: "مصر بين الماضي والحاضر", unitNumber: 1, lessonNumber: "1.4", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U2_L1", title: "سياسات الاحتلال بمصر في العصر الحديث", unitTitle: "تحولات القوة وبناء الوعي بمصر في العصر الحديث والمعاصر", unitNumber: 2, lessonNumber: "2.1", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U2_L2", title: "صمود الشعب المصري ومقاومة الاحتلال", unitTitle: "تحولات القوة وبناء الوعي بمصر في العصر الحديث والمعاصر", unitNumber: 2, lessonNumber: "2.2", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U2_L3", title: "ثورة 23 يوليو والتحولات الكبرى في مصر", unitTitle: "تحولات القوة وبناء الوعي بمصر في العصر الحديث والمعاصر", unitNumber: 2, lessonNumber: "2.3", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U2_L4", title: "الهوية الوطنية في مواجهة الاستعمار الجديد", unitTitle: "تحولات القوة وبناء الوعي بمصر في العصر الحديث والمعاصر", unitNumber: 2, lessonNumber: "2.4", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U3_L1", title: "حركات التحرر الوطني ضد الاحتلال الفرنسي والإيطالي في العالم العربي", unitTitle: "مصر وقضايا التحرر الوطني في الوطن العربي وإفريقيا", unitNumber: 3, lessonNumber: "3.1", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U3_L2", title: "حركات التحرر الوطني ضد الاحتلال البريطاني والإسباني في العالم العربي", unitTitle: "مصر وقضايا التحرر الوطني في الوطن العربي وإفريقيا", unitNumber: 3, lessonNumber: "3.2", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U3_L3", title: "مرتكزات الدور المصري إقليميًا ودوليًا", unitTitle: "مصر وقضايا التحرر الوطني في الوطن العربي وإفريقيا", unitNumber: 3, lessonNumber: "3.3", sourceLabel: "كتاب التاريخ - الجزء الأول" },
    { nodeId: "HIS_U3_L4", title: "دور مصر في دعم حركات التحرر الوطني", unitTitle: "مصر وقضايا التحرر الوطني في الوطن العربي وإفريقيا", unitNumber: 3, lessonNumber: "3.4", sourceLabel: "كتاب التاريخ - الجزء الأول" },

    // Part 2 — units 4–6; one linear course sequence, with unit metadata preserved.
    { nodeId: "HIS_U4_L1", title: "مقدمات الحرب العالمية الأولى", unitTitle: "الحرب العالمية الأولى والثانية وتحولات النظام الدولي", unitNumber: 4, lessonNumber: "4.1", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U4_L2", title: "الحرب العالمية الأولى: المعارك الكبرى", unitTitle: "الحرب العالمية الأولى والثانية وتحولات النظام الدولي", unitNumber: 4, lessonNumber: "4.2", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U4_L3", title: "مقدمات الحرب العالمية الثانية", unitTitle: "الحرب العالمية الأولى والثانية وتحولات النظام الدولي", unitNumber: 4, lessonNumber: "4.3", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U4_L4", title: "من الحرب العالمية الثانية إلى الحرب الباردة", unitTitle: "الحرب العالمية الأولى والثانية وتحولات النظام الدولي", unitNumber: 4, lessonNumber: "4.4", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U5_L1", title: "القضية الفلسطينية والتحولات الدولية حتى عام 1948م", unitTitle: "مصر والقضية الفلسطينية", unitNumber: 5, lessonNumber: "5.1", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U5_L2", title: "مصر والصراع العربي الإسرائيلي", unitTitle: "مصر والقضية الفلسطينية", unitNumber: 5, lessonNumber: "5.2", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U5_L3", title: "حرب أكتوبر 1973م (ملحمة العبور والنصر)", unitTitle: "مصر والقضية الفلسطينية", unitNumber: 5, lessonNumber: "5.3", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U5_L4", title: "مصر والقضية الفلسطينية بعد حرب أكتوبر 1973م", unitTitle: "مصر والقضية الفلسطينية", unitNumber: 5, lessonNumber: "5.4", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U6_L1", title: "مفهوم السلام العالمي وتطوره", unitTitle: "السلام العالمي بين الواقع والمأمول", unitNumber: 6, lessonNumber: "6.1", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U6_L2", title: "تحديات تحقيق السلام العالمي", unitTitle: "السلام العالمي بين الواقع والمأمول", unitNumber: 6, lessonNumber: "6.2", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U6_L3", title: "المنظمات الدولية والإقليمية ودورها في حفظ السلام العالمي", unitTitle: "السلام العالمي بين الواقع والمأمول", unitNumber: 6, lessonNumber: "6.3", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
    { nodeId: "HIS_U6_L4", title: "دور مصر في دعم السلام العالمي", unitTitle: "السلام العالمي بين الواقع والمأمول", unitNumber: 6, lessonNumber: "6.4", sourceLabel: "كتاب التاريخ - الجزء الثاني" },
  ],
  PROG_AI_G2_BAC: [
    { nodeId: "PROG_1_1", title: "تطور تكنولوجيا المعلومات والتحول الاجتماعي", unitTitle: "تكنولوجيا المعلومات والمجتمع", unitNumber: 1, lessonNumber: "1.1", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_1_2", title: "كيف يعمل الذكاء الاصطناعي", unitTitle: "تكنولوجيا المعلومات والمجتمع", unitNumber: 1, lessonNumber: "1.2", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_1_3", title: "الذكاء الاصطناعي في الحياة اليومية والصناعة", unitTitle: "تكنولوجيا المعلومات والمجتمع", unitNumber: 1, lessonNumber: "1.3", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_1_4", title: "القضايا الأخلاقية للذكاء الاصطناعي", unitTitle: "تكنولوجيا المعلومات والمجتمع", unitNumber: 1, lessonNumber: "1.4", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_2_1", title: "تقنيات التشفير والمصادقة", unitTitle: "الأمن السيبراني", unitNumber: 2, lessonNumber: "2.1", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_2_2", title: "تصميم أمن الشبكات", unitTitle: "الأمن السيبراني", unitNumber: 2, lessonNumber: "2.2", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_2_3", title: "الاستجابة للحوادث وإدارة المخاطر", unitTitle: "الأمن السيبراني", unitNumber: 2, lessonNumber: "2.3", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_3_1", title: "البنية العامة لتطبيقات الويب", unitTitle: "تطبيقات الويب", unitNumber: 3, lessonNumber: "3.1", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_3_2", title: "طرق الاتصال في تطبيقات الويب", unitTitle: "تطبيقات الويب", unitNumber: 3, lessonNumber: "3.2", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_3_3", title: "أساسيات تكنولوجيا الواجهة الأمامية", unitTitle: "تطبيقات الويب", unitNumber: 3, lessonNumber: "3.3", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_4_1", title: "أنواع الوسائط وخصائصها", unitTitle: "تصميم الويب والوسائط", unitNumber: 4, lessonNumber: "4.1", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_4_2", title: "تصميم المعلومات وتجربة المستخدم للمواقع", unitTitle: "تصميم الويب والوسائط", unitNumber: 4, lessonNumber: "4.2", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_4_3", title: "أساليب تقييم المواقع الإلكترونية", unitTitle: "تصميم الويب والوسائط", unitNumber: 4, lessonNumber: "4.3", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_4_4", title: "عملية التحسين التكراري للمواقع", unitTitle: "تصميم الويب والوسائط", unitNumber: 4, lessonNumber: "4.4", sourceLabel: "كتاب البرمجة - الجزء 1" },
    { nodeId: "PROG_5_1", title: "طرق جمع البيانات", unitTitle: "جمع البيانات وتنقيتها", unitNumber: 5, lessonNumber: "5.1", sourceLabel: "كتاب البرمجة - الجزء 2" },
    { nodeId: "PROG_5_2", title: "تنقية البيانات وتحويلها", unitTitle: "جمع البيانات وتنقيتها", unitNumber: 5, lessonNumber: "5.2", sourceLabel: "كتاب البرمجة - الجزء 2" },
    { nodeId: "PROG_5_3", title: "البيانات المفتوحة وواجهات برمجة التطبيقات", unitTitle: "جمع البيانات وتنقيتها", unitNumber: 5, lessonNumber: "5.3", sourceLabel: "كتاب البرمجة - الجزء 2" },
    { nodeId: "PROG_6_1", title: "الاستدلال الإحصائي", unitTitle: "التحليل والتواصل", unitNumber: 6, lessonNumber: "6.1", sourceLabel: "كتاب البرمجة - الجزء 2" },
    { nodeId: "PROG_6_2", title: "استخدام تحليل الانحدار وتقييمه", unitTitle: "التحليل والتواصل", unitNumber: 6, lessonNumber: "6.2", sourceLabel: "كتاب البرمجة - الجزء 2" },
    { nodeId: "PROG_6_3", title: "تمثيل البيانات المرئي والتواصل", unitTitle: "التحليل والتواصل", unitNumber: 6, lessonNumber: "6.3", sourceLabel: "كتاب البرمجة - الجزء 2" },
    { nodeId: "PROG_7_1", title: "أساسيات التعلم الآلي", unitTitle: "التعلم الآلي والذكاء الاصطناعي", unitNumber: 7, lessonNumber: "7.1", sourceLabel: "كتاب البرمجة - الجزء 2" },
    { nodeId: "PROG_7_2", title: "الشبكات العصبية والتعلم العميق", unitTitle: "التعلم الآلي والذكاء الاصطناعي", unitNumber: 7, lessonNumber: "7.2", sourceLabel: "كتاب البرمجة - الجزء 2" },
    { nodeId: "PROG_7_3", title: "نماذج اللغة الكبيرة والذكاء الاصطناعي التوليدي", unitTitle: "التعلم الآلي والذكاء الاصطناعي", unitNumber: 7, lessonNumber: "7.3", sourceLabel: "كتاب البرمجة - الجزء 2" },
  ],
};

const SIE_CHECKPOINT_CHOICES_WITH_BRANCH: Record<string, SIECheckpointChoice[]> =
  Object.fromEntries(Object.entries(SIE_CHECKPOINT_CHOICES).map(([subjectId, choices]) => [
    subjectId,
    choices.map(choice => ({ ...choice, ...getOfficialBranch(subjectId, choice) })),
  ]));

/** كل الاختيارات من فهرس الوزارة، ومرفق بها فرعها الرسمي. */
export function getSIECheckpointChoices(subjectId: string): SIECheckpointChoice[] {
  return SIE_CHECKPOINT_CHOICES_WITH_BRANCH[subjectId] ?? [];
}

/** Display metadata needed to identify a checkpoint without hiding its number, type or branch. */
export function getSIECheckpointChoiceTypeLabel(choice: SIECheckpointChoice): string {
  switch (choice.lessonType) {
    case "reading": return "قراءة";
    case "poetry": return "نص شعري";
    case "grammar": return "قواعد (Grammar)";
    case "vocabulary": return "مفردات (Vocabulary)";
    case "rhetoric": return "بلاغة";
    case "prose": return "نص نثري";
    case "expression": return "تعبير";
    case "spelling": return "إملاء";
    case "story": return "قصة";
    case "topic": return "موضوع (Topic)";
    default: return "درس";
  }
}

function getSIECheckpointSequenceLabel(choice: SIECheckpointChoice): string {
  const sequence = choice.lessonNumber?.trim();
  if (!sequence) return "";
  if (/^\d+(?:\.\d+)?$/.test(sequence)) {
    if (choice.lessonType === "topic") return `Lesson ${sequence}`;
    if (choice.lessonType === "grammar") return `قاعدة نحوية ${sequence}`;
    return `الدرس ${sequence}`;
  }
  if (sequence === "تطبيق") {
    return choice.lessonType === "spelling" ? "تطبيق إملائي" : "تطبيق كتابي";
  }
  return sequence;
}

function getSIECheckpointProgressDescription(choice: SIECheckpointChoice): string {
  const unit = choice.unitNumber
    ? `الوحدة ${choice.unitNumber}: ${choice.unitTitle || ""}`
    : choice.unitTitle || "";
  const source = choice.sourceLabel || "";
  const sourcePage = source.match(/ص\s*\d+/)?.[0];
  const sourceLabel = source.includes("فهرس منصة الشرح")
    ? "كورس المدرس"
    : source.includes("كتاب الطالب")
      ? ["كتاب الطالب", sourcePage].filter(Boolean).join(" · ")
      : source;
  return [unit, getSIECheckpointSequenceLabel(choice), sourceLabel].filter(Boolean).join(" · ");
}

export function getSIECheckpointChoiceDisplayLabel(choice: SIECheckpointChoice): string {
  // Values such as "تطبيق" are activity types, not lesson numbers.
  const lessonNumber = getSIECheckpointSequenceLabel(choice);
  const unit = choice.unitNumber
    ? choice.lessonType === "topic" ? `Unit ${choice.unitNumber}: ${choice.unitTitle}` : `الوحدة ${choice.unitNumber}: ${choice.unitTitle}`
    : choice.unitTitle;
  return [lessonNumber, choice.title, choice.author ? "المؤلف: " + choice.author : "",
    choice.note ?? "", `النوع: ${getSIECheckpointChoiceTypeLabel(choice)}`,
    `الفرع: ${choice.branchTitle ?? choice.unitTitle}`, unit,
    choice.sourceLabel ? `المصدر: ${choice.sourceLabel}` : ""].filter(Boolean).join(" · ");
}

/** يعيد فروع المنهج مع إبقاء كل مسار تقدم مستقلاً. */
export function getSIECheckpointBranches(subjectId: string): SIECheckpointBranch[] {
  const choices = getSIECheckpointChoices(subjectId);

  // History and Programming are single sequential curricula, not separate
  // progress branches for every textbook unit/chapter.
  if (subjectId === "HIS_G2_BAC" || subjectId === "PROG_AI_G2_BAC") {
    const branchId = `${subjectId}:FULL`;
    return [{
      branchId,
      branchTitle: "المقرر بالكامل",
      branchType: "course_track",
      choices: choices.map(choice => ({
        ...choice,
        branchId,
        branchTitle: "المقرر بالكامل",
        branchType: "course_track",
      })),
    }];
  }

  // English keeps distinct Vocabulary and Grammar tracking views grouped by
  // the ten textbook units, the official textbook topics, and the story book.
  // GRE is supplemental and is never represented as a Ministry textbook unit.
  if (subjectId === "ENG1_G2_BAC") {
    const textbookBranchId = "ENG_TEXTBOOK";
    const textbookChoices = choices.filter(choice => !choice.nodeId.startsWith("ENG_LOST_WORLD_"));
    const storyChoices = choices.filter(choice => choice.nodeId.startsWith("ENG_LOST_WORLD_"));
    const unitCatalog = [...new Map(textbookChoices
      .filter(choice => typeof choice.unitNumber === "number" && choice.unitTitle)
      .map(choice => [choice.unitNumber!, { unitNumber: choice.unitNumber!, unitTitle: choice.unitTitle! }]))
      .values()]
      .sort((left, right) => left.unitNumber - right.unitNumber);
    const streamChoices = (
      streamId: "ENG_VOCABULARY" | "ENG_GRAMMAR",
      streamTitle: string,
      lessonType: "vocabulary" | "grammar",
    ) => unitCatalog.map(unit => ({
      nodeId: `${streamId}_U${unit.unitNumber}`,
      title: `${streamTitle} — Unit ${unit.unitNumber}`,
      unitTitle: unit.unitTitle,
      unitNumber: unit.unitNumber,
      lessonNumber: `${unit.unitNumber}.1`,
      lessonType,
      sourceLabel: unit.unitNumber <= 5 ? "تجميع متابعة Vocabulary حسب وحدات الكتاب - الجزء الأول" : "تجميع متابعة Vocabulary حسب وحدات الكتاب - الجزء الثاني",
      branchId: streamId,
      branchTitle: streamTitle === "Vocabulary" ? "المفردات (Vocabulary)" : "القواعد (Grammar)",
      branchType: "course_track" as const,
    }));
    const greTitles = [
      "المفردات الأكاديمية وفهمها من السياق",
      "إكمال النصوص (Text Completion)",
      "تكافؤ الجمل (Sentence Equivalence)",
      "فهم المقروء والاستدلال (Reading Comprehension)",
    ];
    const greChoices = greTitles.map((title, index) => ({
      nodeId: `ENG_GRE_${index + 1}`,
      title,
      unitTitle: "مسار GRE التكميلي",
      courseSequenceNumber: index + 1,
      lessonType: "topic" as const,
      sourceLabel: "مسار إثرائي مستقل عن المنهج الوزاري",
      branchId: "ENG_GRE",
      branchTitle: "GRE — مسار تكميلي",
      branchType: "course_track" as const,
    }));
    return [
      { branchId: "ENG_VOCABULARY", branchTitle: "المفردات (Vocabulary)", branchType: "course_track", choices: streamChoices("ENG_VOCABULARY", "Vocabulary", "vocabulary") },
      { branchId: "ENG_GRAMMAR", branchTitle: "القواعد (Grammar)", branchType: "course_track", choices: streamChoices("ENG_GRAMMAR", "Grammar", "grammar") },
      { branchId: "ENG_GRE", branchTitle: "GRE — مسار تكميلي", branchType: "course_track", choices: greChoices },
      {
        branchId: textbookBranchId,
        branchTitle: "موضوعات الكتاب",
        branchType: "course_track",
        choices: textbookChoices.map(choice => ({
          ...choice,
          branchId: textbookBranchId,
          branchTitle: "موضوعات الكتاب",
          branchType: "course_track",
        })),
      },
      {
        branchId: "ENG_STORY",
        branchTitle: "القصة - The Lost World",
        branchType: "course_track",
        choices: storyChoices,
      },
    ];
  }

  // Subjects whose official index is not loaded get an explicit empty linear
  // path. Do not invent titles or offer student-created curriculum checkpoints.
  if (choices.length === 0) {
    return [{
      branchId: `${subjectId}:FULL`,
      branchTitle: "المقرر بالكامل",
      branchType: "course_track",
      choices: [],
    }];
  }

  // Arabic Reading is the list of named texts, not analysis skills within a text.
  const readingSkillNodeIds = new Set([
    "ARB_C05_MAIN_IDEA",
    "ARB_C06_VIEWPOINT",
    "ARB_C08_IMPLICIT_MEANING",
    "ARB_C17_TEXT_DISCOURSE",
  ]);
  const filteredChoices = choices.filter(choice =>
    !(subjectId === "ARB_G2_BAC" && choice.branchId === "ARB_READING" && readingSkillNodeIds.has(choice.nodeId))
    // Keep legacy exercise IDs in raw catalog records, but do not expose practice activities
    // as standalone lessons in the student-facing spelling branch.
    && !(subjectId === "ARB_G2_BAC" && choice.branchId === "ARB_SPELLING" && choice.nodeId.startsWith("ARB_SPELL_") && choice.nodeId !== "ARB_SPELL_U2_MIDDLE_HAMZA")
  );
  const groups = new Map<string, SIECheckpointBranch>();
  for (const choice of filteredChoices) {
    const branchId = choice.branchId ?? `${subjectId}:${choice.unitTitle}`;
    const branch = groups.get(branchId);
    if (branch) {
      branch.choices.push(choice);
    } else {
      groups.set(branchId, {
        branchId,
        branchTitle: choice.branchTitle ?? choice.unitTitle,
        branchType: choice.branchType ?? "official_unit",
        choices: [choice],
      });
    }
  }
  const result = [...groups.values()];
  if (subjectId === "ARB_G2_BAC") {
    for (const branch of result) {
      branch.choices.sort((left, right) => {
        if (branch.branchId === "ARB_SPELLING") {
          const spellingOrder: Record<string, number> = {
            ARB_C09_TAA_MARBUTA: 1,
            ARB_SPELL_U2_MIDDLE_HAMZA: 2,
            ARB_C20_HAMZA: 3,
          };
          return (spellingOrder[left.nodeId] ?? 99) - (spellingOrder[right.nodeId] ?? 99);
        }
        const leftHasUnit = typeof left.unitNumber === "number";
        const rightHasUnit = typeof right.unitNumber === "number";
        if (leftHasUnit && rightHasUnit) {
          const unitDifference = left.unitNumber! - right.unitNumber!;
          if (unitDifference) return unitDifference;
          const lessonDifference = Number(left.lessonNumber ?? 0) - Number(right.lessonNumber ?? 0);
          if (lessonDifference) return lessonDifference;
        } else if (leftHasUnit !== rightHasUnit) {
          return leftHasUnit ? -1 : 1;
        }
        return (left.courseSequenceNumber ?? Number.MAX_SAFE_INTEGER)
          - (right.courseSequenceNumber ?? Number.MAX_SAFE_INTEGER);
      });
    }
    const order: Record<string, number> = {
      ARB_NAHW: 0,
      ARB_BALAGHA: 1,
      ARB_READING: 2,
      ARB_TEXTS: 3,
      ARB_EXPRESSION: 4,
      ARB_SPELLING: 5,
      ARB_LITERATURE: 6,
    };
    result.sort((left, right) => (order[left.branchId] ?? 99) - (order[right.branchId] ?? 99));
  }
  return result;
}

export type SIECheckpointProgressOption = {
  value: string;
  label: string;
  description?: string;
};

const ARABIC_NAHW_TOPIC_GROUPS = [
  {
    groupId: "ARABIC_NAHW_AL_ASMAA_AL_KHAMSA",
    nodeIds: ["ARB_U1_N1", "ARB_U1_N2", "ARB_U1_N3"],
    value: "ARB_U1_N3",
    label: "الأسماء الخمسة",
    description: "الموضوع كاملًا: الدرس والتكملة والتطبيق",
  },
  {
    groupId: "ARABIC_NAHW_AL_MAMNOO_MIN_AL_SARF",
    nodeIds: ["ARB_U2_N1", "ARB_U2_N2", "ARB_U2_N3"],
    value: "ARB_U2_N3",
    label: "الممنوع من الصرف وعلل منعه",
    description: "الموضوع كاملًا: الدرس والتكملة والتطبيق",
  },
] as const;

/**
 * A student-selected topic means the complete topic is finished. Some Arabic
 * grammar topics have multiple textbook checkpoints (lesson, continuation,
 * application); normalize every checkpoint in that topic to its final node.
 * Existing persisted node IDs remain valid and are interpreted consistently.
 */
export function normalizeSIECheckpointFrontier(
  subjectId: string,
  branchId: string,
  frontierId: string,
): string {
  if (subjectId !== "ARB_G2_BAC" || branchId !== "ARB_NAHW") return frontierId;
  const group = ARABIC_NAHW_TOPIC_GROUPS.find(item => item.nodeIds.includes(frontierId as never));
  return group?.value ?? frontierId;
}

/** Student/teacher pickers show coherent lessons, not internal textbook sub-parts. */
export function getSIECheckpointProgressOptions(
  subjectId: string,
  branchId: string,
): SIECheckpointProgressOption[] {
  const branch = getSIECheckpointBranches(subjectId).find(item => item.branchId === branchId);
  if (!branch) return [];
  if (subjectId !== "ARB_G2_BAC" || branchId !== "ARB_NAHW") {
    return branch.choices.map(choice => ({
      value: choice.nodeId,
      label: choice.title,
      description: getSIECheckpointProgressDescription(choice),
    }));
  }

  const emittedGroups = new Set<string>();
  const options: SIECheckpointProgressOption[] = [];
  for (const choice of branch.choices) {
    const group = ARABIC_NAHW_TOPIC_GROUPS.find(item => item.nodeIds.includes(choice.nodeId as never));
    if (group) {
      if (emittedGroups.has(group.groupId)) continue;
      emittedGroups.add(group.groupId);
      options.push({
        value: group.value,
        label: group.label,
        description: group.description,
      });
      continue;
    }
    options.push({
      value: choice.nodeId,
      label: choice.title,
      description: getSIECheckpointProgressDescription(choice),
    });
  }
  return options;
}

/**
 * Shared curriculum view used by progress, planning and priority surfaces.
 * Multi-part lesson components are collapsed to the same topic options the
 * student sees in the progress picker. This prevents the UI and planner from
 * counting the same topic as several independent lessons.
 */
export function getSIECheckpointProgressBranches(subjectId: string): SIECheckpointBranch[] {
  return getSIECheckpointBranches(subjectId).map(branch => {
    const options = getSIECheckpointProgressOptions(subjectId, branch.branchId);
    const choices = options.flatMap(option => {
      const representative = branch.choices.find(choice => choice.nodeId === option.value)
        ?? branch.choices.find(choice =>
          normalizeSIECheckpointFrontier(subjectId, branch.branchId, choice.nodeId) === option.value
        );
      if (!representative) return [];
      return [{
        ...representative,
        nodeId: option.value,
        title: option.label,
        branchId: branch.branchId,
        branchTitle: branch.branchTitle,
        branchType: branch.branchType,
      }];
    });
    return { ...branch, choices };
  });
}

/**
 * Student-facing Arabic branch list. Named reading texts stay attached to
 * their ministry units and legacy ARB_READING progress records are retained;
 * the standalone Reading selector is hidden as requested.
 */
export function getSIEStudentVisibleBranches(subjectId: string): SIECheckpointBranch[] {
  const branches = getSIECheckpointProgressBranches(subjectId);
  return subjectId === "ARB_G2_BAC"
    ? branches.filter(branch => branch.branchId !== "ARB_READING")
    : branches;
}

export type SIECurriculumUnitBranch = {
  branchId: string;
  branchTitle: string;
  choices: SIECheckpointChoice[];
};

export type SIECurriculumUnit = {
  unitId: string;
  unitNumber?: number;
  unitTitle: string;
  title: string;
  isOfficialUnit: boolean;
  lessonCount: number;
  branches: SIECurriculumUnitBranch[];
};

/**
 * Build a student-facing unit view without flattening away branch-level progress.
 * Official units are grouped across the subject's skill branches. Teacher-course
 * topics without a ministry unit number remain in their own branch group.
 */
export function getSIECheckpointUnits(subjectId: string): SIECurriculumUnit[] {
  const branches = getSIECheckpointProgressBranches(subjectId);
  const units = new Map<string, SIECurriculumUnit>();
  for (const branch of branches) {
    for (const choice of branch.choices) {
      const isOfficialUnit = typeof choice.unitNumber === "number" && choice.unitNumber > 0;
      const unitTitle = isOfficialUnit ? (choice.unitTitle?.trim() || branch.branchTitle) : branch.branchTitle;
      const unitId = isOfficialUnit
        ? `UNIT_${choice.unitNumber}_${unitTitle}`
        : `TOPICS_${branch.branchId}`;
      let unit = units.get(unitId);
      if (!unit) {
        unit = {
          unitId,
          ...(isOfficialUnit ? { unitNumber: choice.unitNumber } : {}),
          unitTitle,
          title: isOfficialUnit
            ? `الوحدة ${choice.unitNumber}: ${unitTitle}`
            : unitTitle,
          isOfficialUnit,
          lessonCount: 0,
          branches: [],
        };
        units.set(unitId, unit);
      }
      let unitBranch = unit.branches.find(item => item.branchId === branch.branchId);
      if (!unitBranch) {
        unitBranch = {
          branchId: branch.branchId,
          branchTitle: subjectId === "ARB_G2_BAC" && branch.branchId === "ARB_READING" ? "نصوص الوحدة" : branch.branchTitle,
          choices: [],
        };
        unit.branches.push(unitBranch);
      }
      if (!unitBranch.choices.some(item => item.nodeId === choice.nodeId)) {
        unitBranch.choices.push(choice);
        unit.lessonCount += 1;
      }
    }
  }
  return [...units.values()].sort((left, right) => {
    if (left.isOfficialUnit && right.isOfficialUnit) return (left.unitNumber ?? 0) - (right.unitNumber ?? 0);
    if (left.isOfficialUnit !== right.isOfficialUnit) return left.isOfficialUnit ? -1 : 1;
    return left.title.localeCompare(right.title, "ar");
  });
}

export type SIECheckpointTaskMatch = {
  subjectId: string;
  branchId: string;
  branchTitle: string;
  nodeId: string;
  title: string;
  confidence: "exact" | "strong";
};

/**
 * Matches an existing task to a visible curriculum topic without changing
 * student progress. An open task is evidence of planned work, not evidence
 * that the topic has been completed.
 */
export function matchSIECheckpointTask(
  subjectIds: string[],
  taskText: string,
): SIECheckpointTaskMatch | null {
  const normalize = (value: string) => value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase("ar")
    .replace(/[^\u0600-\u06FFa-z0-9]+/gi, " ")
    .trim();
  const stopWords = new Set([
    "درس", "الدرس", "نرس", "شرح", "محاضره", "محاضرة", "مذاكره", "مذاكرة",
    "مراجعه", "مراجعة", "متابعه", "متابعة", "واجب", "واجبات", "حل", "تطبيق",
    "على", "في", "من", "عن", "الي", "اليوم", "النهارده", "درسنا",
  ]);
  const tokens = (value: string) => normalize(value)
    .split(/\s+/)
    .filter(token => token.length > 1 && !stopWords.has(token));
  const taskTokens = tokens(taskText);
  if (!taskTokens.length) return null;
  const taskNormalized = normalize(taskText);
  const candidates: Array<SIECheckpointTaskMatch & { score: number }> = [];

  for (const subjectId of subjectIds) {
    for (const branch of getSIECheckpointProgressBranches(subjectId)) {
      for (const choice of branch.choices) {
        const titleNormalized = normalize(choice.title);
        const titleTokens = tokens(choice.title);
        const overlap = taskTokens.filter(token => titleTokens.includes(token)).length;
        if (!overlap) continue;
        const score = taskNormalized === titleNormalized
          ? 1
          : taskNormalized.includes(titleNormalized) || titleNormalized.includes(taskNormalized)
            ? 0.98
            : overlap / Math.min(taskTokens.length, titleTokens.length);
        // Short task labels often omit the rest of a longer textbook title.
        // Require at least two meaningful shared Arabic terms to avoid generic matches.
        if (score < 0.58 || overlap < 2) continue;
        candidates.push({
          subjectId,
          branchId: branch.branchId,
          branchTitle: subjectId === "ARB_G2_BAC" && branch.branchId === "ARB_READING"
            ? "نصوص الوحدة"
            : branch.branchTitle,
          nodeId: choice.nodeId,
          title: choice.title,
          confidence: taskNormalized === titleNormalized
            || taskNormalized.includes(titleNormalized)
            || titleNormalized.includes(taskNormalized)
            ? "exact" : "strong",
          score,
        });
      }
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0];
  const second = candidates[1];
  if (!best || (second && best.score - second.score < 0.14)) return null;
  const { score: _score, ...match } = best;
  return match;
}

export function getSIECheckpointChoicesPreview(subjectId: string, limit = 5): SIECheckpointChoice[] {
  return getSIECheckpointChoices(subjectId).slice(0, limit);
}

export function getSIEPublicSegments(teacherId: string) {
  return getSIETeacher(teacherId)?.publicSegments ?? [];
}

export function getSIEPublicCheckpointOptions(teacherId: string): SIECheckpointChoice[] {
  const teacher = getSIETeacher(teacherId);
  if (!teacher) return [];
  const subjectId = teacher.subjectIds[0];
  const validNodeIds = new Set(getSIECheckpointChoices(subjectId).map(choice => choice.nodeId));
  const segments = teacher.publicSegments ?? [];
  const ids = [...new Set(segments.flatMap(segment => segment.curriculumNodeIds).filter(id => validNodeIds.has(id)))];
  return getSIECheckpointChoices(subjectId).filter(choice => ids.includes(choice.nodeId));
}

export function getSIECheckpointChoicesForTeacher(teacherId: string): SIECheckpointChoice[] {
  const teacher = getSIETeacher(teacherId);
  if (!teacher) return [];
  const subjectId = teacher.subjectIds[0];
  // Publicly mapped segments are evidence hints, not a filter on the course
  // catalog. The learner must be able to report progress anywhere in the
  // complete subject index, including lessons not yet observed publicly.
  return getSIECheckpointChoices(subjectId);
}


