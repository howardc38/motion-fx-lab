const { test, expect } = require("@playwright/test");
test("updated pages bypass a cached pre-fluid catalog", async ({ page }) => {
  await page.route("**/fx/catalog.js", route => route.fulfill({
    contentType: "text/javascript",
    body: "throw new Error('Old unversioned catalog was loaded');",
  }));
  for (const url of ["/", "/video/intro.html"]) {
    await page.goto(url);
    await page.waitForFunction(() => window.FXCatalog);
    expect(await page.evaluate(() => FXCatalog.stats)).toEqual({
      techniques: 70, variants: 22, showcases: 5, demos: 97,
    });
  }
});
async function open(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.galleryAPI);
  await page.evaluate(() => galleryAPI.pause());
}
test("featured sequences stay distinct from the film shortlist and single effects", async ({
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
    ids: [...document.querySelectorAll("[data-film-index-id]")].map(
      (f) => f.dataset.filmIndexId,
    ),
    badLinks: [...document.querySelectorAll(".film-effects a")]
      .map((a) => a.hash.slice(6))
      .filter((id) => !FXCatalog.byId.has(id)),
  }));
  expect(p.groups.map((g) => g.films)).toEqual([
    ["reel", "product", "infographic", "broll"],
    ["style-journey", "dot-story", "water-forms"],
  ]);
  expect(new Set(p.ids).size).toBe(12);
  expect(p.ids).toHaveLength(12);
  expect(p.groups.every((g) => g.beforeEffects)).toBe(true);
  expect(p.badLinks).toEqual([]);
  await expect(page.locator(".film-preview img")).toHaveCount(7);
  await expect(page.locator("#film-index")).not.toHaveAttribute("open");
  for (const id of ["fluid-overflow", "fluid-smoke"])
    await expect(page.locator(`[data-film-index-id="${id}"] td`).first()).toHaveText("Single-effect render");
  await expect(page.locator("#composition-presets")).not.toHaveAttribute(
    "open",
  );
});
test("a film link reveals its precise variant and clears incompatible filters", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Characters", exact: true }).click();
  await page.locator('#film-index > summary').click();
  await page.locator('#film-word-forms a[href="#demo-cjk-solid"]').click();
  await expect(page.locator('[data-effect-id="lit3d"] select')).toHaveValue(
    "cjk-solid",
  );
  await expect(page.locator("#fKind button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#shown")).toHaveText(
    "70 / 70 effect families shown",
  );
  await page.goto('/#film-scene-eras');
  await expect(page.locator("#composition-presets")).toHaveAttribute("open");
  await expect(page.locator("#demo-scene-eras")).toBeVisible();
});
test("legacy film links reveal the index and the selected liquid variant links to its own film", async ({ page }) => {
  await page.goto('/#material-films');
  await expect(page.locator('#film-index')).toHaveAttribute('open');
  await page.goto('/#film-fluid-viscous');
  const card=page.locator('#demo-fluid-overflow');
  await expect(card.locator('select')).toHaveValue('fluid-viscous');
  await expect(card.locator('.preview-link a').first()).toHaveAttribute('href', /media\/fluid-viscous\.mp4/);
  await card.locator('select').selectOption('fluid-overflow');
  await expect(card.locator('.preview-link a').first()).toHaveAttribute('href', /media\/fluid-overflow\.mp4/);
});
test("the Film shortlist link reopens the index when its hash is unchanged", async ({ page }) => {
  await open(page);
  await page.locator('nav a[href="#film-index"]').click();
  await expect(page.locator('#film-index')).toHaveAttribute('open');
  await page.locator('#film-index > summary').click();
  await expect(page.locator('#film-index')).not.toHaveAttribute('open');
  await page.locator('nav a[href="#film-index"]').click();
  await expect(page.locator('#film-index')).toHaveAttribute('open');
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

test('the film shortlist contains exactly the twelve selected videos',async({page})=>{
 await open(page);
 const groups=await page.locator('#film-index .film-index-group').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.filmKind,[...n.querySelectorAll('[data-film-index-id]')].map(r=>r.dataset.filmIndexId)])));
 expect(Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length]))).toEqual({sequences:5,uses:4,comparisons:1,studies:2});
 expect(Object.values(groups).flat().sort()).toEqual(['style-journey','dot-story','water-forms','word-forms','dot-battle','reel','product','infographic','broll','fight-effects','fluid-smoke','fluid-overflow'].sort());
});
test('source and renderer variations keep working through their family links and filters',async({page})=>{
 await open(page);
 for(const [id,parent,kind,stack] of [['stack-pixi','liquid','shader','pixi'],['halftonetype','studio-video-dots','type','canvas'],['orbs','gradient','backdrop','css']]){
  await page.evaluate(({kind,stack})=>galleryAPI.filter(kind,stack),{kind,stack});
  const card=page.locator('[data-effect-id="'+parent+'"]');await expect(card).toBeVisible();
  await page.evaluate(async id=>{await galleryAPI.draw(id,1.4)},id);
  await expect(card.locator('select')).toHaveValue(id);await expect(card.locator('.oops')).toHaveCount(0);
  await page.goto('/#demo-'+id);await page.waitForFunction(()=>window.galleryAPI);
  await expect(page.locator('[data-effect-id="'+parent+'"] select')).toHaveValue(id);
 }
});

