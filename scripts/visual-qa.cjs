const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = process.env.STUDYFLOW_QA_URL || "https://studyflow-preview-360-production.up.railway.app";
const outDir = path.resolve("artifacts/visual-qa");
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 960 },
];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function readPageState(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x), y: Math.round(r.y),
        width: Math.round(r.width), height: Math.round(r.height),
        right: Math.round(r.right), bottom: Math.round(r.bottom),
      };
    };
    const root = document.getElementById("root");
    const appTheme = document.querySelector(".sf-app-shell.sf-shell-v3") || document.documentElement;
    const themeTokens = getComputedStyle(appTheme);
    return {
      title: document.title,
      url: location.href,
      readyState: document.readyState,
      rootChildCount: root?.childElementCount ?? 0,
      rootText: (root?.innerText ?? "").trim().slice(0, 1200),
      bodyText: (document.body?.innerText ?? "").trim().slice(0, 1600),
      themeClass: document.documentElement.className,
      primary: themeTokens.getPropertyValue("--primary").trim(),
      ember: themeTokens.getPropertyValue("--sf-ember").trim(),
      brass: themeTokens.getPropertyValue("--sf-brass").trim(),
      brassBright: themeTokens.getPropertyValue("--sf-brass-bright").trim(),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      loginCardSurface: (() => {
        const card = document.querySelector(".sf-login-form-card");
        if (!card) return null;
        const style = getComputedStyle(card);
        return { color: style.backgroundColor, image: style.backgroundImage };
      })(),
      loginSubmitSurface: (() => {
        const button = document.querySelector(".sf-login-screen .sf-auth-submit");
        if (!button) return null;
        const style = getComputedStyle(button);
        return { color: style.color, background: style.backgroundColor, image: style.backgroundImage };
      })(),
      loginActiveTabSurface: (() => {
        const button = document.querySelector(".sf-login-screen .sf-auth-mode-tabs button[aria-selected='true']");
        if (!button) return null;
        const style = getComputedStyle(button);
        return { color: style.color, background: style.backgroundColor, image: style.backgroundImage };
      })(),
      loginBrandSurface: (() => {
        const mark = document.querySelector(".sf-login-screen .sf-login-brand-mark-v4");
        if (!mark) return null;
        const style = getComputedStyle(mark);
        return { color: style.color, background: style.backgroundColor, image: style.backgroundImage };
      })(),
      screenWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      loginScreen: rect(".sf-login-screen"),
      loginFrame: rect(".sf-login-frame"),
      formCard: rect(".sf-login-form-card"),
      authError: rect(".sf-auth-screen"),
      pageLoader: rect(".sf-page-loading"),
      inputCount: document.querySelectorAll(".sf-login-screen input").length,
    };
  });
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const results = [];
  const errors = [];
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });
      const pageErrors = [];
      const consoleErrors = [];
      const failedSameOriginRequests = [];
      const badSameOriginResponses = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      page.on("console", message => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("requestfailed", request => {
        if (request.url().startsWith(baseUrl)) {
          failedSameOriginRequests.push({ url: request.url(), error: request.failure()?.errorText });
        }
      });
      page.on("response", response => {
        if (response.url().startsWith(baseUrl) && response.status() >= 400) {
          badSameOriginResponses.push({ url: response.url(), status: response.status() });
        }
      });

      let navigationError = null;
      try {
        await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(5000);
      } catch (error) {
        navigationError = error.message;
      }

      let initialState = await readPageState(page);
      await page.screenshot({
        path: path.join(outDir, viewport.name + "-initial.png"),
        fullPage: true,
      }).catch(() => undefined);

      if (!initialState.loginScreen) {
        await page.waitForSelector(".sf-login-screen", { state: "visible", timeout: 15000 }).catch(() => undefined);
        initialState = await readPageState(page);
      }

      if (!initialState.loginScreen) {
        const diagnostic = {
          viewport: viewport.name,
          navigationError,
          state: initialState,
          pageErrors,
          consoleErrors,
          failedSameOriginRequests,
          badSameOriginResponses,
        };
        fs.writeFileSync(
          path.join(outDir, viewport.name + "-diagnostic.json"),
          JSON.stringify(diagnostic, null, 2),
        );
        await page.close();
        throw new Error(viewport.name + ": login UI did not render. " + JSON.stringify(diagnostic));
      }

      assert(initialState.themeClass.split(/\\s+/).includes("dark"), viewport.name + ": expected dark premium theme");
      assert(initialState.primary.toUpperCase() === "#E2C47D", viewport.name + ": gold primary token is missing");
      assert(initialState.ember.toUpperCase() === "#2B2923", viewport.name + ": graphite identity token is missing");
      assert(initialState.brass.toUpperCase() === "#A88445", viewport.name + ": brass brand token is missing");
      assert(initialState.brassBright.toUpperCase() === "#E2C47D", viewport.name + ": illuminated gold accent token is missing");
      assert(
        initialState.loginCardSurface
          && (initialState.loginCardSurface.image !== "none" || initialState.loginCardSurface.color !== "rgba(0, 0, 0, 0)"),
        viewport.name + ": login card surface is not rendered",
      );
      assert(
        initialState.loginCardSurface.image.includes("226, 196, 125")
          && initialState.loginCardSurface.image.includes("12, 15, 18"),
        viewport.name + ": login card is not using the graphite/gold glass surface: " + JSON.stringify(initialState.loginCardSurface),
      );
      assert(
        initialState.loginSubmitSurface?.image.includes("242, 225, 177")
          && initialState.loginSubmitSurface.color.includes("23, 19, 10"),
        viewport.name + ": login action is not using the gold finish: " + JSON.stringify(initialState.loginSubmitSurface),
      );
      assert(
        initialState.loginActiveTabSurface?.image.includes("226, 196, 125"),
        viewport.name + ": active auth tab is not using the gold accent: " + JSON.stringify(initialState.loginActiveTabSurface),
      );
      assert(
        initialState.loginBrandSurface?.image.includes("242, 225, 177"),
        viewport.name + ": login brand mark is not using the gold accent: " + JSON.stringify(initialState.loginBrandSurface),
      );
      assert(initialState.inputCount >= 2, viewport.name + ": login fields are missing");
      assert(
        initialState.documentWidth <= viewport.width + 2,
        viewport.name + ": horizontal page overflow (" + initialState.documentWidth + "px > " + viewport.width + "px)",
      );
      assert(initialState.bodyWidth <= viewport.width + 2, viewport.name + ": body horizontal overflow");
      assert(
        initialState.loginFrame.x >= -1 && initialState.loginFrame.right <= viewport.width + 1,
        viewport.name + ": login frame is outside the viewport",
      );
      await page.screenshot({ path: path.join(outDir, viewport.name + "-login.png"), fullPage: true });

      const registerTab = page.getByRole("tab", { name: "إنشاء حساب" });
      await registerTab.click();
      await page.waitForSelector("#studyflow-register-name", { state: "visible", timeout: 10000 });
      const registerState = await page.evaluate(() => {
        const fields = [
          "studyflow-register-name", "studyflow-register-phone",
          "studyflow-password", "studyflow-confirm-password",
        ].map(id => {
          const el = document.getElementById(id);
          const r = el?.getBoundingClientRect();
          return { id, visible: Boolean(el && r && r.width > 0 && r.height > 0), labelled: Boolean(el?.labels?.length) };
        });
        const frame = document.querySelector(".sf-login-frame")?.getBoundingClientRect();
        return {
          width: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          frame: frame ? { left: Math.round(frame.left), right: Math.round(frame.right), width: Math.round(frame.width) } : null,
          fields,
        };
      });
      assert(registerState.width <= viewport.width + 2, viewport.name + ": registration screen horizontal overflow");
      assert(
        registerState.fields.every(field => field.visible && field.labelled),
        viewport.name + ": registration field missing or not labelled",
      );
      assert(
        registerState.frame && registerState.frame.left >= -1 && registerState.frame.right <= viewport.width + 1,
        viewport.name + ": registration frame clipped",
      );
      await page.screenshot({ path: path.join(outDir, viewport.name + "-register.png"), fullPage: true });

      // Render active dashboard surfaces in a data-free specimen shell.
      // The retired AI-decision hero and 3D operations scene are intentionally excluded.
      await page.evaluate(() => {
        const root = document.getElementById("root");
        if (root) root.style.display = "none";
        const shell = document.createElement("div");
        shell.id = "studyflow-design-qa-specimen";
        shell.className = "sf-app-shell sf-shell-v3";
        shell.style.cssText = "position:relative;z-index:1;min-height:100vh;overflow:visible;";
        shell.innerHTML = '<div class="sf-app-frame"><aside class="sf-sidebar"><div class="sf-brand"><span class="sf-brand-mark">S</span><span class="sf-brand-copy"><b>StudyFlow</b><small>DESIGN SYSTEM QA</small></span></div></aside><div class="sf-app-main"><header class="sf-topbar"><div class="sf-heading-copy"><h1>مساحة اليوم</h1><p class="sf-page-description">فحص واجهة الطالب ومقاساتها</p></div></header><main class="sf-main"><div class="sf-page"><section class="sf-home-study-map sf-daily-plan-card"><header class="sf-home-study-map-header"><div class="sf-home-study-map-title"><span>أولوياتك اليوم</span><h3>خريطة مذاكرة اليوم</h3></div><button class="sf-home-study-map-open" type="button">الخريطة الكاملة</button></header><div class="sf-home-study-map-body"><div class="sf-home-study-map-progress"><div class="sf-home-study-map-progress-copy"><span>تقدم تنفيذ الخطة</span><strong>2 من 5</strong></div><b>40%</b></div><div class="sf-home-study-path"><article class="sf-home-study-step is-next"><span class="sf-home-study-step-marker">1</span><div class="sf-home-study-step-content"><div class="sf-home-study-step-meta"><span>ابدأ من هنا</span><span>45 دقيقة</span></div><div class="sf-home-study-step-curriculum"><span>Unit 3 — Echoes of the Past</span><span>Lesson 1 — Vocabulary</span></div><h4>Sites of Memory</h4><p>ابدأ من الدرس الظاهر في الخطة.</p></div></article></div><footer class="sf-home-study-map-footer"><div><strong>الخطوة التالية: Sites of Memory</strong><span>افتح الدرس وسجّل ما أنجزته.</span></div><button type="button">افتح الدرس</button></footer></div></section><section class="sf-home-exam-calendar"><header class="sf-home-exam-calendar-header"><div><span>مواعيد الاختبارات</span><h3>اختباراتك القادمة</h3><p>مواعيد مقترحة حسب بيانات الجدول.</p></div></header><div class="sf-home-exam-calendar-track"><article class="sf-home-exam-item"><div class="sf-home-exam-item-date"><span>الأحد</span><strong>29 نوفمبر</strong></div><div class="sf-home-exam-item-subject"><b>اللغة العربية</b></div><span class="sf-home-exam-countdown">اليوم</span><button class="sf-home-exam-complete" type="button">خلصت الامتحان</button><div class="sf-home-exam-scope"><div class="sf-home-exam-scope-heading"><span>نطاق المراجعة المسجل</span><b>3 دروس</b></div><ul class="sf-home-exam-scope-preview"><li>النحو</li><li>النصوص</li></ul></div></article></div></section><section class="sf-map-hero"><div class="sf-map-hero-copy"><p class="sf-map-eyebrow">متابعة المنهج والتقدم</p><h2>خريطة المنهج</h2><p>عرض بصري للفروع والدروس والتقدم المسجل.</p></div><div class="sf-map-hero-meta"><span>5 مواد</span><span>18 فرعًا</span></div></section><section class="sf-task-overview"><div class="sf-task-overview-heading"><p>مساحة المهام</p><h2>مهامك حسب الأولوية</h2><span>الموعد وحالة الإنجاز في لوحة واحدة.</span></div><div class="sf-task-overview-progress"><div class="sf-task-progress-copy"><span>نسبة الإنجاز المسجلة</span><strong>68%</strong><div class="sf-task-progress-rail"><i style="width:68%"></i></div><small>أُنجز 12 من 18 مهمة</small></div><div class="sf-task-overview-stats"><article><span>قيد التنفيذ</span><b>6</b></article><article><span>مستحقة اليوم</span><b>2</b></article></div></div></section><section class="sf-session-finish-dialog"><header class="sf-session-finish-header"><div class="sf-session-finish-heading"><span class="sf-session-finish-mark">✓</span><div><span>مراجعة الجلسة</span><h2>خلصت مذاكرتك؟</h2><p>اللغة العربية · النحو</p></div></div><button class="sf-session-finish-close" type="button">×</button></header><div class="sf-session-finish-stats"><div><span>الوقت المسجل</span><strong>01:35:20</strong></div><div><span>وقت الإنهاء</span><strong>07:35 م</strong></div></div><div class="sf-session-finish-question"><strong>حدّد حالة الدرس قبل الحفظ</strong><p>اختَر ما حدث فعلًا. لن نضع علامة اكتمال على الدرس من دون اختيارك.</p></div><div class="sf-session-finish-options"><button class="is-selected" type="button"><span class="sf-session-finish-option-icon">✓</span><span><b>أنهيت الدرس</b><small>احفظ الوقت وسجّل الدرس كمكتمل في تقدمك.</small></span><i>✓</i></button><button type="button"><span class="sf-session-finish-option-icon">◷</span><span><b>احفظ الوقت فقط</b><small>احتفظ بمدة الجلسة، واترك حالة الدرس كما هي.</small></span><i></i></button></div><footer class="sf-session-finish-footer"><button type="button" data-variant="outline">العودة للجلسة</button><button type="button" data-variant="default">حفظ وإنهاء الجلسة</button></footer></section></div></main></div></div>';
        const examScene = document.createElement("section");
        examScene.className = "sf-exam-mission-scene";
        examScene.innerHTML = '<div class="sf-exam-mission-main"><header class="sf-exam-mission-header"><span class="sf-exam-mission-kicker">الامتحان الأقرب</span><span class="sf-exam-mission-state">موعد مقترح</span></header><div class="sf-exam-mission-overview"><div class="sf-exam-mission-copy"><span class="sf-exam-mission-subject-label">اللغة العربية</span><h2>الامتحان الأقرب</h2><span class="sf-exam-mission-date">الأحد · 29 نوفمبر</span></div><div class="sf-exam-mission-countdown"><strong>1</strong><span>يوم متبقٍ</span></div></div><div class="sf-exam-mission-guidance"><span>الخطوة التالية</span><p>راجع النطاق المسجل ثم افتح الخريطة.</p><button type="button" class="sf-exam-mission-action">افتح خريطة المذاكرة</button></div></div><section class="sf-exam-mission-timeline"><span class="sf-exam-mission-timeline-title">موعد المراجعة</span><div><i></i><span>النحو</span><small>اليوم</small></div></section><footer class="sf-exam-mission-scope"><p>نطاق المراجعة المسجل · 3 دروس</p></footer>';
        shell.querySelector(".sf-main .sf-page")?.prepend(examScene);

        const plannerBoard = document.createElement("section");
        plannerBoard.className = "sf-sp-plan-board";
        plannerBoard.innerHTML = '<header class="sf-sp-board-header"><span class="sf-sp-eyebrow">خريطة المذاكرة</span><h2>مسارات المواد</h2></header><div class="sf-execution-board"><header class="sf-execution-board-header"><div><span class="sf-sp-eyebrow">المسار التفاعلي للمنهج</span><h3>خريطة المواد والوحدات والدروس</h3><p>المسار الدراسي المرتبط بالتقدم الفعلي.</p></div><div class="sf-execution-filters"><button aria-pressed="true">كل الخطوات</button></div></header><div class="sf-execution-summary"><div><small>الخطوة التالية</small><strong>الممنوع من الصرف</strong></div><div><small>المواد والمسارات</small><strong>4</strong></div><div><small>المتبقي</small><strong>7</strong></div></div><div class="sf-execution-subjects"><details class="sf-execution-subject" open><summary class="sf-execution-subject-summary"><span class="sf-execution-subject-icon">ع</span><span class="sf-execution-subject-copy"><small>مادة دراسية</small><strong>اللغة العربية · الوحدة الثانية</strong><i><b style="width:40%"></b></i></span><span class="sf-execution-subject-count">2 / 5</span><span class="sf-execution-subject-ring"><b>40%</b></span></summary><div class="sf-execution-steps"><article class="sf-execution-step is-next"><span class="sf-execution-step-index">1</span><details class="sf-execution-step-details" open><summary><span class="sf-execution-step-meta"><span>ابدأ من هنا</span><span>اليوم</span></span><strong>الممنوع من الصرف</strong><p>الشرح والتكملة والتطبيق في درس واحد.</p></summary><div class="sf-execution-step-body"><p>طريقة التنفيذ</p><div class="sf-execution-step-actions"><a href="#">افتح الدرس</a></div></div></details></article></div></details></div></div>';
        shell.querySelector(".sf-main .sf-page")?.append(plannerBoard);

        const emptyMap = document.createElement("section");
        emptyMap.className = "sf-map-empty-state";
        emptyMap.innerHTML = '<span class="sf-map-empty-orbit">✦</span><span class="sf-sp-eyebrow">خريطة المذاكرة</span><h2>خريطتك الدراسية جاهزة للإنشاء</h2><p>سيبني StudyFlow المسارات من موادك ومواضع تقدمك الفعلية.</p><button class="sf-map-empty-action">إنشاء خريطة المذاكرة</button>';
        shell.querySelector(".sf-main .sf-page")?.append(emptyMap);

        document.body.appendChild(shell);
      });
      const designSpecimen = await page.evaluate(() => {
        const read = selector => {
          const el = document.querySelector("#studyflow-design-qa-specimen " + selector);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return {
            visible: r.width > 0 && r.height > 0,
            width: Math.round(r.width),
            height: Math.round(r.height),
            background: s.backgroundColor,
            backgroundImage: s.backgroundImage,
            borderRadius: s.borderRadius,
            color: s.color,
          };
        };
        return {
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          dailyMap: read(".sf-home-study-map"),
          dailyStep: read(".sf-home-study-step-content"),
          examCard: read(".sf-home-exam-item"),
          examCompleteAction: read(".sf-home-exam-complete"),
          mapHero: read(".sf-map-hero"),
          taskOverview: read(".sf-task-overview"),
          sessionDialog: read(".sf-session-finish-dialog"),
      examSpotlight: read(".sf-exam-mission-scene"),
      examAction: read(".sf-exam-mission-action"),
      plannerBoard: read(".sf-sp-plan-board"),
      plannerMap: read(".sf-execution-board"),
      subjectLane: read(".sf-execution-subject"),
      lessonNode: read(".sf-execution-step-details"),
      mapEmpty: read(".sf-map-empty-state"),
        };
      });
      const overflowDiagnostics = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll("#studyflow-design-qa-specimen *"))
          .map(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return {tag:el.tagName,id:el.id,classes:typeof el.className==="string"?el.className:"",left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,overflowX:s.overflowX,position:s.position}; })
          .filter(el => el.right > window.innerWidth + 2 || el.left < -2 || el.scrollWidth > el.clientWidth + 2)
          .sort((a,b) => (b.right-window.innerWidth)-(a.right-window.innerWidth)).slice(0,30);
        const shell=document.querySelector("#studyflow-design-qa-specimen");
        const frame=shell?.querySelector(".sf-app-frame");
        return {viewportWidth:window.innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,shell:shell?{width:shell.getBoundingClientRect().width,scrollWidth:shell.scrollWidth,overflow:getComputedStyle(shell).overflow}:null,frame:frame?{width:frame.getBoundingClientRect().width,scrollWidth:frame.scrollWidth,overflow:getComputedStyle(frame).overflow}:null,overflowNodes:nodes};
      });
      for (const [name, component] of Object.entries(designSpecimen)) {
        if (name === "viewportWidth" || name === "documentWidth") continue;
        assert(component?.visible, viewport.name + ": current design component is missing or hidden: " + name);
        assert(component.width <= viewport.width + 2, viewport.name + ": current design component overflows: " + name);
      }
      assert(designSpecimen.documentWidth <= viewport.width + 2, viewport.name + ": current design specimen has horizontal overflow: " + JSON.stringify(overflowDiagnostics));
      assert(
        designSpecimen.dailyMap.backgroundImage !== "none",
        viewport.name + ": daily map has no designed surface: " + JSON.stringify(designSpecimen.dailyMap),
      );
      assert(
        designSpecimen.dailyStep.background !== "rgba(0, 0, 0, 0)",
        viewport.name + ": daily step surface is transparent: " + JSON.stringify(designSpecimen.dailyStep),
      );
      assert(
        designSpecimen.examCard.background !== "rgba(0, 0, 0, 0)",
        viewport.name + ": same-day exam card surface is transparent: " + JSON.stringify(designSpecimen.examCard),
      );
      assert(
        designSpecimen.mapHero.backgroundImage !== "none"
          && !designSpecimen.mapHero.backgroundImage.includes("201, 237, 98"),
        viewport.name + ": curriculum map still contains the retired lime palette: " + JSON.stringify(designSpecimen.mapHero),
      );
      assert(
        designSpecimen.taskOverview.backgroundImage !== "none"
          && !designSpecimen.taskOverview.backgroundImage.includes("41, 47, 58"),
        viewport.name + ": task overview still contains the retired blue palette: " + JSON.stringify(designSpecimen.taskOverview),
      );
      assert(
        designSpecimen.sessionDialog.background !== "rgba(0, 0, 0, 0)",
        viewport.name + ": session dialog surface is transparent: " + JSON.stringify(designSpecimen.sessionDialog),
      );
      assert(
        designSpecimen.examSpotlight.backgroundImage !== "none"
          && Number.parseFloat(designSpecimen.examSpotlight.borderRadius) >= 20,
        viewport.name + ": exam spotlight does not use the glass card design: " + JSON.stringify(designSpecimen.examSpotlight),
      );
      assert(
        Number.parseFloat(designSpecimen.examAction.borderRadius) >= 10,
        viewport.name + ": exam action has sharp corners: " + JSON.stringify(designSpecimen.examAction),
      );
      assert(
        designSpecimen.plannerBoard.backgroundImage !== "none"
          && designSpecimen.plannerMap.backgroundImage !== "none",
        viewport.name + ": map visual surfaces are missing: " + JSON.stringify({ board: designSpecimen.plannerBoard, map: designSpecimen.plannerMap }),
      );
      assert(
        Number.parseFloat(designSpecimen.subjectLane.borderRadius) >= 18
          && Number.parseFloat(designSpecimen.lessonNode.borderRadius) >= 14,
        viewport.name + ": subject/lesson map nodes are not styled: " + JSON.stringify({ subject: designSpecimen.subjectLane, lesson: designSpecimen.lessonNode }),
      );
      assert(
        designSpecimen.mapEmpty.backgroundImage !== "none",
        viewport.name + ": planner empty-map state has no designed surface: " + JSON.stringify(designSpecimen.mapEmpty),
      );
      await page.screenshot({ path: path.join(outDir, viewport.name + "-design-system.png"), fullPage: true });
      await page.evaluate(() => {
        document.getElementById("studyflow-design-qa-specimen")?.remove();
        const root = document.getElementById("root");
        if (root) root.style.display = "";
      });


      const viewportErrors = { pageErrors, consoleErrors, failedSameOriginRequests, badSameOriginResponses };
      if (Object.values(viewportErrors).some(value => value.length > 0)) {
        errors.push({ viewport: viewport.name, ...viewportErrors });
      }
      results.push({
        viewport: viewport.name,
        login: initialState,
        registration: registerState,
        designSpecimen,
        ...viewportErrors,
      });
      await page.close();
    }

    fs.writeFileSync(
      path.join(outDir, "visual-qa.json"),
      JSON.stringify({ baseUrl, passed: results.length, results, errors }, null, 2),
    );
    if (errors.length) throw new Error("Browser errors or failed same-origin requests were detected: " + JSON.stringify(errors));
    console.log(JSON.stringify({
      passed: results.length * 13,
      checks: ["login", "registration", "daily study map", "daily study step", "same-day exam card", "curriculum map", "task overview", "session finish", "exam spotlight layout", "exam next-step action", "planner map surface", "subject and lesson nodes", "planner empty-map state"],
      viewports: results.map(result => result.viewport),
      screenshots: fs.readdirSync(outDir),
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
