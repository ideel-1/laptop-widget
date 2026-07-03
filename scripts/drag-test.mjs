// one-off interaction check for the editor: click the sticker, drag it,
// screenshot the result (sticker should follow + selection ring + JSON update)
import pkg from "/Users/radu/pw-test/node_modules/playwright-core/index.js";
const { chromium } = pkg;
const browser = await chromium.launch({ args: ["--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:5183/#editor", { waitUntil: "networkidle" });
await page.waitForTimeout(5000);
await page.mouse.move(728, 439);
await page.mouse.down();
await page.mouse.move(560, 520, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(800);
await page.screenshot({ path: process.argv[2] ?? "/tmp/lw-drag.png" });
await browser.close();
console.log("saved");
