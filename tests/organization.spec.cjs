const { test, expect } = require("@playwright/test");
async function open(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.galleryAPI);
  await page.evaluate(() => galleryAPI.pause());
}
test("all published films have one purpose group before the effect library", async ({
  page,
}) => {
  await open(page);
  const p = await page.evaluate(() => ({
    groups: [...document.querySelectorAll(".film-group")].map((g) => ({
      id: g.id,
      films: [...g.querySelectorAll("[data-film-id]")].map(
        (f) => f.dataset.filmId,
      ),
      beforeEffects: !!(
        g.compareDocumentPosition(document.getElementById("effects")) &
        Node.DOCUMENT_POSITION_FOLLOWING
      ),
    })),
    ids: [...document.querySelectorAll("[data-film-id]")].map(
      (f) => f.dataset.filmId,
    ),
    badLinks: [...document.querySelectorAll(".film-effects a")]
      .map((a) => a.hash.slice(6))
      .filter((id) => !FXCatalog.byId.has(id)),
  }));
  expect(p.groups.map((g) => g.films)).toEqual([
    ["reel", "product", "infographic", "broll"],
    ["word-forms", "water-forms", "fluid-overflow", "fluid-viscous", "fluid-smoke"],
    ["style-journey", "scene-eras", "dot-battle"],
    ["fight-effects", "optical", "stacks"],
  ]);
  expect(new Set(p.ids).size).toBe(16);
  expect(p.ids).toHaveLength(16);
  expect(p.groups.every((g) => g.beforeEffects)).toBe(true);
  expect(p.badLinks).toEqual([]);
  await expect(page.locator(".film-preview img")).toHaveCount(15);
  await expect(page.locator("#composition-presets")).not.toHaveAttribute(
    "open",
  );
});
test("a film link reveals its precise variant and clears incompatible filters", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Characters", exact: true }).click();
  await page.locator('#film-word-forms a[href="#demo-cjk-solid"]').click();
  await expect(page.locator('[data-effect-id="lit3d"] select')).toHaveValue(
    "cjk-solid",
  );
  await expect(page.locator("#fKind button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#shown")).toHaveText(
    "69 / 69 effect families shown",
  );
  await page.locator('#film-scene-eras a[href="#demo-scene-eras"]').click();
  await expect(page.locator("#composition-presets")).toHaveAttribute("open");
  await expect(page.locator("#demo-scene-eras")).toBeVisible();
});
test("fight studies compare real input and output, with separate pose and camera clocks", async ({
  page,
}) => {
  await open(page);
  const p = await page.evaluate(async () => {
    const out = [];
    for (const [id, spec] of Object.entries(FXStudio.previews)) {
      const e = await FXStudio.preview(id);
      await e.frame(spec.hero);
      const first = e.canvas.toDataURL(),
        proof = e.proof();
      const g = e.canvas.getContext("2d");
      const a = g.getImageData(40, 212, 576, 324).data,
        b = g.getImageData(664, 212, 576, 324).data;
      let different = 0;
      for (let i = 0; i < a.length; i += 4)
        if (
          Math.abs(a[i] - b[i]) +
            Math.abs(a[i + 1] - b[i + 1]) +
            Math.abs(a[i + 2] - b[i + 2]) >
          25
        )
          different++;
      await e.frame(spec.hero + 1);
      await e.frame(spec.hero);
      out.push({
        id,
        proof,
        repeat: first === e.canvas.toDataURL(),
        different,
      });
    }
    return out;
  });
  for (const row of p) {
    expect(row.repeat, row.id).toBe(true);
    expect(row.different, row.id).toBeGreaterThan(30);
  }
  const orbit = p.find((x) => x.id === "freeze-orbit").proof;
  expect(orbit.reference.sourceTime).toBe(orbit.effect.sourceTime);
  expect(orbit.reference.camera).not.toEqual(orbit.effect.camera);
  const clock = p.find((x) => x.id === "time-remap").proof;
  expect(clock.reference.sourceIndex).not.toBe(clock.effect.sourceIndex);
  const relief = p.find((x) => x.id === "depth-dots").proof;
  expect(relief.reference.sourceIndex).toBe(relief.effect.sourceIndex);
  expect(relief.effect.depth).toContain("not recovered");
});
test("expanded study player can switch between the comparison and reusable raw output", async ({
  page,
}) => {
  await page.goto("/examples/studio.html?compare=1#freeze-orbit");
  await page.waitForFunction(() => window.studio?.current);
  await expect(page.locator("#compare")).toBeChecked();
  expect(await page.evaluate(() => studio.current.proof().id)).toBe(
    "freeze-orbit",
  );
  await page.locator("#compare").uncheck();
  await page.waitForFunction(
    () => window.studio?.current?.proof()?.choreography === "COUNTERFORM",
  );
});

