const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

async function openLab(page, mode) {
  await page.goto("/examples/stack-lab/#" + mode);
  await page.waitForFunction(
    () =>
      window.demoLab &&
      document.getElementById("backend").textContent !== "INITIALIZING",
  );
}

test("all six optical effects move and survive backward seeks and shared-context interleaving", async ({
  page,
}) => {
  await page.goto("/examples/optical.html");
  const results = await page.evaluate(() => {
    const { frames, canvas, modes } = opticalDemo;
    opticalDemo.pause();
    return modes.map((mode, i) => {
      frames[i](2.1);
      const first = canvas.toDataURL();
      frames[i](5.4);
      const later = canvas.toDataURL();
      frames.forEach((frame) => frame(6.2));
      frames[i](2.1);
      const again = canvas.toDataURL();
      frames[i](2.1, 0.3);
      const weaker = canvas.toDataURL();
      return {
        mode,
        moves: first !== later,
        repeatable: first === again,
        adjustable: first !== weaker,
      };
    });
  });
  expect(results).toHaveLength(6);
  for (const result of results)
    expect(result, result.mode).toMatchObject({
      moves: true,
      repeatable: true,
      adjustable: true,
    });
});

test("optical export supplies working audio and GIF contracts to the full build", async ({
  page,
}) => {
  await page.goto("/examples/optical.html");
  const spec = await page.evaluate(() => ({
    dur: __DUR,
    cues: __cues(),
    music: window.__music,
    gif: window.__gif,
    poster: __poster,
  }));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "optical-audio-test-"));
  try {
    const cues = path.join(work, "cues.json"),
      audio = path.join(work, "music.wav");
    fs.writeFileSync(cues, JSON.stringify(spec));
    // This is the build's real consumer; a metadata-only assertion missed the
    // missing music plan even though all video-frame tests passed.
    execFileSync(
      "python3",
      [path.resolve(__dirname, "../video/music.py"), cues, audio],
      { timeout: 60000 },
    );
    expect(fs.statSync(audio).size).toBeGreaterThan(48000 * 18);
    expect(spec.gif).toHaveLength(6);
    for (const [start, end] of spec.gif) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(spec.dur);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

test("intro includes all nine additions and atlas playback survives backward seeks", async ({
  page,
}) => {
  await page.goto("/video/intro.html");
  await page.evaluate(async () => {
    __record();
    await __ready;
  });
  const proof = await page.evaluate(() => {
    __render(33);
    const canvases = [...document.querySelectorAll("[data-stack]")];
    const first = canvases.map((c) => c.toDataURL());
    __render(35.7);
    const later = canvases.map((c) => c.toDataURL());
    __render(33);
    const again = canvases.map((c) => c.toDataURL());
    return {
      optical: document.querySelectorAll('[data-demo^="optical-"]').length,
      ids: canvases.map((c) => c.dataset.stack),
      moves: later.map((v, i) => v !== first[i]),
      repeats: again.map((v, i) => v === first[i]),
      duration: __DUR,
      headline: document.getElementById("scLib").textContent,
    };
  });
  expect(proof).toMatchObject({
    optical: 6,
    ids: ["pixi", "rapier", "gpu"],
    moves: [true, true, true],
    repeats: [true, true, true],
    duration: 45.6,
  });
  expect(proof.headline).toContain("60 timeline effects");
});

test("gallery registers six real frame functions and links all three stack demos", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.FX?.DEMOS.length === 60);
  const added = await page.evaluate(() =>
    FX.DEMOS.filter((d) => d.id.startsWith("optical-")).map((d) => ({
      id: d.id,
      frame: typeof d.frame,
      error: !!d.fig.querySelector(".oops"),
    })),
  );
  expect(added).toHaveLength(6);
  for (const entry of added)
    expect(entry).toMatchObject({ frame: "function", error: false });
  for (const mode of ["pixi", "rapier", "gpu"])
    await expect(
      page.locator(`#new-studies a[href="examples/stack-lab/#${mode}"]`),
    ).toBeVisible();
  await page.getByRole("button", { name: "Flubber", exact: true }).click();
  await expect(page.locator("#gallery > figure:visible")).toHaveCount(1);
});

test("missing Flubber fails visibly without disabling Canvas effects", async ({
  page,
}) => {
  await page.route("**/flubber@0.4.2/**", (route) => route.abort());
  await page.goto("/examples/optical.html");
  await page.getByRole("button", { name: "Path morph", exact: true }).click();
  await expect(page.locator("#error")).toContainText("Flubber");
  await page.getByRole("button", { name: "Paper ribbon", exact: true }).click();
  await expect(page.locator("#error")).toBeEmpty();
});

