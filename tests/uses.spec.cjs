// Use-case films: what they claim, where their words sit, and how their variants render.
const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 1920, height: 1080 } });

async function open(page, url) {
  await page.goto("/" + url);
  await page.evaluate(async () => { await __ready; await __record(); });
}
const render = (page, t) => page.evaluate((t) => __render(t), t);

// Every page lists the library effects it uses (window.__effects, with the seconds they are on screen).
// Each must be on an element of the page, and that element must change while the effect plays.
const PAGES = [
  "examples/product.html", "examples/product.html?format=square",
  "examples/reel.html", "examples/reel.html?shop=bakery", "examples/reel.html?shop=yoga",
  "examples/infographic.html", "examples/infographic.html?format=vertical",
  "examples/broll.html",
  "examples/countdown.html", "examples/countdown.html?format=vertical",
  "examples/spotlight.html", "examples/spotlight.html?format=vertical", "examples/spotlight.html?format=square",
  "examples/titles.html", "examples/titles.html?format=vertical",
];
for (const url of PAGES) {
  test(`${url}: every claimed effect is on the page and moves in its window`, async ({ page }) => {
    test.setTimeout(180000);
    await open(page, url);
    const effects = await page.evaluate(() => window.__effects);
    expect(effects.length).toBeGreaterThan(2);
    const dur = await page.evaluate(() => __DUR);
    for (const { id, at: [a, b] } of effects) {
      expect(a).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(dur); expect(b).toBeGreaterThan(a);
      // data-effect marks the elements that carry a library effect; engine-native ones also show as data-fx.
      const sel = await page.evaluate((id) => document.querySelector(`[data-effect~="${id}"]`) ? `[data-effect~="${id}"]` : `[data-fx="${id}"]`, id);
      expect(await page.locator(sel).count(), `${id} has an element`).toBeGreaterThan(0);
      const states = [];
      for (const t of [a + 0.04, (a + b) / 2, b - 0.04]) {
        await render(page, t);
        states.push(await page.evaluate((sel) => {
          const hash = (s) => { let x = 5381; for (let i = 0; i < s.length; i++) x = (x * 33 + s.charCodeAt(i)) | 0; return x; };
          return [...document.querySelectorAll(sel)].map((el) => hash(el.tagName === "CANVAS" ? el.toDataURL() : el.outerHTML)).join(",");
        }, sel));
      }
      expect(new Set(states).size, `${id} changes between ${a} and ${b} s`).toBeGreaterThan(1);
    }
  });
}

// Words that matter stay out of the bands where Instagram, TikTok and YouTube Shorts draw their own interface
// (their union on a 1080 × 1920 frame), and out of TikTok's right-hand column below y = 840.
const SAFE = { top: 288, bottom: 672, left: 120, right: 192, column: { x: 780, y: 840 } };
async function visibleWords(page, skip) {
  return page.evaluate((skip) => {
    const stage = document.getElementById("stage"), out = [];
    const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      const text = n.textContent.trim(), el = n.parentElement;
      if (!text || (skip && el.closest(skip))) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      let op = 1;
      for (let e = el; e && e !== stage; e = e.parentElement) op *= +getComputedStyle(e).opacity;
      if (op < 0.5) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const b of r.getClientRects()) if (b.width > 2 && b.height > 2) out.push({ text, x0: Math.round(b.left), y0: Math.round(b.top), x1: Math.round(b.right), y1: Math.round(b.bottom) });
    }
    return out;
  }, skip);
}
const outside = (b, W = 1080, H = 1920) => b.x0 < SAFE.left - 1 || b.x1 > W - SAFE.right + 1 || b.y0 < SAFE.top - 1 || b.y1 > H - SAFE.bottom + 1 || (b.y1 > SAFE.column.y && b.x1 > SAFE.column.x + 1);
const VERTICAL = [
  // [page, times when everything on screen has come to rest, elements that are product pictures]
  ["examples/reel.html", [1.7, 3.7, 4.15, 7.1, 9.5, 11.9], ".deco, .art"],
  ["examples/reel.html?shop=bakery", [1.7, 3.7, 4.15, 7.1, 9.5, 11.9], ".deco, .art"],
  ["examples/reel.html?shop=yoga", [1.7, 3.7, 4.15, 7.1, 9.5, 11.9], ".deco, .art"],
  ["examples/countdown.html?format=vertical", [0.9, 6.3, 10.2, 14.6], null],
  // The colourway swatches sit on the floor below the safe area; their names repeat large inside it.
  ["examples/spotlight.html?format=vertical", [3.7, 5.3, 6.5, 9.6], "#bottle, .flip"],
  ["examples/titles.html?format=vertical", [1.0, 3.7, 9.7, 15.7], null],
];
for (const [url, times, skip] of VERTICAL) {
  test(`${url}: important words stay inside the Reels, TikTok and Shorts safe area`, async ({ page }) => {
    await open(page, url);
    expect(await page.evaluate(() => [__SIZE.w, __SIZE.h])).toEqual([1080, 1920]);
    for (const t of times) {
      await render(page, t);
      const words = await visibleWords(page, skip);
      expect(words.length, `words at ${t} s`).toBeGreaterThan(0);
      expect(words.filter((b) => outside(b)), `outside the safe area at ${t} s`).toEqual([]);
    }
  });
}
test("drawn words (3D logo, title word) also stay inside the safe area", async ({ page }) => {
  await open(page, "examples/countdown.html?format=vertical");
  const [x0, y0, x1, y1] = await page.evaluate(() => countdownProof().logoRect);
  expect(outside({ x0, y0, x1, y1 })).toBe(false);
  await open(page, "examples/titles.html?format=vertical");
  const w = await page.evaluate(() => window.__titles.word);
  expect(outside({ x0: w.cx - w.w / 2, y0: w.cy - w.h / 2, x1: w.cx + w.w / 2, y1: w.cy + w.h / 2 })).toBe(false);
});

