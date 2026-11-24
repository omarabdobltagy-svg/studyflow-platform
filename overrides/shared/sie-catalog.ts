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
  { subjectId: "SECOND_LANGUAGE_G2_BAC_PENDING", nameAr: "اللغة الإيطالية (لغة أجنبية ثانية)", curriculumAvailable: true, note: "فهرس الجزء الأول موثق على مستوى وحدتين؛ نص الصفحات غير مفهرس بعد." },
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
    gradeYear: GRADE_YEAR, requiredSubjectIds: bacCore,
    electiveOptions: [[
      SIE_SUBJECTS.find(s => s.subjectId === "PSYCHOLOGY_G2_BAC_PENDING")!,
      SIE_SUBJECTS.find(s => s.subjectId === "SECOND_LANGUAGE_G2_BAC_PENDING")!,
    ]],
    note: "اختر مادة واحدة من علم النفس أو اللغة الأجنبية الثانية.",
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
    publicSegments: [{"title":"كلمات الدرس الأول وجرامره","timestamp":"2026-10-11","curriculumNodeIds":["ENG_U1_NODE"],"mappingStatus":"unit_level_mapping"},{"title":"كلمات الدرس الثاني وجرامره","timestamp":"2026-10-11","curriculumNodeIds":["ENG_U1_NODE"],"mappingStatus":"unit_level_mapping"},{"title":"كلمات الدرس الثالث","timestamp":"2026-10-13","curriculumNodeIds":["ENG_U1_NODE"],"mappingStatus":"unit_level_mapping"},{"title":"جرامر حالات If","timestamp":"2026-10-13","curriculumNodeIds":["ENG_U1_NODE"],"mappingStatus":"unit_level_mapping"},{"title":"كلمات الدرسين الرابع والخامس مع التقييمات","timestamp":"2026-10-13","curriculumNodeIds":["ENG_U1_NODE"],"mappingStatus":"unit_level_mapping"}],
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
    latestPublicCheckpoint: "Unit 1 review plus story explanation; current paid-course checkpoint unknown.",
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
    confidenceLabel: "ثقة منخفضة – نقطة الكورس المدفوع غير معروفة",
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
    latestPublicCheckpoint: "Unit 4 explanation publicly posted; this may be supplemental rather than paid-course sequence.",
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
    evidenceNote: "المصدر العام لا يثبت تسلسل الكورس المدفوع أو تقدم الطالب.",
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
  branchId?: string;
  branchTitle?: string;
  branchType?: "official_unit" | "official_section";
};

export type SIECheckpointBranch = {
  branchId: string;
  branchTitle: string;
  branchType: "official_unit" | "official_section";
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
};

/**
 * الفروع هنا مستخرجة من فهرس الكتاب:
 * العربية/التاريخ/البرمجة: وحدات أو فصول مستقلة.
 * الإنجليزية: أقسام A/B داخل كل وحدة، لأن هذا هو التقسيم الرسمي الأدق.
 * المهارات مثل Grammar وVocabulary تبقى أبعاد إتقان، لا تسلسل دروس مخترع.
 */
