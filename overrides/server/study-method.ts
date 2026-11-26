export type TeacherRequirementState = "yes" | "no" | "varies" | "unknown";

export type StudyMethodStage = {
  title: string;
  instruction: string;
  reason: string;
  optional?: boolean;
};

export type StudyMethod = {
  stages: StudyMethodStage[];
  completionCriteria: string;
  teacherPolicyNote?: string;
};

export function isFirstLearningTask(step: { title: string; category: string }): boolean {
  const label = `${step.title} ${step.category}`
    .normalize("NFKC")
    .replace(/[\\u064B-\\u065F\\u0670]/g, "")
    .toLocaleLowerCase("ar");
  const nonLessonWork = /مراجعة|مراجعات|واجب|تدريبات|تدريب|حل\\s+(?:ال)?(?:أسئلة|اسئلة|تمارين|تدريبات|مسائل)|امتحان|اختبار|تقييم|تطبيق|بنك\\s+الأسئلة|بنك\\s+الاسئلة/;
  return !nonLessonWork.test(label);
}

export type LessonTeacherPolicy = {
  homeworkPolicy?: TeacherRequirementState;
  homeworkRequiredBeforeNextLecture?: TeacherRequirementState;
  preLectureExamRequired?: TeacherRequirementState;
};

/**
 * A consistent first-learning workflow for a lesson that the student has not
 * studied before. Student-facing wording is natural Egyptian Arabic; rationale
 * stays visible so the student understands why each pass exists.
 */
