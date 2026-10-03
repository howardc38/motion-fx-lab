const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

test.use({ viewport: { width: 1920, height: 1080 } });

// Exercise the documented workflow: edit the source arrays, then use the real
// timeline engine. Replacing only data keeps the rendering implementation intact.
async function openFilm(page, file, data) {
  if (data) {
    let html = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    for (const [name, rows] of Object.entries(data)) {
      const declaration = new RegExp(`const ${name} = \\[[^\\n]+;`);
      if (!declaration.test(html)) throw new Error(`Missing ${name} data in ${file}`);
      html = html.replace(declaration, `const ${name} = ${JSON.stringify(rows)};`);
    }
    await page.route(`**/${file}`, route => route.fulfill({ contentType: "text/html", body: html }));
  }
  await page.goto("/" + file);
  await page.evaluate(async () => { await __ready; await __record(); });
}

async function render(page, t) {
  await page.evaluate(t => __render(t), t);
}

const changedData = {
  quarters: [["Q1", 200], ["Q2", 120], ["Q3", 250], ["Q4", 300]],
  drinks: [["Brown sugar", 20, "#ff90e8"], ["Jasmine green", 45, "#ffd400"], ["Oolong milk", 25, "#3b5bff"], ["Other", 10, "#8f8a9c"]],
};

for (const file of ["examples/infographic.html", "video/intro.html"]) {
  const intro = file.startsWith("video/");
  test(`${file}: default figures keep their authored values`, async ({ page }) => {
    await openFilm(page, file);
    await render(page, intro ? 12.8 : 6.8);
    await expect(page.locator("#cups-total")).toHaveText("128,450");
    await render(page, intro ? 12.8 : 10.4);
    await expect(page.locator("#leading-share")).toHaveText("38");
    await expect(page.getByRole("img", { name: "Brown sugar: 38%", exact: true })).toBeVisible();
    if (!intro) {
      await expect(page.locator("#quarter-summary")).toHaveText("Every quarter beat the one before.");
      await render(page, 14);
      await expect(page.locator("#peak")).toHaveText("Busiest: 3 pm");
      await expect(page.locator("#dot")).toHaveAttribute("cx", "685");
      await expect(page.locator("#dot")).toHaveAttribute("cy", "100");
    }
  });

  test(`${file}: changed data updates rendered totals, leading share and annotations`, async ({ page }) => {
    const data = { ...changedData };
    if (!intro) data.hours = [[10, 20], [11, 30], [12, 900], [13, 100], [14, 80], [15, 50], [16, 40], [17, 30], [18, 20], [19, 15], [20, 10], [21, 5], [22, 1]];
    await openFilm(page, file, data);
    await render(page, intro ? 12.8 : 6.8);
    await expect(page.locator("#cups-total")).toHaveText("870");
    await expect(page.locator(intro ? ".qrow .v" : "#bars .v")).toHaveText(["200", "120", "250", "300"]);
    await render(page, intro ? 12.8 : 10.4);
    await expect(page.locator("#leading-share")).toHaveText("45");
    await expect(page.getByRole("img", { name: "Jasmine green: 45%", exact: true })).toBeVisible();
    await expect(page.locator(intro ? "#legs" : "#legend")).toContainText("Jasmine green");
    const secondArc = await page.locator("#donut circle").nth(1).getAttribute("stroke-dasharray");
    expect(Number(secondArc.split(" ")[0])).toBeCloseTo(2 * Math.PI * 80 * 0.45, 2);
    if (!intro) {
      await expect(page.locator("#quarter-summary")).toHaveText("Cups sold by quarter.");
      await render(page, 14);
      await expect(page.locator("#peak")).toHaveText("Busiest: 12 pm");
      await expect(page.locator("#dot")).toHaveAttribute("cx", "310");
      await expect(page.locator("#dot")).toHaveAttribute("cy", "100");
      expect(await page.locator("#peak").evaluate(el => [el.style.left, el.style.top])).toEqual(["500px", "260px"]);
    }
    // Seeking backward must retain the new targets captured by the engine.
    await render(page, 0);
    await render(page, intro ? 12.8 : 6.8);
    await expect(page.locator("#cups-total")).toHaveText("870");
  });
}
