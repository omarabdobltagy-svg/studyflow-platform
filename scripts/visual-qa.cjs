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
      wine: getComputedStyle(document.documentElement).getPropertyValue("--sf-wine").trim(),
      gold: getComputedStyle(document.documentElement).getPropertyValue("--sf-gold-bright").trim(),
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
      assert(initialState.primary.toUpperCase() === "#D1B77B", viewport.name + ": gold primary token is missing");
      assert(initialState.wine.toUpperCase() === "#A95861", viewport.name + ": wine brand token is missing");
      assert(initialState.gold.toUpperCase() === "#D1B77B", viewport.name + ": gold brand token is missing");
      assert(
        initialState.loginCardSurface
          && (initialState.loginCardSurface.image !== "none" || initialState.loginCardSurface.color !== "rgba(0, 0, 0, 0)"),
        viewport.name + ": login card surface is not rendered",
      );
      assert(
        initialState.loginCardSurface.image.includes("41, 34, 32")
          && !initialState.loginCardSurface.image.includes("27, 35, 23"),
        viewport.name + ": legacy green login card palette is still active: " + JSON.stringify(initialState.loginCardSurface),
      );
      assert(
        initialState.loginSubmitSurface?.image.includes("140, 66, 76")
          && !initialState.loginSubmitSurface.image.includes("86, 111, 230")
          && !initialState.loginSubmitSurface.image.includes("216, 241, 124"),
        viewport.name + ": login button is not using the wine brand palette: " + JSON.stringify(initialState.loginSubmitSurface),
      );
      assert(
        initialState.loginActiveTabSurface?.background.includes("140, 66, 76"),
        viewport.name + ": active auth tab is not using the wine brand palette: " + JSON.stringify(initialState.loginActiveTabSurface),
      );
      assert(
        initialState.loginBrandSurface?.image.includes("228, 212, 184"),
        viewport.name + ": login brand mark is not using the muted gold palette: " + JSON.stringify(initialState.loginBrandSurface),
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

      const viewportErrors = { pageErrors, consoleErrors, failedSameOriginRequests, badSameOriginResponses };
      if (Object.values(viewportErrors).some(value => value.length > 0)) {
        errors.push({ viewport: viewport.name, ...viewportErrors });
      }
      results.push({
        viewport: viewport.name,
        login: initialState,
        registration: registerState,
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
      passed: results.length * 2,
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
