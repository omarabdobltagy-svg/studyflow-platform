import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  invokeNvidiaLLM: vi.fn(),
  saveAiPlan: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: mocks.invokeLLM,
  invokeNvidiaLLM: mocks.invokeNvidiaLLM,
}));

vi.mock("./db", () => ({
  getStudentProfile: vi.fn(),
  saveAiPlan: mocks.saveAiPlan,
}));

vi.mock("./textbook-retrieval", () => ({
  formatTextbookEvidence: () => "",
  retrieveTextbookEvidence: () => ({ passages: [], coverageNotes: [] }),
}));

import { generatePersonalPlan, parseGeneratedPlan } from "./planGenerator";

const validPlan = {
  title: "خطة مراجعة التاريخ",
  summary: "خطة مراجعة مركزة تتوزع على ثلاثة أيام مع حل أسئلة قصيرة.",
  durationLabel: "3 أيام",
  steps: [
    { day: "اليوم الأول", title: "مراجعة الوحدة الأولى", detail: "فهم العناوين الرئيسية ثم استرجاعها دون النظر إلى الكتاب.", minutes: 45, category: "مراجعة" },
    { day: "اليوم الثاني", title: "تثبيت المفاهيم", detail: "تلخيص المفاهيم الأساسية وحل مجموعة أسئلة عليها.", minutes: 50, category: "حل أسئلة" },
    { day: "اليوم الثالث", title: "اختبار ذاتي", detail: "حل اختبار قصير ثم مراجعة الأخطاء وتحديد نقاط الضعف.", minutes: 55, category: "تقييم" },
  ],
  habits: [{ title: "استرجاع يومي", cue: "اكتب ما تتذكره قبل فتح الملخص." }],
  reviewQuestion: "ما المفهوم الذي تحتاج إلى مراجعته مرة أخرى؟",
};

const validResponse = {
  choices: [{
    index: 0,
    message: { role: "assistant", content: JSON.stringify(validPlan) },
    finish_reason: "stop",
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveAiPlan.mockResolvedValue(undefined);
});

describe("generated plan JSON parser", () => {
  it("extracts a fenced JSON object after explanatory text and ignores braces inside strings", () => {
    const planWithBraces = {
      ...validPlan,
      steps: validPlan.steps.map((step, index) => ({
        ...step,
        detail: index === 0 ? "اكتب الرمز {A} داخل الملخص ثم اشرح الفكرة." : step.detail,
      })),
    };
    const jsonWithTrailingComma = JSON.stringify(planWithBraces).replace(/}$/, ",}");
    const fence = String.fromCharCode(96).repeat(3);
    const response = "مثال غير صالح: {\"hint\":\"ignore this object\"}\nإليك الخطة المطلوبة:\n\n" + fence + "json\n" + jsonWithTrailingComma + "\n" + fence;
    expect(parseGeneratedPlan(response)).toEqual(planWithBraces);
  });

  it("does not accept an incomplete JSON object", () => {
    expect(() => parseGeneratedPlan('{"title":"خطة ناقصة"')).toThrow("تعذّر تحويل الخطة الذكية");
  });
});

describe("smart planner NVIDIA fallback", () => {
  it("switches to NVIDIA when the primary provider reports exhausted credits", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error(
      'LLM invoke failed: 402 Payment Required – {"error":{"message":"Insufficient credits"}}'
    ));
    mocks.invokeNvidiaLLM.mockResolvedValue(validResponse);

    const result = await generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false,
      { dailyMinutes: 120 }
    );

    expect(mocks.invokeLLM).toHaveBeenCalledOnce();
    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
    const nvidiaRequest = mocks.invokeNvidiaLLM.mock.calls[0][0];
    expect(nvidiaRequest.maxTokens).toBe(6_144);
    expect(nvidiaRequest.response_format).toEqual({ type: "json_object" });
    expect(result.title).toBe(validPlan.title);
    expect(mocks.saveAiPlan).toHaveBeenCalledOnce();
  });

  it("switches to NVIDIA for an explicit insufficient-quota 429 response", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error(
      'LLM invoke failed: 429 Too Many Requests – {"error":{"code":"insufficient_quota"}}'
    ));
    mocks.invokeNvidiaLLM.mockResolvedValue(validResponse);

    await expect(generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false
    )).resolves.toMatchObject({ title: validPlan.title });

    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
    expect(mocks.saveAiPlan).toHaveBeenCalledOnce();
  });

  it("uses NVIDIA when the primary key is not configured", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error("AI_API_KEY is not configured"));
    mocks.invokeNvidiaLLM.mockResolvedValue(validResponse);

    await expect(generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false
    )).resolves.toMatchObject({ title: validPlan.title });

    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
    expect(mocks.saveAiPlan).toHaveBeenCalledOnce();
  });

  it("does not use NVIDIA for an unrelated primary-provider server error", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error("LLM invoke failed: 500 Internal Server Error"));

    await expect(generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false
    )).rejects.toThrow("خدمة المزوّد الأساسي تواجه عطلًا مؤقتًا");

    expect(mocks.invokeNvidiaLLM).not.toHaveBeenCalled();
    expect(mocks.saveAiPlan).not.toHaveBeenCalled();
  });
});