test("the reel renders three shops from one data block, each with its own copy", async ({ page }) => {
  const seen = [];
  for (const shop of ["tea", "bakery", "yoga"]) {
    await open(page, `examples/reel.html?shop=${shop}`);
    await render(page, 3.7);
    seen.push(await page.locator(".price").textContent());
    await render(page, 11.9);
    await expect(page.locator(".shop").first()).toBeVisible();
  }
  expect(seen).toEqual(["2 for $9", "6 for $18", "First class free"]);
});

test("feature launch: every word on screen is at least 28 px at 1080p", async ({ page }) => {
  await open(page, "examples/product.html");
  for (const t of [1.35, 3.5, 6.9, 9.7, 11.9, 14.5]) {
    await render(page, t);
    const small = await page.evaluate(() => {
      const stage = document.getElementById("stage"), out = [];
      const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode());) {
        const el = n.parentElement;
        if (!n.textContent.trim() || getComputedStyle(el).visibility === "hidden") continue;
        let op = 1;
        for (let e = el; e && e !== stage; e = e.parentElement) op *= +getComputedStyle(e).opacity;
        if (op < 0.5) continue;
        let box = el;
        while (box && !box.offsetHeight) box = box.parentElement;
        const k = box.getBoundingClientRect().height / box.offsetHeight, px = parseFloat(getComputedStyle(el).fontSize) * k;
        if (px < 27.5) out.push([n.textContent.trim(), Math.round(px * 10) / 10]);
      }
      return out;
    });
    expect(small, `text under 28 px at ${t} s`).toEqual([]);
  }
});

test("titles: one preset exports alone as a 6-second film in either format", async ({ page }) => {
  for (const [url, size, ids] of [
    ["examples/titles.html?preset=solid", [1920, 1080], ["cjk-solid", "rays"]],
    ["examples/titles.html?preset=particles&format=vertical", [1080, 1920], ["particles"]],
    ["examples/titles.html?preset=contours", [1920, 1080], ["organic-contours", "frame-glitch"]],
  ]) {
    await open(page, url);
    expect(await page.evaluate(() => [__DUR, __SIZE.w, __SIZE.h])).toEqual([6, ...size]);
    expect(await page.evaluate(() => __effects.map((e) => e.id))).toEqual(ids);
    await render(page, 4);
    expect(await page.evaluate(() => titlesProof().preset)).toBe(new URL(url, "http://x").searchParams.get("preset"));
  }
  await open(page, "examples/titles.html");
  expect(await page.evaluate(() => __DUR)).toBe(18);
});

test("b-roll: each loop's last frame matches its first", async ({ page }) => {
  await open(page, "examples/broll.html");
  await expect(page.locator(".seam .d")).toHaveText(["Δ 0.00%", "Δ 0.00%", "Δ 0.00%"]);
});

// Variants render through small wrapper pages, because video/build.sh takes a file rather than a query.
for (const [wrapper, dur, w, h] of [
  ["product-square", 15, 1080, 1080], ["reel-bakery", 12, 1080, 1920], ["reel-yoga", 12, 1080, 1920],
  ["infographic-vertical", 14.4, 1080, 1920], ["countdown-vertical", 15, 1080, 1920],
  ["spotlight-vertical", 10, 1080, 1920], ["spotlight-square", 10, 1080, 1080], ["titles-vertical", 18, 1080, 1920],
]) {
  test(`examples/${wrapper}.html forwards its film's timeline`, async ({ page }) => {
    await page.goto(`/examples/${wrapper}.html`);
    await page.evaluate(async () => { await __ready; await __record(); await __render(__DUR / 2); });
    expect(await page.evaluate(() => [__DUR, __SIZE.w, __SIZE.h, __effects.length > 0, typeof __cues()])).toEqual([dur, w, h, true, "object"]);
  });
}
