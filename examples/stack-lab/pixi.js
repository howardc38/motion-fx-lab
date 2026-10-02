import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@8.22.0/dist/pixi.mjs";
export async function create() {
  const app = new PIXI.Application();
  await app.init({
    width: 1280,
    height: 720,
    resolution: 1,
    antialias: true,
    autoStart: false,
    preference: "webgl",
    background: "#152621",
    preserveDrawingBuffer: true,
  });
  app.stop();
  const art = document.createElement("canvas");
  art.width = 1440;
  art.height = 880;
  const g = art.getContext("2d");
  g.fillStyle = "#dfffbe";
  g.fillRect(0, 0, 1440, 880);
  g.strokeStyle = "#a6c78f";
  g.lineWidth = 1;
  for (let x = 0; x < 1440; x += 44) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 880);
    g.stroke();
  }
  for (let y = 0; y < 880; y += 44) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1440, y);
    g.stroke();
  }
  g.fillStyle = "#174635";
  g.beginPath();
  g.arc(1060, 430, 275, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 24; i++) {
    g.strokeStyle = i % 2 ? "#b7e67f" : "#e6ffbe";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(1060, 430, 35 + i * 9, 260, Math.PI * 0.18, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "#f45e41";
  g.beginPath();
  g.arc(1055, 430, 86, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#153d2c";
  g.font = "700 180px Arial";
  g.fillText("MAKE", 160, 385);
  g.fillText("WAVES.", 152, 552);
  g.font = "500 22px Arial";
  g.fillText("A SMALL CHANGE. A DIFFERENT WORLD.", 166, 665);
  g.font = "500 17px monospace";
  g.fillText("MOTION LAB / MATERIAL STUDY 001", 166, 180);
  g.fillText("PIXIJS 8.22 / LIVE FILTER CHAIN", 166, 737);
  const sprite = new PIXI.Sprite(PIXI.Texture.from(art));
  sprite.position.set(-80, -80);
  app.stage.addChild(sprite);
  const map = document.createElement("canvas");
  map.width = map.height = 192;
  const mg = map.getContext("2d"),
    pixels = mg.createImageData(192, 192),
    mapTexture = PIXI.Texture.from(map),
    mapSprite = new PIXI.Sprite(mapTexture);
  mapSprite.width = 1280;
  mapSprite.height = 720;
  app.stage.addChild(mapSprite);
  const displacement = new PIXI.DisplacementFilter({
      sprite: mapSprite,
      scale: 50,
    }),
    blur = new PIXI.BlurFilter({ strength: 0.3, quality: 3 }),
    grade = new PIXI.ColorMatrixFilter();
  sprite.filters = [displacement, blur, grade];
  sprite.filterArea = new PIXI.Rectangle(80, 80, 1280, 720);
  let t = 0,
    amount = 0.6,
    original = false;
  function updateMap() {
    for (let y = 0; y < 192; y++)
      for (let x = 0; x < 192; x++) {
        const i = (y * 192 + x) * 4,
          xx = (x - 96) / 96,
          yy = (y - 96) / 96,
          r = Math.hypot(xx * 1.7, yy),
          theta = Math.atan2(yy, xx);
        const wave = Math.sin(r * 17 - t * 3.4 + Math.sin(theta * 3 + t) * 0.5);
        pixels.data[i] = 128 + 110 * Math.cos(theta) * wave;
        pixels.data[i + 1] = 128 + 110 * Math.sin(theta) * wave;
        pixels.data[i + 2] = 128;
        pixels.data[i + 3] = 255;
      }
    mg.putImageData(pixels, 0, 0);
    mapTexture.source.update();
    displacement.scale.set(amount * 130, amount * 85);
    blur.strength = amount * 0.75;
    grade.reset();
    grade.saturate(amount * 0.1, false);
  }
  updateMap();
  return {
    canvas: app.canvas,
    backend: "PIXI 8.22.0 · WEBGL",
    get time() {
      return t;
    },
    resize() {},
    update(dt) {
      t += dt;
      updateMap();
    },
    render() {
      app.render();
    },
    reset() {
      t = 0;
      original = false;
      sprite.filters = [displacement, blur, grade];
      updateMap();
    },
    action() {
      original = !original;
      sprite.filters = original ? [] : [displacement, blur, grade];
      return original;
    },
    parameter(v) {
      amount = v;
      updateMap();
    },
    stats: () =>
      original ? "ORIGINAL · FILTERS BYPASSED" : "3 FILTERS · 1280 × 720",
    proof: () => ({
      library: PIXI.VERSION,
      filterClasses: sprite.filters.map((f) => f.constructor.name),
      time: t,
    }),
  };
}