test("Pixi uses three filters, comparison changes pixels, and reselect resets controls", async ({
  page,
}) => {
  await openLab(page, "pixi");
  const result = await page.evaluate(async () => {
    demoLab.pause();
    const d = demoLab.current;
    await d.reset();
    d.update(0.8);
    d.render();
    const filtered = d.canvas.toDataURL(),
      proof = d.proof();
    d.action();
    d.render();
    const original = d.canvas.toDataURL();
    d.action();
    d.render();
    return {
      proof,
      changes: original !== filtered,
      restores: filtered === d.canvas.toDataURL(),
    };
  });
  expect(result).toMatchObject({
    changes: true,
    restores: true,
    proof: {
      library: "8.22.0",
      filterClasses: ["DisplacementFilter", "BlurFilter", "ColorMatrixFilter"],
    },
  });
  await page.locator("#action").click();
  await page.evaluate(() => demoLab.select("pixi"));
  await expect(page.locator("#action")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    await page.evaluate(() => demoLab.current.proof().filterClasses.length),
  ).toBe(3);
});

test("Rapier collision chain propagates to all 48 bodies and reset reproduces poses", async ({
  page,
}) => {
  await openLab(page, "rapier");
  const result = await page.evaluate(() => {
    demoLab.pause();
    const d = demoLab.current;
    d.reset();
    const initial = d.proof();
    d.advanceSteps(240);
    const middle = d.proof();
    d.advanceSteps(660);
    const end = d.proof();
    d.reset();
    d.advanceSteps(900);
    const repeat = d.proof();
    return {
      initial: initial.fallen,
      middle: middle.fallen,
      end: end.fallen,
      version: end.version,
      repeatable:
        JSON.stringify(end.positions) === JSON.stringify(repeat.positions),
    };
  });
  expect(result).toMatchObject({
    initial: 0,
    end: 48,
    repeatable: true,
    version: "0.21.0",
  });
  expect(result.middle).toBeGreaterThan(0);
  expect(result.middle).toBeLessThan(48);
});

test("WebGPU updates GPU storage, stays finite and resets on the same adapter", async ({
  page,
}) => {
  await openLab(page, "gpu");
  const ready = await page.evaluate(() => !!demoLab.current);
  if (!ready && process.env.REQUIRE_WEBGPU !== "1") {
    await expect(page.locator("#backend")).toHaveText(
      "UNAVAILABLE — NO FALLBACK",
    );
    test.skip(
      true,
      "No WebGPU adapter; use REQUIRE_WEBGPU=1 to require this test",
    );
  }
  expect(ready, "A real WebGPU adapter is required").toBe(true);
  const result = await page.evaluate(async () => {
    demoLab.pause();
    const d = demoLab.current;
    await d.reset();
    const initial = await d.proof();
    d.advanceSteps(240);
    const later = await d.proof();
    d.action();
    d.advanceSteps(120);
    const dispersed = await d.proof();
    await d.reset();
    const reset = await d.proof();
    return { initial, later, dispersed, reset };
  });
  expect(result.later).toMatchObject({
    isWebGPU: true,
    backend: "WebGPUBackend",
    count: 65536,
    steps: 240,
    finite: true,
  });
  expect(result.later.sample).not.toEqual(result.initial.sample);
  expect(result.dispersed.finite).toBe(true);
  expect(result.dispersed.sample).not.toEqual(result.later.sample);
  expect(result.reset.sample).toEqual(result.initial.sample);
  await page.locator("#action").click();
  await expect(page.locator("#action")).toHaveText("聚合");
  await page.locator("#reset").click();
  await expect(page.locator("#action")).toHaveText("散開");
});

test("WebGPU unavailability is explicit and another demo can still load", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", {
      value: undefined,
      configurable: true,
    }),
  );
  await openLab(page, "gpu");
  await expect(page.locator("#backend")).toHaveText(
    "UNAVAILABLE — NO FALLBACK",
  );
  await expect(page.locator("#error")).toContainText("WebGPU");
  await page.getByRole("button", { name: /PixiJS/ }).click();
  await expect(page.locator("#backend")).toContainText("PIXI 8.22.0");
  await expect(page.locator("#error")).toBeEmpty();
});

test("stack player fits mobile and pause prevents simulation from advancing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await openLab(page, "pixi");
  const result = await page.evaluate(async () => {
    demoLab.pause();
    const t = demoLab.current.time;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    return {
      width: innerWidth,
      content: document.documentElement.scrollWidth,
      t,
      after: demoLab.current.time,
    };
  });
  expect(result.content).toBeLessThanOrEqual(result.width);
  expect(result.after).toBe(result.t);
});