export function buildLessonStudyMethod(policy: LessonTeacherPolicy = {}): StudyMethod {
  const stages: StudyMethodStage[] = [
    {
      title: "خُد فكرة سريعة عن الدرس قبل الشرح",
      instruction: "افتح الكتاب أو المصدر، واقرأ عنوان الدرس والعناوين الفرعية والنقاط الرئيسية قراءة سريعة. مش مطلوب تحفظ أو تفهم كل تفصيلة دلوقتي؛ بس كوّن فكرة عامة وخلي بالك من أي نقطة أثارت فضولك.",
      reason: "المعاينة بتدي مخك خريطة أولية للموضوع، وبتخليك تدخل الشرح وعندك تصور وأسئلة طبيعية تدور على إجاباتها.",
    },
    {
      title: "شاهد شرح المدرس بتركيز",
      instruction: "شاهد المحاضرة كاملة، واربط كلام المدرس بالعناوين والأمثلة اللي لمحتها في الكتاب. سجّل النقاط اللي محتاجة ترجع لها بدل ما توقف عند كل تفصيلة.",
      reason: "الشرح بيبني المعنى ويربط أجزاء الدرس ببعض، وبيوضح لك النقاط اللي كانت مبهمة في النظرة الأولى.",
    },
    {
      title: "ارجع اقرأ الدرس مرة تانية بعد المحاضرة",
      instruction: "افتح نفس الجزء في الكتاب أو المصدر واقرأه بهدوء من أوله لآخره. ركّز على المصطلحات والتفاصيل والأمثلة، وارجع للنقطة اللي شرحها المدرس لو احتجت.",
      reason: "القراءة بعد الشرح مش تكرار بلا هدف؛ دلوقتي عندك معنى وسياق تربط بيهم المعلومات. المرور على المعلومة مرة واحدة غالبًا مش كفاية لتثبيتها، والرجوع لها في مرور منفصل ثم مراجعتها بعد فترة بيدعم تذكّرها.",
    },
    {
      title: "اشرح الدرس لنفسك بطريقتك",
      instruction: "اقفل الكتاب وحاول تحكي لنفسك الفكرة العامة وأهم النقاط كأنك بتشرحها لزميل. لو وقفت عند جزئية أو لقيت نفسك مش عارف توصلها، افتح المصدر وراجعها.",
      reason: "لما تحاول توصل الفكرة بكلامك، بتلاحظ بسرعة إيه اللي فهمته وإيه اللي لسه محتاج ترجع له؛ دي مراجعة ذاتية مش امتحان.",
    },
    {
      title: "خد راحة قصيرة قبل التطبيق",
      instruction: "ابعد عن الكتاب والمحاضرة شوية، وبعدها ارجع للواجب أو المطلوب من المدرس.",
      reason: "الفاصل القصير بيساعدك تنتقل من متابعة الشرح إلى التطبيق بتركيز أفضل.",
    },
  ];

  const homework = policy.homeworkPolicy ?? "unknown";
  const homeworkRequired = policy.homeworkRequiredBeforeNextLecture ?? "unknown";
  const examRequired = policy.preLectureExamRequired ?? "unknown";
  const notes: string[] = [];

  if (homework === "yes" || homework === "varies" || homework === "unknown" || homeworkRequired === "yes" || homeworkRequired === "varies" || homeworkRequired === "unknown") {
    stages.push({
      title: homeworkRequired === "yes" ? "حل واجب المدرس قبل المحاضرة القادمة" : "راجع واجب المدرس وحل المطلوب",
      instruction: homework === "yes"
        ? "حل الواجب اللي المدرس حدده على الدرس، بكل أسئلته المطلوبة. عدد الأسئلة وحجم الواجب بيتحددوا من واجب المدرس نفسه، مش من StudyFlow."
        : "اتأكد هل المدرس نزّل واجبًا على المحاضرة دي. لو فيه واجب، حل المطلوب منه وسجّل إنه اتسلّم أو اتراجع.",
      reason: homeworkRequired === "yes"
        ? "حل الواجب شرط معروف قبل المحاضرة التالية، فلازم يخلص قبلها."
        : "الواجب هو تطبيق المدرس على شرحه؛ حجمه بيختلف من محاضرة للتانية، فبنلتزم بالمطلوب الحقيقي من غير ما نخترع عدد أسئلة.",
      optional: homeworkRequired !== "yes",
    });
    if (homeworkRequired === "unknown" || homeworkRequired === "varies") {
      notes.push("شرط حل الواجب قبل المحاضرة التالية غير ثابت أو لم يتم التحقق منه بعد.");
    }
  }

  if (examRequired === "yes" || examRequired === "varies" || examRequired === "unknown") {
    stages.push({
      title: "أكمل امتحان المدرس قبل المحاضرة القادمة",
      instruction: examRequired === "yes"
        ? "أدِّ الامتحان الذي حدده المدرس وراجع نتيجته أو ملاحظاته قبل دخول المحاضرة التالية."
        : "اتأكد هل فيه امتحان محدد من المدرس قبل المحاضرة القادمة. لو موجود، أدِّ الامتحان بالطريقة التي حددها المدرس.",
      reason: "StudyFlow لا ينشئ امتحانات ولا أسئلة؛ هو فقط يتابع متطلبات المدرس الفعلية.",
      optional: examRequired !== "yes",
    });
    if (examRequired === "unknown" || examRequired === "varies") {
      notes.push("وجود امتحان إلزامي قبل المحاضرة التالية غير ثابت أو لم يتم التحقق منه بعد.");
    }
  }

  if (homework === "no" && examRequired === "no") {
    notes.push("بيانات المدرس الحالية لا تشير إلى واجب أو امتحان إلزامي قبل المحاضرة التالية.");
  }

  return {
    stages,
    completionCriteria: "مش مطلوب تكون حافظ 100% أو متقن كل جزئية من أول مرة. المطلوب تفهم الفكرة الأساسية، وتحدد أي نقطة محتاجة مراجعة، وتنفّذ مراحل المذاكرة، وتُنهي واجب أو امتحان المدرس لو كان مطلوبًا منك. بعد كده علّم المهمة «مكتملة» في StudyFlow.",
    ...(notes.length ? { teacherPolicyNote: notes.join(" ") } : {}),
  };
}

export function formatStudyMethodNotes(method: StudyMethod): string {
  const lines = [
    "طريقة المذاكرة:",
    ...method.stages.flatMap((stage, index) => [
      `${index + 1}. ${stage.title}${stage.optional ? " (حسب المطلوب من المدرس)" : ""}`,
      stage.instruction,
      "ليه الخطوة دي؟ " + stage.reason,
    ]),
    ...(method.teacherPolicyNote ? ["ملاحظة بخصوص متطلبات المدرس: " + method.teacherPolicyNote] : []),
    "متى تعتبر المهمة مكتملة؟ " + method.completionCriteria,
  ];
  return lines.join("\n");
}
