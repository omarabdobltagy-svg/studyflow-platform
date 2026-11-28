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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function waitForLatestPalette(page) {
  let lastPalette = "";
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForSelector(".sf-login-screen", { timeout: 12000 });
      await page.waitForTimeout(800);
      lastPalette = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
      );
      if (lastPalette.toUpperCase() === "#8C424C") return;
    } catch (error) {
      lastPalette = error.message;
    }
    await sleep(10000);
  }
  throw new Error("Preview did not serve the new StudyFlow palette within 5 minutes. Last value: " + lastPalette);
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const results = [];
  const errors = [];
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
      const pageErrors = [];
      const failedSameOriginRequests = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      page.on("requestfailed", request => {
        if (request.url().startsWith(baseUrl)) failedSameOriginRequests.push({ url: request.url(), error: request.failure()?.errorText });
      });

      await waitForLatestPalette(page);
      const loginState = await page.evaluate(() => {
        const rect = selector => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
        };
        return {
          title: document.title,
          primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
          screenWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
          loginScreen: rect(".sf-login-screen"),
          loginFrame: rect(".sf-login-frame"),
          formCard: rect(".sf-login-form-card"),
          inputCount: document.querySelectorAll(".sf-login-screen input").length,
          buttons: Array.from(document.querySelectorAll(".sf-login-screen button")).map(el => (el.innerText || el.getAttribute("aria-label") || "").trim()).filter(Boolean).slice(0, 12),
        };
      });

      assert(loginState.loginScreen, viewport.name + ": login screen is missing");
      assert(loginState.loginFrame, viewport.name + ": login frame is missing");
      assert(loginState.inputCount >= 2, viewport.name + ": login fields are missing");
      assert(loginState.primary.toUpperCase() === "#8C424C", viewport.name + ": primary token is not the expected wine accent");
      assert(loginState.documentWidth <= viewport.width + 2, viewport.name + ": horizontal page overflow (" + loginState.documentWidth + "px > " + viewport.width + "px)");
      assert(loginState.bodyWidth <= viewport.width + 2, viewport.name + ": body horizontal overflow");

      const frame = loginState.loginFrame;
      assert(frame.x >= -1 && frame.right <= viewport.width + 1, viewport.name + ": login frame is outside the viewport");
      await page.screenshot({ path: path.join(outDir, viewport.name + "-login.png"), fullPage: true });

      const registerTab = page.getByRole("tab", { name: "إنشاء حساب" });
      await registerTab.click();
      await page.waitForSelector("#studyflow-register-name", { state: "visible", timeout: 10000 });
      const registerState = await page.evaluate(() => {
        const fields = ["studyflow-register-name", "studyflow-register-phone", "studyflow-password", "studyflow-confirm-password"]
          .map(id => {
            const el = document.getElementById(id);
            const r = el?.getBoundingClientRect();
            return { id, visible: Boolean(el && r && r.width > 0 && r.height > 0), labelled: Boolean(el?.labels?.length) };
          });
        return {
          width: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          frame: (() => { const r = document.querySelector(".sf-login-frame")?.getBoundingClientRect(); return r ? { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) } : null; })(),
          fields,
        };
      });
      assert(registerState.width <= viewport.width + 2, viewport.name + ": registration screen horizontal overflow");
      assert(registerState.fields.every(field => field.visible && field.labelled), viewport.name + ": registration field missing or not labelled");
      assert(registerState.frame && registerState.frame.left >= -1 && registerState.frame.right <= viewport.width + 1, viewport.name + ": registration frame clipped");
      await page.screenshot({ path: path.join(outDir, viewport.name + "-register.png"), fullPage: true });

      if (pageErrors.length) errors.push({ viewport: viewport.name, pageErrors });
      if (failedSameOriginRequests.length) errors.push({ viewport: viewport.name, failedSameOriginRequests });
      results.push({ viewport: viewport.name, login: loginState, registration: registerState, pageErrors, failedSameOriginRequests });
      await page.close();
    }
    fs.writeFileSync(path.join(outDir, "visual-qa.json"), JSON.stringify({ baseUrl, passed: results.length, results, errors }, null, 2));
    if (errors.length) throw new Error("Browser console/runtime or same-origin request failures were detected: " + JSON.stringify(errors));
    console.log(JSON.stringify({ passed: results.length * 2, viewports: results.map(r => r.viewport), screenshots: fs.readdirSync(outDir) }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
