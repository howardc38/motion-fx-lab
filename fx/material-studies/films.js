import { TIMELINES, chapterAt } from "./timelines.js";
import { surface, label, smooth, hash, clamp, time } from "./common.js";
import { create as water } from "./water.js";
import { create as solid, font, mask } from "./type.js";
import { drawContours } from "./contours.js";
import { create as glitch } from "./glitch.js";
import { create as room } from "./eras.js";
export function createWaterFilm() {
  const { canvas, g } = surface(),
    effects = ["impact", "morph", "material", "underwater"].map(water);
  const spec = TIMELINES.water,
    shots = spec.chapters;
  const heads = shots.map((s) => {
    const v = surface();
    label(v.g, s.title, s.sub);
    return v.canvas;
  });
  let proof;
  return {
    canvas,
    frame(seconds) {
      const { chapter: s, index: k, local: elapsed } = chapterAt(spec, seconds),
        local = elapsed + s.offset;
      effects[s.index].frame(local, { labels: false });
      g.drawImage(effects[s.index].canvas, 0, 0);
      g.drawImage(heads[k], 0, 0);
      proof = { shot: k, sourceTime: local, ...effects[s.index].proof() };
    },
    proof: () => proof,
  };
}
export async function createWordFilm({ text = "流動" } = {}) {
  const data = await font(),
    type = await solid(),
    fx = glitch(),
    { canvas, g } = surface(),
    drawing = surface(),
    word = mask(data, text),
    pixels = word.getContext("2d").getImageData(0, 0, 1280, 720).data,
    points = [];
  for (let y = 150; y < 520; y += 5)
    for (let x = 150; x < 1130; x += 5)
      if (pixels[(y * 1280 + x) * 4 + 3] > 100)
        points.push({
          x,
          y,
          a: hash(x + y * 1280) * Math.PI * 2,
          r: 100 + hash(x * 7 + y) * 640,
        });
  const title = surface();
  label(title.g, "One word. Many forms.", "MOTION IN EVERY STROKE");
  let proof;
  return {
    canvas,
    frame(seconds) {
      const { chapter, time: t, progress } = chapterAt(TIMELINES.word, seconds),
        phase = chapter.id;
      const c = drawing.g;
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      c.fillStyle = "#30214f";
      c.fillRect(0, 0, 1280, 720);
      if (phase === "solid") {
        type.frame(t, { text, labels: false });
        c.drawImage(type.canvas, 0, 0);
      } else if (phase === "contours") {
        drawContours(c, t, { background: false, strength: 0.8 });
        c.save();
        c.globalCompositeOperation = "destination-in";
        c.drawImage(word, 0, 0);
        c.restore();
        c.globalCompositeOperation = "destination-over";
        c.fillStyle = "#131b32";
        c.fillRect(0, 0, 1280, 720);
        c.globalCompositeOperation = "source-over";
      } else if (phase === "glitch") {
        type.frame(t * 0.5, { text, labels: false });
        fx.frame(t, {
          source: type.canvas,
          labels: false,
          strength: 0.5 + 0.45 * Math.sin(progress * 12) ** 2,
        });
        c.drawImage(fx.canvas, 0, 0);
      } else if (phase === "resolved") {
        c.drawImage(word, 0, 0);
      } else {
        const amount =
          phase === "particles"
            ? Math.sin(progress * Math.PI) ** 2
            : 1 - smooth(progress / 0.86);
        for (const p of points) {
          const a = p.a + amount * 0.8,
            x = p.x + Math.cos(a) * p.r * amount,
            y = p.y + Math.sin(a) * p.r * amount * 0.6;
          c.fillStyle = hash(p.x + p.y) > 0.5 ? "#ed9dba" : "#f9df9e";
          c.beginPath();
          c.arc(x, y, 2, 0, Math.PI * 2);
          c.fill();
        }
      }
      g.drawImage(drawing.canvas, 0, 0);
      g.drawImage(title.canvas, 0, 0);
      proof = { phase, text, points: points.length, time: t };
    },
    proof: () => proof,
  };
}
export async function create(id, options) {
  if (id === "water") return createWaterFilm();
  if (id === "word") return createWordFilm(options);
  if (id === "eras") return room();
  throw new Error("Unknown film: " + id);
}