test("comparison metadata covers exactly the dot studies and stays separate from raw instructions", async ({
  page,
}) => {
  await open(page);
  const p = await page.evaluate(() => ({
    ids: Object.keys(FXStudio.previews).sort(),
    raw: FXStudio.studies
      .filter((s) => ["dot-impact", "particle-lens"].includes(s.id))
      .map((s) => s.purpose),
  }));
  expect(p.ids).toEqual(
    [
      "video-dots",
      "dot-rhythm",
      "dot-impact",
      "echo",
      "time-remap",
      "depth-dots",
      "skin-cloud",
      "freeze-orbit",
      "particle-lens",
    ].sort(),
  );
  p.raw.forEach((s) => expect(s).not.toContain("both panes"));
});
test("presentation mode round-trips through the studio URL", async ({
  page,
}) => {
  await page.goto("/examples/studio.html?compare=1#dot-impact");
  await page.waitForFunction(() => window.studio?.current);
  await expect(page.locator("#description")).toContainText("close-up");
  await page.locator("#compare").uncheck();
  await expect(page).not.toHaveURL(/compare=1/);
  await page.reload();
  await page.waitForFunction(() => window.studio?.current);
  await expect(page.locator("#compare")).not.toBeChecked();
  await expect(page.locator("#description")).not.toContainText("close-up");
  await page.locator("#compare").check();
  await expect(page).toHaveURL(/compare=1/);
  await page.reload();
  await page.waitForFunction(() => window.studio?.current);
  await expect(page.locator("#compare")).toBeChecked();
});
test("switching presentation during an unfinished seek renders the newly selected canvas", async ({
  page,
}) => {
  await page.goto("/examples/studio.html#video-dots");
  await page.waitForFunction(() => window.studio?.current);
  await page.locator("#seek").evaluate((el) => {
    el.value = "0.1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#clock")).toHaveText("0.10 s");
  await page.evaluate(async () => {
    const original = studio.current.frame.bind(studio.current);
    window.framePending = false;
    studio.current.frame = async (...args) => {
      window.framePending = true;
      await new Promise((r) => (window.releaseFrame = r));
      return original(...args);
    };
    const originalPreview = FXStudio.preview;
    FXStudio.preview = async (id) => {
      const e = await originalPreview(id),
        frame = e.frame.bind(e);
      window.comparisonRenders = 0;
      e.frame = async (...args) => {
        await frame(...args);
        window.comparisonRenders++;
      };
      return e;
    };
  });
  await page.locator("#seek").evaluate((el) => {
    el.value = "0";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => window.framePending);
  await page.locator("#compare").check();
  await page.waitForFunction(
    () =>
      window.comparisonRenders === 0 &&
      window.studio?.current &&
      !studio.current.proof(),
  );
  await page.evaluate(() => window.releaseFrame());
  await page.waitForFunction(() => window.comparisonRenders > 0);
  await expect(page.locator("#clock")).toHaveText("0.00 s");
});
