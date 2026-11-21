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
};

const BAC_SYSTEM: SIESystemId = "EG_BACCALAUREATE";
const GENERAL_SYSTEM: SIESystemId = "EG_GENERAL_SECONDARY";
const GRADE_YEAR = "الصف الثاني الثانوي – دفعة 2027";
const ACADEMIC_YEAR = "2026/2027";

export const SIE_CATALOG_META = {
  packageVersion: "2026-11-21-no-design",
  academicYear: ACADEMIC_YEAR,
  gradeYear: GRADE_YEAR,
  gradeId: "G2",
  teacherRecommendationLimit: 3,
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
  { subjectId: "SECOND_LANGUAGE_G2_BAC_PENDING", nameAr: "لغة أجنبية ثانية", curriculumAvailable: false, note: "المادة ضمن اختيار المسار، لكن فهرسها غير محمّل في الحزمة." },
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
    lastChecked: "2026-10-13", coursePresence: "verified_on_platform",
    publicAudienceMetric: 6020000,
    publicAudienceMetricDate: "2024-06-29",
    popularitySignal: "لقطة تاريخية لقناة واسعة الوصول",
    latestPublicCheckpoint: "مراجعة 13 أكتوبر: الأسماء الخمسة، حكايات الغريب، العلم بين القانون والضمير، الخلق جوهر الفضيلة، والفقرة الحجاجية ونقد المقال.",
    teachingAdvice: "لا تساوِ بين مشاهدة المحاضرة وبين تعلّم الدرس؛ اختبر الفهم بالسؤال والتطبيق، واستخدم أخطاء الواجب والامتحان لتحديد ما يحتاج تصحيحًا.",
    teachingAdviceEvidence: "ملخص وصف فيديو منشور 29 أكتوبر 2026؛ ليس تفريغًا حرفيًا.",
    evidenceLabel: "ظهور باقة للصف الثاني بكالوريا على المنصة",
    confidenceLabel: "ثقة متوسطة – نقطة عامة منشورة",
    evidenceNote: "مراجعة أكتوبر المنشورة تثبت موضوعات عامة فقط؛ لا تثبت رقم الكورس المدفوع ولا أن الطالب شاهد هذه الموضوعات.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_MOHAMED_SALAH_OCT_REVIEW",
  },
  {
    teacherId: "T_AR_REDA_FAROUK", nameAr: "رضا الفاروق", brandName: "رضا الفاروق",
    subjectIds: ["ARB_G2_BAC"], profileUrl: "https://youtube.com/channel/UC7fHSfm6zxGJYC-P7RMzX7w",
    lastChecked: "2026-08-08", coursePresence: "verified_public_content",
    publicAudienceMetric: 1570000,
    publicAudienceMetricDate: "2026-11-14",
    popularitySignal: "لقطة عامة للقناة، وليست مقياس جودة",
    latestPublicCheckpoint: "تأسيس النص المعلوماتي ومهارات الفكرة المحورية وتحليل الحجج؛ لا توجد نقطة مدفوعة أحدث مؤكدة.",
    teachingAdvice: "حدّد النقطة الأساسية في الفرع، افهمها، ثم طبّق عليها بأسئلة وامتحانات وتحقق من الإجابة. إذا تعثرت في سؤال، انتقل مؤقتًا ثم عد إليه.",
    teachingAdviceEvidence: "مقابلة صحفية 2024؛ نصيحة عامة وليست ترتيبًا إلزاميًا لامتحان 2027.",
    evidenceLabel: "محتوى تأسيسي/عام للصف الثاني بكالوريا",
    confidenceLabel: "ثقة منخفضة إلى متوسطة – محتوى عام",
    evidenceNote: "المصدر يدعم وجود محتوى عام؛ لا يثبت موضع الكورس المدفوع الحالي.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_REDA_FAROUK_FOUNDATION",
  },
  {
    teacherId: "T_AR_MOHAMED_TAREK", nameAr: "محمد طارق", brandName: "القيصر",
    subjectIds: ["ARB_G2_BAC"], profileUrl: "https://youtube.com/@mr.mohamed_tarek",
    lastChecked: "2026-08-20", coursePresence: "verified_bac_listing_with_conflicting_generic_catalog",
    publicAudienceMetric: 422000,
    publicAudienceMetricDate: "2026-11-10",
    popularitySignal: "لقطة عامة للقناة، وليست مقياس جودة",
    latestPublicCheckpoint: "محتوى تأسيسي منشور 20 أغسطس عن فهم النص وتحليله ومناقشته وتوظيف اللغة.",
    evidenceLabel: "ظهور قائمة بكالوريا مع تعارض في كتالوج عام",
    confidenceLabel: "ثقة منخفضة – توجد بيانات متعارضة",
    evidenceNote: "المصادر لا تحسم موضع الكورس المدفوع؛ لا نعتمد رقم محاضرة من هذه البيانات.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_TAREK_CATALOG_CONFLICT",
  },
  {
    teacherId: "T_EN_MAHMOUD_RADWAN", nameAr: "محمود رضوان", brandName: "إنجلشاوي",
    subjectIds: ["ENG1_G2_BAC"], profileUrl: "https://www.youtube.com/@MahmoudRadwan.Englishawy",
    lastChecked: "2026-10-13", coursePresence: "verified_public_2027_course_package_and_public_unit1_reviews",
    publicAudienceMetric: 1510000,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "لقطة عامة حديثة للقناة",
    latestPublicCheckpoint: "Unit 1 – الجزء الثاني: كلمات الدرس الثالث، جرامر حالات If، كلمات الدرسين الرابع والخامس وتقييمات الوزارة.",
    evidenceLabel: "باقة/محتوى منشور للصف الثاني بكالوريا",
    confidenceLabel: "ثقة متوسطة – نقاط عامة متعددة",
    evidenceNote: "المراجعات العامة لا تثبت ترتيب الكورس المدفوع أو تقدم الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_ENGLISHWAY_UNIT1_OCT13",
  },
  {
    teacherId: "T_EN_SHERIF", nameAr: "شريف المصري", brandName: "شريف المصري",
    subjectIds: ["ENG1_G2_BAC"], profileUrl: "https://sherifelmassry.com/",
    lastChecked: "2026-11-01", coursePresence: "verified_teacher_platform_and_channel",
    publicAudienceMetric: 250000,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "لقطة عامة للقناة",
    latestPublicCheckpoint: "مراجعة Unit 1 وشرح القصة؛ نقطة الكورس المدفوع الحالية غير معروفة.",
    evidenceLabel: "وجود منصة وقناة ومحتوى عام",
    confidenceLabel: "ثقة منخفضة – نقطة الكورس المدفوع غير معروفة",
    evidenceNote: "المتاح يثبت وجود المدرس ومحتوى عام فقط؛ لا يثبت ترتيب الكورس المدفوع.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_SHERIF",
  },
  {
    teacherId: "T_EN_AHMED_SOBHY", nameAr: "أحمد صبحي", brandName: "إنجليزي البكالوريا",
    subjectIds: ["ENG1_G2_BAC"], profileUrl: "https://zolotube.com/channel?id=UCP4vtEvANSvCszyJFBEiqOA",
    lastChecked: "2026-11-17", coursePresence: "verified_public_content",
    publicAudienceMetric: 6350,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "لقطة عامة للقناة مع محتوى حديث للصف",
    latestPublicCheckpoint: "شرح Unit 4 منشور علنًا؛ قد يكون محتوى إضافيًا وليس تسلسل الكورس المدفوع.",
    evidenceLabel: "محتوى عام مرتبط بالصف الثاني",
    confidenceLabel: "ثقة متوسطة – منشور عام",
    evidenceNote: "المحتوى العام لا يثبت تسلسل كورس مدفوع مطابقًا أو تقدم الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_AHMED_SOBHY",
  },
  {
    teacherId: "T_HIS_AHMED_GHONIEM", nameAr: "أحمد غنيم", brandName: "أحمد غنيم",
    subjectIds: ["HIS_G2_BAC"], profileUrl: "https://ahmedghoniem.com/",
    lastChecked: "2026-08-29", coursePresence: "verified_teacher_primary",
    publicAudienceMetric: 186000,
    publicAudienceMetricDate: "2026-08-29",
    popularitySignal: "لقطة عامة للقناة",
    latestPublicCheckpoint: "إعلان الخطة السنوية فقط؛ آخر درس مدفوع غير معروف.",
    teachingAdvice: "في التاريخ: حدّد الحدث وأسبابه ونتائجه وموقعه الزمني وعلاقته بحدث آخر، ثم مارس تحليل النص والخريطة ونقطة التحول والاستثناء.",
    teachingAdviceEvidence: "مهارات يصفها المعلم في محاضرته التأسيسية؛ أفكار تدريب وليست مواصفة رسمية للامتحان.",
    evidenceLabel: "خطة سنوية منشورة من موقع المدرس",
    confidenceLabel: "ثقة منخفضة – خطة عامة فقط",
    evidenceNote: "الخطة السنوية لا تثبت رقم المحاضرة المدفوعة أو تقدم الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_AHMED_GHONIEM_YEAR_PLAN",
  },
  {
    teacherId: "T_HIS_MARWAN", nameAr: "مروان حسن", brandName: "المؤرخ مروان حسن",
    subjectIds: ["HIS_G2_BAC"], profileUrl: "https://youtube.com/channel/UCJqSCcNDCxe4b259TXPZbcw",
    lastChecked: "2026-11-15", coursePresence: "verified_public_content",
    publicAudienceMetric: 66200,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "لقطة تحليلات قناة عامة",
    latestPublicCheckpoint: "مقاطع عامة عن دروس 4–6؛ ترتيب المدرس لا يطابق فهرس الكتاب تلقائيًا.",
    teachingAdvice: "استخدم السرد والربط بين الأحداث بدل حفظ كل حدث منفصلًا، ثم اختبر الفهم بأسئلة متدرجة.",
    teachingAdviceEvidence: "ملخص وصف القناة العامة.",
    evidenceLabel: "محتوى تاريخ عام منشور",
    confidenceLabel: "ثقة منخفضة إلى متوسطة – محتوى عام",
    evidenceNote: "المحتوى العام لا يثبت ترتيب كورس مدفوع أو موعدًا ثابتًا.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_MARWAN",
  },
  {
    teacherId: "T_HIS_ABDELHADY", nameAr: "محمود عبدالهادي", brandName: "محمود عبدالهادي",
    subjectIds: ["HIS_G2_BAC"], profileUrl: "https://zolotube.com/channel?id=UCThV5LrCMIWs9tyDvZ9IC2w",
    lastChecked: "2026-11-17", coursePresence: "verified_public_content",
    publicAudienceMetric: 27700,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "لقطة عامة للقناة",
    latestPublicCheckpoint: "حل واجب الدرس الرابع مع شرح الدرس الثالث في الوحدة الثانية.",
    evidenceLabel: "محتوى تاريخ عام منشور",
    confidenceLabel: "ثقة متوسطة – منشور عام",
    evidenceNote: "المصدر العام لا يثبت تسلسل الكورس المدفوع أو تقدم الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_2027_course_evidence_found", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_ABDELHADY",
  },
  {
    teacherId: "T_PROG_IMAD_SHARAF", nameAr: "عماد شرف", brandName: "WE4CODE",
    subjectIds: ["PROG_AI_G2_BAC"], profileUrl: "https://we4code.com/course/7",
    lastChecked: "2026-11-17", coursePresence: "verified_platform_course_listing",
    evidenceLabel: "إدراج كورس للصف الثاني بكالوريا على WE4CODE",
    confidenceLabel: "ثقة متوسطة – وجود الكورس في الكتالوج",
    evidenceNote: "إدراج المنصة يثبت وجود الكورس، لكنه لا يعرض فهرسًا كاملًا أو تقدم الطالب.",
    systemCourseVerification: { EG_BACCALAUREATE: "course_catalog_presence_only", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_PROG_WE4CODE_IMAD",
  },
  {
    teacherId: "T_PROG_ANAS_AHMED", nameAr: "د. أنس أحمد", brandName: "Code-UP",
    subjectIds: ["PROG_AI_G2_BAC"], profileUrl: "https://www.code-up.tech/",
    lastChecked: "2026-11-17", coursePresence: "verified_platform_course_listing",
    evidenceLabel: "إدراج كورس نوفمبر على Code-UP",
    confidenceLabel: "ثقة منخفضة إلى متوسطة – إدراج كتالوج",
    evidenceNote: "الإدراج يثبت وجود منتج للكورس، والفهرس الداخلي غير مكتمل.",
    systemCourseVerification: { EG_BACCALAUREATE: "course_catalog_presence_only", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_PROG_CODEUP_ANAS",
  },
  {
    teacherId: "T_PROG_KHALED_ASHRAF", nameAr: "خالد أشرف", brandName: "برمجة بكالوريا",
    subjectIds: ["PROG_AI_G2_BAC"], profileUrl: "https://www.youtube.com/watch?v=oIYgUBLUJxU",
    lastChecked: "2026-08-27", coursePresence: "verified_public_video_for_grade_and_subject",
    publicAudienceMetric: 6150,
    publicAudienceMetricDate: "2026-11-17",
    popularitySignal: "لقطة قناة عامة؛ المشاهدات والمتابعون لا يقيسون جودة التدريس",
    latestPublicCheckpoint: "الدرس الثاني: كيف يعمل الذكاء الاصطناعي؛ لا يثبت وجود كورس مدفوع.",
    evidenceLabel: "فيديو عام للصف الثاني – درس عن عمل الذكاء الاصطناعي",
    confidenceLabel: "ثقة متوسطة – نقطة عامة فقط",
    evidenceNote: "الفيديو لا يثبت وجود كورس مدفوع أو آخر محاضرة فيه.",
    systemCourseVerification: { EG_BACCALAUREATE: "public_checkpoint_only", EG_GENERAL_SECONDARY: "not_verified_for_2026_2027" },
    sourceId: "SRC_PROG_KHALED_OCT_LESSON2",
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