function getOfficialBranch(subjectId: string, choice: SIECheckpointChoice) {
  if (subjectId === "ENG1_G2_BAC") {
    const section = choice.nodeId.match(/^(ENG_U\d+_SEC_[AB])/i)?.[1];
    if (section) {
      return {
        branchId: section,
        branchTitle: ENGLISH_SECTION_TITLES[section] ?? choice.unitTitle,
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
        : subjectId === "SECOND_LANGUAGE_G2_BAC_PENDING"
          ? /^(ITA_U\d+)/
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
    { nodeId: "ARB_U1_L1", title: "العلم بين القانون والضمير", unitTitle: "العلم والضمير" },
    { nodeId: "ARB_U1_L2", title: "الخلق جوهر الفضيلة", unitTitle: "العلم والضمير" },
    { nodeId: "ARB_U1_L3", title: "العلم نور", unitTitle: "العلم والضمير" },
    { nodeId: "ARB_U2_L1", title: "التقنية وصناعة الرأي العام", unitTitle: "سلطان الكلمة الرقمية" },
    { nodeId: "ARB_U2_L2", title: "بين الذوق والعقل", unitTitle: "سلطان الكلمة الرقمية" },
    { nodeId: "ARB_U2_L3", title: "أثر الكلمة وحفظ اللسان", unitTitle: "سلطان الكلمة الرقمية" },
    { nodeId: "ARB_U3_L1", title: "حقوق الإنسان بين العالمية والخصوصية", unitTitle: "الإنسان وكرامته" },
    { nodeId: "ARB_U3_L2", title: "الحرية الفكرية", unitTitle: "الإنسان وكرامته" },
    { nodeId: "ARB_U3_L3", title: "يا أخي الإنسان", unitTitle: "الإنسان وكرامته" },
  ],
  ENG1_G2_BAC: [
    { nodeId: "ENG_U1_SEC_A_T1", title: "Social Media and Self-Image", unitTitle: "Living Well in a Complex World" },
    { nodeId: "ENG_U1_SEC_A_T2", title: "Exploring Modern Lifestyles", unitTitle: "Living Well in a Complex World" },
    { nodeId: "ENG_U1_SEC_B_T1", title: "Whose Responsibility Is It?", unitTitle: "Living Well in a Complex World" },
    { nodeId: "ENG_U1_SEC_B_T2", title: "Understanding Mental Health", unitTitle: "Living Well in a Complex World" },
    { nodeId: "ENG_U2_SEC_A_T1", title: "Screen Time and Young People", unitTitle: "Leisure Time" },
    { nodeId: "ENG_U2_SEC_A_T2", title: "Creative Arts as Leisure Activities", unitTitle: "Leisure Time" },
    { nodeId: "ENG_U2_SEC_B_T1", title: "Sport and Physical Activity as Leisure", unitTitle: "Leisure Time" },
    { nodeId: "ENG_U2_SEC_B_T2", title: "Not Exactly a Relaxing Day", unitTitle: "Leisure Time" },
    { nodeId: "ENG_U3_SEC_A_T1", title: "Sites of Memory", unitTitle: "Echoes of the Past" },
    { nodeId: "ENG_U3_SEC_A_T2", title: "The Museum as a Storyteller", unitTitle: "Echoes of the Past" },
    { nodeId: "ENG_U3_SEC_B_T1", title: "The Viral Past", unitTitle: "Echoes of the Past" },
    { nodeId: "ENG_U3_SEC_B_T2", title: "Social Media and Historical Events", unitTitle: "Echoes of the Past" },
    { nodeId: "ENG_U4_SEC_A_T1", title: "Food Waste", unitTitle: "The Power of Choice" },
    { nodeId: "ENG_U4_SEC_A_T2", title: "Beyond the Brand", unitTitle: "The Power of Choice" },
    { nodeId: "ENG_U4_SEC_B_T1", title: "Digital Consumption", unitTitle: "The Power of Choice" },
    { nodeId: "ENG_U4_SEC_B_T2", title: "Black Friday and Sales Culture", unitTitle: "The Power of Choice" },
    { nodeId: "ENG_U5_SEC_A_T1", title: "The Climate Crisis", unitTitle: "The Greenhouse Effect" },
    { nodeId: "ENG_U5_SEC_A_T2", title: "Renewable Energy – Powering a Sustainable Future", unitTitle: "The Greenhouse Effect" },
    { nodeId: "ENG_U5_SEC_B_T1", title: "Greening Projects in Egypt", unitTitle: "The Greenhouse Effect" },
    { nodeId: "ENG_U5_SEC_B_T2", title: "Individual and Collective Actions", unitTitle: "The Greenhouse Effect" },
  ],
  HIS_G2_BAC: [
    { nodeId: "HIS_U1_L1", title: "بناء الدولة المصرية واستمرارها عبر التاريخ", unitTitle: "مصر بين الماضي والحاضر" },
    { nodeId: "HIS_U1_L2", title: "الدولة المصرية القديمة ومقاومة الاحتلال", unitTitle: "مصر بين الماضي والحاضر" },
    { nodeId: "HIS_U1_L3", title: "التحولات الكبرى في مصر (العصر الوسيط)", unitTitle: "مصر بين الماضي والحاضر" },
    { nodeId: "HIS_U1_L4", title: "التحولات الكبرى في مصر (العصر الحديث)", unitTitle: "مصر بين الماضي والحاضر" },
    { nodeId: "HIS_U2_L1", title: "سياسات الاحتلال بمصر في العصر الحديث", unitTitle: "تحولات القوة وبناء الوعي بمصر في العصر الحديث والمعاصر" },
    { nodeId: "HIS_U2_L2", title: "صمود الشعب المصري ومقاومة الاحتلال", unitTitle: "تحولات القوة وبناء الوعي بمصر في العصر الحديث والمعاصر" },
    { nodeId: "HIS_U2_L3", title: "ثورة 23 يوليو والتحولات الكبرى في مصر", unitTitle: "تحولات القوة وبناء الوعي بمصر في العصر الحديث والمعاصر" },
    { nodeId: "HIS_U2_L4", title: "الهوية الوطنية في مواجهة الاستعمار الجديد", unitTitle: "تحولات القوة وبناء الوعي بمصر في العصر الحديث والمعاصر" },
    { nodeId: "HIS_U3_L1", title: "حركات التحرر الوطني ضد الاحتلال الفرنسي والإيطالي في العالم العربي", unitTitle: "مصر وقضايا التحرر الوطني في الوطن العربي وإفريقيا" },
    { nodeId: "HIS_U3_L2", title: "حركات التحرر الوطني ضد الاحتلال البريطاني والإسباني في العالم العربي", unitTitle: "مصر وقضايا التحرر الوطني في الوطن العربي وإفريقيا" },
    { nodeId: "HIS_U3_L3", title: "مرتكزات الدور المصري إقليميًا ودوليًا", unitTitle: "مصر وقضايا التحرر الوطني في الوطن العربي وإفريقيا" },
    { nodeId: "HIS_U3_L4", title: "دور مصر في دعم حركات التحرر الوطني", unitTitle: "مصر وقضايا التحرر الوطني في الوطن العربي وإفريقيا" },
  ],
  SECOND_LANGUAGE_G2_BAC_PENDING: [
    { nodeId: "ITA_U1_T1", title: "Dove abiti?", unitTitle: "Unità 1: Dove abiti?" },
    { nodeId: "ITA_U2_T1", title: "Tempo libero", unitTitle: "Unità 2: Tempo libero" },
  ],
  PROG_AI_G2_BAC: [
    { nodeId: "PROG_1_1", title: "تطور تكنولوجيا المعلومات والتحول الاجتماعي", unitTitle: "تكنولوجيا المعلومات والمجتمع" },
    { nodeId: "PROG_1_2", title: "كيف يعمل الذكاء الاصطناعي", unitTitle: "تكنولوجيا المعلومات والمجتمع" },
    { nodeId: "PROG_1_3", title: "الذكاء الاصطناعي في الحياة اليومية والصناعة", unitTitle: "تكنولوجيا المعلومات والمجتمع" },
    { nodeId: "PROG_1_4", title: "القضايا الأخلاقية للذكاء الاصطناعي", unitTitle: "تكنولوجيا المعلومات والمجتمع" },
    { nodeId: "PROG_2_1", title: "تقنيات التشفير والمصادقة", unitTitle: "الأمن السيبراني" },
    { nodeId: "PROG_2_2", title: "تصميم أمن الشبكات", unitTitle: "الأمن السيبراني" },
    { nodeId: "PROG_2_3", title: "الاستجابة للحوادث وإدارة المخاطر", unitTitle: "الأمن السيبراني" },
    { nodeId: "PROG_3_1", title: "البنية العامة لتطبيقات الويب", unitTitle: "تطبيقات الويب" },
    { nodeId: "PROG_3_2", title: "طرق الاتصال في تطبيقات الويب", unitTitle: "تطبيقات الويب" },
    { nodeId: "PROG_3_3", title: "أساسيات تكنولوجيا الواجهة الأمامية", unitTitle: "تطبيقات الويب" },
    { nodeId: "PROG_4_1", title: "أنواع الوسائط وخصائصها", unitTitle: "تصميم الويب والوسائط" },
    { nodeId: "PROG_4_2", title: "تصميم المعلومات وتجربة المستخدم للمواقع", unitTitle: "تصميم الويب والوسائط" },
    { nodeId: "PROG_4_3", title: "أساليب تقييم المواقع الإلكترونية", unitTitle: "تصميم الويب والوسائط" },
    { nodeId: "PROG_4_4", title: "عملية التحسين التكراري للمواقع", unitTitle: "تصميم الويب والوسائط" },
    { nodeId: "PROG_5_1", title: "طرق جمع البيانات", unitTitle: "جمع البيانات وتنقيتها" },
    { nodeId: "PROG_5_2", title: "تنقية البيانات وتحويلها", unitTitle: "جمع البيانات وتنقيتها" },
    { nodeId: "PROG_5_3", title: "البيانات المفتوحة وواجهات برمجة التطبيقات", unitTitle: "جمع البيانات وتنقيتها" },
    { nodeId: "PROG_6_1", title: "الاستدلال الإحصائي", unitTitle: "التحليل والتواصل" },
    { nodeId: "PROG_6_2", title: "استخدام تحليل الانحدار وتقييمه", unitTitle: "التحليل والتواصل" },
    { nodeId: "PROG_6_3", title: "تمثيل البيانات المرئي والتواصل", unitTitle: "التحليل والتواصل" },
    { nodeId: "PROG_7_1", title: "أساسيات التعلم الآلي", unitTitle: "التعلم الآلي والذكاء الاصطناعي" },
    { nodeId: "PROG_7_2", title: "الشبكات العصبية والتعلم العميق", unitTitle: "التعلم الآلي والذكاء الاصطناعي" },
    { nodeId: "PROG_7_3", title: "نماذج اللغة الكبيرة والذكاء الاصطناعي التوليدي", unitTitle: "التعلم الآلي والذكاء الاصطناعي" },
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

/** يعيد الوحدات/الأقسام كمسارات تقدم مستقلة بدل تسلسل واحد للمادة كلها. */
export function getSIECheckpointBranches(subjectId: string): SIECheckpointBranch[] {
  const groups = new Map<string, SIECheckpointBranch>();
  for (const choice of getSIECheckpointChoices(subjectId)) {
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
  return [...groups.values()];
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
  const choices = getSIECheckpointChoices(subjectId);
  const segments = teacher.publicSegments ?? [];
  const mappedIds = new Set(segments.flatMap(segment => segment.curriculumNodeIds));
  const mapped = choices.filter(choice => mappedIds.has(choice.nodeId));
  const focusUnits = new Set(mapped.map(choice => choice.unitTitle));
  // A public mapping to a whole unit (as with English reviews) narrows the
  // first student choices to that official unit without guessing subtopics.
  if (focusUnits.size === 0) {
    const unitNodeIds = new Set(segments.flatMap(segment => segment.curriculumNodeIds));
    const unitTitles: Record<string, string> = { ENG_U1_NODE: "Living Well in a Complex World" };
    for (const id of unitNodeIds) if (unitTitles[id]) focusUnits.add(unitTitles[id]);
  }
  if (focusUnits.size > 0) return choices.filter(choice => focusUnits.has(choice.unitTitle)).slice(0, 5);
  const firstUnit = choices[0]?.unitTitle;
  return choices.filter(choice => choice.unitTitle === firstUnit).slice(0, 5);
}


