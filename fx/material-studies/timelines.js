// One owner for chapter order, boundaries, source clocks and export duration.
export function timeline(chapters, extraCues = []) {
  let start = 0;
  const shots = chapters.map((chapter) => {
    if (!(chapter.duration > 0))
      throw new Error("Chapter duration must be positive");
    const shot = { ...chapter, start, end: start + chapter.duration };
    start = shot.end;
    return Object.freeze(shot);
  });
  return Object.freeze({
    chapters: Object.freeze(shots),
    duration: start,
    cuts: Object.freeze(
      [...extraCues, ...shots.slice(1).map((s) => s.start)].sort(
        (a, b) => a - b,
      ),
    ),
  });
}
export const TIMELINES = Object.freeze({
  water: timeline(
    [
      {
        id: "impact",
        duration: 5.4,
        index: 0,
        offset: 0,
        title: "One drop.",
        sub: "A SMALL EVENT. A WHOLE WORLD OF MOTION.",
      },
      {
        id: "morph",
        duration: 8,
        index: 1,
        offset: 0,
        title: "Many forms.",
        sub: "SPHERE / BLOCK / RING / DROPLETS",
      },
      {
        id: "material",
        duration: 2.8,
        index: 2,
        offset: 1,
        title: "Light gives it depth.",
        sub: "A SURFACE YOU CAN LOOK THROUGH.",
      },
      {
        id: "underwater",
        duration: 5.4,
        index: 3,
        offset: 1.2,
        title: "And another world below.",
        sub: "ONE DROP. MANY FORMS.",
      },
    ],
    [1.35],
  ),
  word: timeline([
    { id: "solid", duration: 5.4 },
    { id: "particles", duration: 3.6 },
    { id: "contours", duration: 3.6 },
    { id: "glitch", duration: 3 },
    { id: "assemble", duration: 3.6 },
    { id: "resolved", duration: 2.4 },
  ]),
  eras: timeline(
    Array.from({ length: 8 }, (_, style) => ({
      id: "style-" + style,
      style,
      duration: 3,
    })),
  ),
});
export function chapterAt(spec, seconds) {
  if (!Number.isFinite(seconds)) throw new Error("Frame time must be finite");
  const t = Math.max(0, Math.min(spec.duration, seconds));
  const index = spec.chapters.findIndex((s) => t < s.end - 1e-9),
    i = index < 0 ? spec.chapters.length - 1 : index,
    chapter = spec.chapters[i];
  return {
    chapter,
    index: i,
    time: t,
    local: t - chapter.start,
    progress: Math.max(0, Math.min(1, (t - chapter.start) / chapter.duration)),
  };
}
