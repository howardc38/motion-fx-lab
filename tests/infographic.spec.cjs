const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

test.use({ viewport: { width: 1920, height: 1080 } });

// Exercise the documented workflow: edit the source arrays, then use the real
// timeline engine. Replacing only data keeps the rendering implementation intact.
async function openFilm(page, file, data, query = "") {
  if (data) {
    let html = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    for (const [name, rows] of Object.entries(data)) {
      const declaration = new RegExp(`const ${name} = \\[[^\\n]+;`);
      if (!declaration.test(html)) throw new Error(`Missing ${name} data in ${file}`);
      html = html.replace(declaration, `const ${name} = ${JSON.stringify(rows)};`);
    }
    await page.route(`**/${file}${query}`, route => route.fulfill({ contentType: "text/html", body: html }));
  }
  await page.goto("/" + file + query);
  await page.evaluate(async () => { await __ready; await __record(); });
}

async function render(page, t) {
  await page.evaluate(t => __render(t), t);
}

const changedData = {
  quarters: [["Q1", 200], ["Q2", 120], ["Q3", 250], ["Q4", 300]],
  drinks: [["Brown sugar", 20, "#ff90e8"], ["Jasmine green", 45, "#ffd400"], ["Oolong milk", 25, "#3b5bff"], ["Other", 10, "#8f8a9c"]],
};

// The intro no longer draws its own chart: it plays examples/infographic.html itself (tests/new-effects.spec.cjs).
const file = "examples/infographic.html";
test(`${file}: default figures keep their authored values`, async ({ page }) => {
  await openFilm(page, file);
  await render(page, 6.8);
  await expect(page.locator("#cups-total")).toHaveText("128,450");
  await render(page, 10.4);
  await expect(page.locator("#leading-share")).toHaveText("38");
  await expect(page.getByRole("img", { name: "Brown sugar: 38%", exact: true })).toBeVisible();
  await expect(page.locator("#quarter-summary")).toHaveText("Every quarter beat the one before.");
  await render(page, 14);
  await expect(page.locator("#peak")).toHaveText("Busiest: 3 pm");
  await expect(page.locator("#dot")).toHaveAttribute("cx", "685");
  await expect(page.locator("#dot")).toHaveAttribute("cy", "100");
});

test(`${file}: changed data updates rendered totals, leading share and annotations`, async ({ page }) => {
  const data = { ...changedData };
  data.hours = [[10, 20], [11, 30], [12, 900], [13, 100], [14, 80], [15, 50], [16, 40], [17, 30], [18, 20], [19, 15], [20, 10], [21, 5], [22, 1]];
  await openFilm(page, file, data);
  await render(page, 6.8);
  await expect(page.locator("#cups-total")).toHaveText("870");
  await expect(page.locator("#bars .v")).toHaveText(["200", "120", "250", "300"]);
  await render(page, 10.4);
  await expect(page.locator("#leading-share")).toHaveText("45");
  await expect(page.getByRole("img", { name: "Jasmine green: 45%", exact: true })).toBeVisible();
  await expect(page.locator("#legend")).toContainText("Jasmine green");
  const secondArc = await page.locator("#donut circle").nth(1).getAttribute("stroke-dasharray");
  expect(Number(secondArc.split(" ")[0])).toBeCloseTo(2 * Math.PI * 80 * 0.45, 2);
  await expect(page.locator("#quarter-summary")).toHaveText("Cups sold by quarter.");
  await render(page, 14);
  await expect(page.locator("#peak")).toHaveText("Busiest: 12 pm");
  await expect(page.locator("#dot")).toHaveAttribute("cx", "310");
  await expect(page.locator("#dot")).toHaveAttribute("cy", "100");
  expect(await page.locator("#peak").evaluate(el => [el.style.left, el.style.top])).toEqual(["500px", "260px"]);
  // Seeking backward must retain the new targets captured by the engine.
  await render(page, 0);
  await render(page, 6.8);
  await expect(page.locator("#cups-total")).toHaveText("870");
});

// Every page of the film ends on one computed sentence whose point is highlighted (mark), and the
// year fills a goal ring. Both formats read the same data.
const insights = (page) => page.locator(".insight").allTextContents();
for (const query of ["", "?format=vertical"]) {
  test(`examples/infographic.html${query}: insights, highlights and the goal ring follow the data`, async ({ page }) => {
    await openFilm(page, "examples/infographic.html", null, query);
    expect(await page.evaluate(() => [__SIZE.w, __SIZE.h])).toEqual(query ? [1080, 1920] : [1920, 1080]);
    await render(page, 6.8);
    await expect(page.locator("#cups-total")).toHaveText("128,450");
    await expect(page.locator("#goal-pct")).toHaveText("107");
    expect(await insights(page)).toEqual([
      "128,450 cups, up every quarter.",
      "Q4 sold 55% more than Q1.",
      "Brown sugar led, 11 points ahead of Jasmine green.",
      "2 pm–6 pm sells 48% of the day's cups.",
    ]);
    // The highlighter grows under the second page's point once its sentence has landed.
    const mark = page.locator(".insight .hl").nth(1);
    expect(await mark.evaluate((el) => el.style.backgroundSize)).toBe("100% 40%");
    await render(page, 5.0);
    expect(await mark.evaluate((el) => el.style.backgroundSize)).toBe("0% 40%");
  });
}

test("examples/infographic.html: changed data rewrites every insight", async ({ page }) => {
  await openFilm(page, "examples/infographic.html", { ...changedData, hours: [[10, 20], [11, 30], [12, 900], [13, 100], [14, 80], [15, 50], [16, 40], [17, 30], [18, 20], [19, 15], [20, 10], [21, 5], [22, 1]] });
  await render(page, 14);
  expect(await insights(page)).toEqual([
    "870 cups, 1% of our goal.",
    "Q4 sold 50% more than Q1.",
    "Jasmine green led, 20 points ahead of Oolong milk.",
    "12 pm–4 pm sells 87% of the day's cups.",
  ]);
  await expect(page.locator("#goal-pct")).toHaveText("1");
});

test("the vertical render wrapper forwards the film's timeline", async ({ page }) => {
  await page.goto("/examples/infographic-vertical.html");
  await page.evaluate(async () => { await __ready; await __record(); await __render(6.8); });
  expect(await page.evaluate(() => [__DUR, __SIZE.w, __SIZE.h, __poster])).toEqual([14.4, 1080, 1920, 9.6]);
  await expect(page.frameLocator("#film").locator("#cups-total")).toHaveText("128,450");
});
