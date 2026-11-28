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
    return {
      title: document.title,
      url: location.href,
      readyState: document.readyState,
      rootChildCount: root?.childElementCount ?? 0,
      rootText: (root?.innerText ?? "").trim().slice(0, 1200),
      bodyText: (document.body?.innerText ?? "").trim().slice(0, 1600),
      themeClass: document.documentElement.className,
      primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
      ember: getComputedStyle(document.documentElement).getPropertyValue("--sf-ember").trim(),
      brass: getComputedStyle(document.documentElement).getPropertyValue("--sf-brass-bright").trim(),
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
      assert(initialState.primary.toUpperCase() === "#F28B65", viewport.name + ": ember primary token is missing");
      assert(initialState.ember.toUpperCase() === "#EB7B57", viewport.name + ": ember brand token is missing");
      assert(initialState.brass.toUpperCase() === "#E6BD86", viewport.name + ": brass brand token is missing");
      assert(
        initialState.loginCardSurface
          && (initialState.loginCardSurface.image !== "none" || initialState.loginCardSurface.color !== "rgba(0, 0, 0, 0)"),
        viewport.name + ": login card surface is not rendered",
      );
      assert(
        initialState.loginCardSurface.image.includes("37, 43, 40")
          && !initialState.loginCardSurface.image.includes("32, 37, 34"),
        viewport.name + ": legacy green login card palette is still active: " + JSON.stringify(initialState.loginCardSurface),
      );
      assert(
        initialState.loginSubmitSurface?.image.includes("242, 139, 101")
          && !initialState.loginSubmitSurface.image.includes("86, 111, 230")
          && !initialState.loginSubmitSurface.image.includes("216, 241, 124"),
        viewport.name + ": login button is not using the ember palette: " + JSON.stringify(initialState.loginSubmitSurface),
      );
      assert(
        initialState.loginActiveTabSurface?.background.includes("199, 91, 59"),
        viewport.name + ": active auth tab is not using the ember palette: " + JSON.stringify(initialState.loginActiveTabSurface),
      );
      assert(
        initialState.loginBrandSurface?.image.includes("229, 193, 139"),
        viewport.name + ": login brand mark is not using the brass palette: " + JSON.stringify(initialState.loginBrandSurface),
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

      // Render production component classes in a data-free specimen shell.
      // This checks the actual loaded design CSS without creating or mutating a student account.
      await page.evaluate(() => {
        const root = document.getElementById("root");
        if (root) root.style.display = "none";
        const shell = document.createElement("div");
        shell.id = "studyflow-design-qa-specimen";
        shell.className = "sf-app-shell sf-shell-v3";
        shell.style.cssText = "position:relative;z-index:1;min-height:100vh;overflow:visible;";
        shell.innerHTML = '<div class="sf-app-frame"><aside class="sf-sidebar"><div class="sf-brand"><span class="sf-brand-mark">S</span><span class="sf-brand-copy"><b>StudyFlow</b><small>DESIGN SYSTEM QA</small></span></div></aside><div class="sf-app-main"><header class="sf-topbar"><div class="sf-heading-copy"><h1>نظام التصميم الموحد</h1><p class="sf-page-description">فحص مكونات أساسية من المساحة الدراسية</p></div></header><main class="sf-main"><div class="sf-page"><section class="sf-home-ai-decision"><div class="sf-home-ai-decision-orbit" aria-hidden="true"><span></span><i></i><b></b></div><div class="sf-home-ai-decision-copy"><div class="sf-home-ai-decision-kicker"><span class="sf-home-ai-pulse"></span> قرار محرك التخطيط <span>STUDYFLOW INTELLIGENCE</span></div><h3>الأولوية القادمة مبنية على تقدمك الدراسي</h3><p>يربط المحرك موضعك في المنهج والمهام المفتوحة وجدول المدرس في ترتيب واحد قابل للتنفيذ.</p><div class="sf-home-ai-triggers"><span>المتراكم أولًا</span><span>موعد المدرس</span><span>أهمية الامتحان</span></div></div><div class="sf-home-ai-decision-compare"><div><small>الخطة الأصلية</small><strong>18</strong><span>خطوة</span></div><i></i><div><small>التوزيع الحالي</small><strong>14</strong><span>خطوة</span></div><button type="button">تفاصيل التعديل</button></div></section><section class="sf-map-hero"><div class="sf-map-hero-copy"><p class="sf-map-eyebrow">متابعة المنهج والتقدم</p><h2>خريطة المنهج</h2><p>عرض بصري للفروع والدروس والتقدم المسجل.</p></div><div class="sf-map-hero-meta"><span>5 مواد</span><span>18 فرعًا</span></div></section><section class="sf-task-overview"><div class="sf-task-overview-heading"><p>مساحة التنفيذ</p><h2>حوّل التزاماتك إلى تقدم واضح</h2><span>الأولوية والموعد وحالة الإنجاز في لوحة واحدة.</span></div><div class="sf-task-overview-progress"><div class="sf-task-progress-copy"><span>نسبة الإنجاز المسجلة</span><strong>68%</strong><div class="sf-task-progress-rail"><i style="width:68%"></i></div><small>أُنجز 12 من 18 مهمة</small></div><div class="sf-task-overview-stats"><article><span>قيد التنفيذ</span><b>6</b></article><article><span>مستحقة اليوم</span><b>2</b></article><article><span>متأخرة</span><b>1</b></article><article><span>أولوية عالية</span><b>3</b></article></div></div></section><section class="sf-session-finish-dialog"><header class="sf-session-finish-header"><div class="sf-session-finish-heading"><span class="sf-session-finish-mark">✓</span><div><span>مراجعة الجلسة</span><h2>خلصت مذاكرتك؟</h2><p>اللغة العربية · النحو</p></div></div><button class="sf-session-finish-close" type="button">×</button></header><div class="sf-session-finish-stats"><div><span>الوقت المسجل</span><strong>01:35:20</strong></div><div><span>وقت الإنهاء</span><strong>07:35 م</strong></div></div><div class="sf-session-finish-question"><strong>حدّد حالة الدرس قبل الحفظ</strong><p>اختَر ما حدث فعلًا. لن نضع علامة اكتمال على الدرس من دون اختيارك.</p></div><div class="sf-session-finish-options"><button class="is-selected" type="button"><span class="sf-session-finish-option-icon">✓</span><span><b>أنهيت الدرس</b><small>احفظ الوقت وسجّل الدرس كمكتمل في تقدمك.</small></span><i>✓</i></button><button type="button"><span class="sf-session-finish-option-icon">◷</span><span><b>احفظ الوقت فقط</b><small>احتفظ بمدة الجلسة، واترك حالة الدرس كما هي.</small></span><i></i></button></div><footer class="sf-session-finish-footer"><button type="button" data-variant="outline">العودة للجلسة</button><button type="button" data-variant="default">حفظ وإنهاء الجلسة</button></footer></section><section class="sf-ops-workspace"><header class="sf-ops-heading"><div><h2>مساحة التشغيل التفاعلية</h2><p>المهام والأهداف والجدول والتقدم في مكان واحد.</p></div><span class="sf-ops-live"><span></span>متصل بالبيانات</span></header><div class="sf-ops-grid"><section class="sf-ops-scene-card"><div class="sf-ops-card-heading"><div><p>WORKSPACE MAP</p><h3>طبقات مساحة العمل</h3></div></div><div class="sf-ops-scene-viewport"></div><div class="sf-ops-node-list"><button class="is-selected" type="button"><span></span><b>اليوم</b></button><button type="button"><span></span><b>المهام</b></button><button type="button"><span></span><b>الأهداف</b></button></div></section><section class="sf-ops-detail-card"><div class="sf-ops-detail-heading"><div><p>نظرة اليوم</p><h3>مركز القيادة</h3><span>صورة واحدة لما يحتاج انتباهك الآن.</span></div></div><div class="sf-ops-layer-body"><div class="sf-ops-stat-grid"><article class="sf-ops-metric"><small>قيد التنفيذ</small><b>6</b><span>مهمة</span></article><article class="sf-ops-metric is-warm"><small>نسبة الإنجاز</small><b>68%</b><span>تقدم مسجل</span></article></div><div class="sf-ops-next"><span class="sf-ops-next-icon">✦</span><div><b>الخطوة التالية</b><p>ابدأ بمراجعة النحو</p><small>حسب أولويات الخطة الحالية</small></div></div><div class="sf-ops-quick-actions"><button type="button">إضافة مهمة</button><button type="button">هدف جديد</button><button type="button">موعد</button></div></div></section></div></section></div></main></div></div>';
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
            color: s.color,
          };
        };
        return {
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          homeDecision: read(".sf-home-ai-decision"),
          mapHero: read(".sf-map-hero"),
          taskOverview: read(".sf-task-overview"),
          sessionDialog: read(".sf-session-finish-dialog"),
          opsScene: read(".sf-ops-scene-card"),
          opsDetail: read(".sf-ops-detail-card"),
          opsViewport: read(".sf-ops-scene-viewport"),
          opsSelectedNode: read(".sf-ops-node-list button.is-selected"),
          opsNext: read(".sf-ops-next"),
        };
      });
      for (const [name, component] of Object.entries(designSpecimen)) {
        if (name === "viewportWidth" || name === "documentWidth") continue;
        assert(component?.visible, viewport.name + ": design component is missing or hidden: " + name);
        assert(component.width <= viewport.width + 2, viewport.name + ": design component overflows: " + name);
      }
      assert(designSpecimen.documentWidth <= viewport.width + 2, viewport.name + ": design specimen has horizontal overflow");
      assert(
        designSpecimen.homeDecision.backgroundImage !== "none",
        viewport.name + ": home AI decision has no painted background: " + JSON.stringify(designSpecimen.homeDecision),
      );
      assert(
        designSpecimen.mapHero.backgroundImage !== "none",
        viewport.name + ": curriculum map has no painted background: " + JSON.stringify(designSpecimen.mapHero),
      );
      assert(
        designSpecimen.taskOverview.backgroundImage !== "none",
        viewport.name + ": task overview has no painted background: " + JSON.stringify(designSpecimen.taskOverview),
      );
      assert(
        designSpecimen.sessionDialog.background !== "rgba(0, 0, 0, 0)",
        viewport.name + ": session dialog surface is transparent: " + JSON.stringify(designSpecimen.sessionDialog),
      );
      for (const [name, component] of Object.entries({
        opsScene: designSpecimen.opsScene,
        opsDetail: designSpecimen.opsDetail,
        opsViewport: designSpecimen.opsViewport,
        opsSelectedNode: designSpecimen.opsSelectedNode,
        opsNext: designSpecimen.opsNext,
      })) {
        assert(component?.visible, viewport.name + ": operations workspace component is missing: " + name);
        assert(component.width <= viewport.width + 2, viewport.name + ": operations component overflows: " + name);
      }
      assert(designSpecimen.opsViewport.backgroundImage !== "none", viewport.name + ": operations 3D scene has no designed surface");
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
      passed: results.length * 7,
      checks: ["login", "registration", "home AI decision", "curriculum map", "task overview", "session finish", "operations workspace"],
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
