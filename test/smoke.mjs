import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = "file://" + path.join(__dirname, "..", "index.html");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(url);
await page.waitForTimeout(400);

function assert(cond, msg) {
  console.log((cond ? "✓ " : "✗ FAIL ") + msg);
  if (!cond) process.exitCode = 1;
}

// Routine ran on load (default 3524 -> 6174 in 3 steps)
await page.waitForSelector("#routine-status .win"); // wait for animation to finish
const stepCount = await page.locator(".step-row").count();
assert(stepCount >= 3, `routine rendered ${stepCount} steps for 3524`);
const status = await page.locator("#routine-status").innerText();
assert(/6174/.test(status) && /3 steps/.test(status), `status mentions 6174 in 3 steps: "${status.trim()}"`);
const spaceInfo = await page.locator("#space-info").innerText();
assert(/6174/.test(spaceInfo), `space summary shows 6174: "${spaceInfo.trim()}"`);
await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(__dirname, "shot-routine.png") });

// Step button
await page.click("#btn-reset");
await page.click("#btn-step");
assert((await page.locator(".step-row").count()) === 1, "step button reveals one row");

// Distribution tab
await page.click('[data-tab="distribution"]');
await page.waitForSelector("#dist-chart svg");
const bars = await page.locator("#dist-chart rect.bar").count();
assert(bars >= 4, `distribution histogram drew ${bars} bars`);
await page.check("#overlay-bases");
await page.waitForSelector("#dist-overlay svg path");
const lines = await page.locator("#dist-overlay path").count();
assert(lines >= 5, `overlay drew ${lines} curves`);
await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(__dirname, "shot-distribution.png") });

// Flow tab — switch to base 10, 3 digits for the 495 funnel
await page.fill("#base", "10");
await page.dispatchEvent("#base", "change");
await page.fill("#digits", "3");
await page.dispatchEvent("#digits", "change");
await page.click('[data-tab="flow"]');
await page.waitForSelector("#flow-chart svg circle");
const nodes = await page.locator("#flow-chart circle").count();
assert(nodes >= 5, `flow graph drew ${nodes} nodes`);
await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(__dirname, "shot-flow.png") });

// Bases & theory tab
await page.click('[data-tab="bases"]');
await page.waitForSelector(".base-cell");
const cells = await page.locator(".base-cell").count();
assert(cells >= 15, `bases table drew ${cells} cells`);
const firstK = await page.locator(".base-cell .k").first().innerText();
assert(firstK.length > 0, `first base constant rendered: ${firstK}`);
await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(__dirname, "shot-bases.png") });

// A space with NO constant should explain itself (base 10, 5 digits)
await page.click('[data-tab="routine"]');
await page.fill("#digits", "5");
await page.dispatchEvent("#digits", "change");
const info5 = await page.locator("#space-info").innerText();
assert(/cycle/i.test(info5), `base10/5-digit reports cycles: "${info5.trim()}"`);

assert(errors.length === 0, `no console/page errors (saw ${errors.length})`);
if (errors.length) errors.forEach((e) => console.log("   " + e));

await browser.close();
console.log(process.exitCode ? "\nSMOKE FAILED" : "\nSMOKE PASSED");