test('moved film bookmarks lead to related studies with complete playable links',async({page,request})=>{
 for(const [film,demo,parent] of [['ink-city','design-surface-ink','design-surface-ink'],['shadow-lab','design-soft-shadow','design-soft-shadow'],['optical','optical-foil','optical-foil'],['stacks','stack-pixi','liquid'],['scene-eras','scene-eras','scene-eras'],['fluid-viscous','fluid-viscous','fluid-overflow']]){
  await page.goto('/#film-'+film);await page.waitForFunction(()=>window.galleryAPI);
  await expect(page).toHaveURL(new RegExp('#demo-'+demo+'$'));
  const card=page.locator('[data-effect-id="'+parent+'"]');await expect(card).toBeVisible();
  const links=await card.locator('.preview-link a').evaluateAll(as=>as.map(a=>new URL(a.href).pathname));
  expect(links).toEqual(['/media/'+film+'.mp4','/examples/'+film+'.html','/media/'+film+'.gif']);
  for(const path of links) expect((await request.head(path)).ok(),path).toBe(true);
 }
 await page.goto('/#film-intro');await expect(page.locator('#film-intro')).toHaveAttribute('src',/media\/intro\.mp4/);
 await expect(page.locator('[data-film-index-id="intro"]')).toHaveCount(0);
});
test('related samplers follow selected variants without stale film links',async({page})=>{
 await open(page);
 for(const id of ['optical-moire','optical-slit','optical-ribbon','optical-caustic','optical-foil','optical-morph'])await expect(page.locator('[data-effect-id="'+id+'"] .preview-link a').first()).toHaveAttribute('href','media/optical.mp4');
 for(const id of ['stack-rapier','stack-gpu'])await expect(page.locator('[data-effect-id="'+id+'"] .preview-link a').first()).toHaveAttribute('href','media/stacks.mp4');
 await page.evaluate(()=>galleryAPI.selectVariant('stack-pixi'));
 await expect(page.locator('#demo-liquid .preview-link a').first()).toHaveAttribute('href','media/stacks.mp4');
 await page.evaluate(()=>galleryAPI.selectVariant('liquid'));
 await expect(page.locator('#demo-liquid .preview-link a')).toHaveCount(0);
 await page.evaluate(()=>galleryAPI.selectVariant('morph'));
 await expect(page.locator('#demo-optical-morph .preview-link a').first()).toHaveAttribute('href','media/optical.mp4');
});
