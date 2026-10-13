// What the home page downloads before anyone scrolls (D5: target at most 2.5 MB). Measured with the cache
// off and motion allowed, so card loops on screen would start. The local test server sends files
// uncompressed while GitHub Pages compresses text; the budget therefore applies to the bytes Pages would
// send (local text gzipped, everything else as transferred), and the uncompressed total is reported too.
const { test, expect } = require('@playwright/test');
const zlib = require('node:zlib');
const BUDGET = 2_500_000;

for (const [label, viewport, mobile] of [['desktop 1440', { width: 1440, height: 900 }, false], ['phone 390', { width: 390, height: 844 }, true]]) {
  test(`first screen of the home page (${label}) stays within ${BUDGET / 1e6} MB`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 2, reducedMotion: 'no-preference' });
    try {
      const page = await context.newPage(), cdp = await context.newCDPSession(page), seen = new Map();
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      cdp.on('Network.responseReceived', e => seen.set(e.requestId, { ...seen.get(e.requestId), url: e.response.url, mime: e.response.mimeType, encoded: Object.keys(e.response.headers).some(h => h.toLowerCase() === 'content-encoding') }));
      cdp.on('Network.loadingFinished', e => seen.set(e.requestId, { ...seen.get(e.requestId), bytes: e.encodedDataLength }));
      await page.goto('/', { waitUntil: 'load' });
      await page.waitForTimeout(4000);
      let raw = 0, pages = 0, loops = 0;
      for (const [id, r] of seen) {
        if (!r.url || r.bytes === undefined) continue;
        raw += r.bytes;
        let sent = r.bytes;
        if (r.url.startsWith(baseURL) && !r.encoded && /text|javascript|json|css|svg/.test(r.mime || '')) {
          const body = await cdp.send('Network.getResponseBody', { requestId: id }).catch(() => null);
          if (body) sent = zlib.gzipSync(Buffer.from(body.body, body.base64Encoded ? 'base64' : 'utf8')).length + 300;
        }
        pages += sent;
        if (/\.preview\.mp4/.test(r.url)) loops++;
      }
      const report = { viewport: label, requests: seen.size, uncompressed: raw, pagesEstimate: pages, cardLoopsStarted: loops };
      await info.attach('first-screen.json', { body: JSON.stringify(report, null, 1), contentType: 'application/json' });
      console.log('first screen', JSON.stringify(report));
      expect(pages, JSON.stringify(report)).toBeLessThanOrEqual(BUDGET);
      // No GIF is fetched any more; card loops load only when a card is on screen.
      expect([...seen.values()].filter(r => /\.gif(\?|$)/.test(r.url || ''))).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test('card loops play only on screen and never with reduced motion', async ({ browser }) => {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: motion });
    try {
      const page = await context.newPage();
      await page.goto('/');
      const loops = page.locator('video.film-loop');
      expect(await loops.count()).toBeGreaterThan(0);
      for (const v of await loops.all()) {
        expect(await v.getAttribute('preload')).toBe('none');
        // Posters are lazy: data-poster until the card is near the screen, then poster.
        expect((await v.getAttribute('poster')) ?? (await v.getAttribute('data-poster'))).toMatch(/^media\/[a-z0-9-]+\.jpg/);
        expect(await v.getAttribute('src')).toMatch(/^media\/[a-z0-9-]+\.preview\.mp4$/);
        expect(await v.evaluate(el => el.muted && el.loop && el.playsInline && !el.autoplay)).toBe(true);
      }
      const first = page.locator('#film-reel video.film-loop'), last = page.locator('#film-fight-effects video.film-loop');
      // A card far below the first screen has not fetched its poster yet; scrolling to it sets the poster.
      expect(await last.getAttribute('poster')).toBeNull();
      expect(await last.getAttribute('data-poster')).toMatch(/^media\/fight-effects\.jpg/);
      await first.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      const playing = el => el.evaluate(v => !v.paused);
      if (motion === 'reduce') {
        expect(await playing(first)).toBe(false);
        expect(await first.evaluate(v => v.readyState)).toBe(0);   // never fetched: the poster is all it shows
      } else {
        await expect.poll(() => playing(first)).toBe(true);
        expect(await playing(last)).toBe(false);
        await last.scrollIntoViewIfNeeded();
        await expect.poll(() => last.getAttribute('poster')).toMatch(/^media\/fight-effects\.jpg/);
        await expect.poll(() => playing(last)).toBe(true);
        await expect.poll(() => playing(first)).toBe(false);
      }
    } finally {
      await context.close();
    }
  }
});
