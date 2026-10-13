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
  // "Clear" drinks advert. Chapters stay under 3.5 s; `effect` names the library study.
  water: Object.freeze({
    ...timeline([
      { id: "drop", duration: 0.8, effect: "water-impact" },
      { id: "crown", duration: 1.2, effect: "water-impact" },
      { id: "form", duration: 2.5, effect: "water-morph" },
      { id: "glass", duration: 3, effect: "water-material" },
      { id: "dive", duration: 3, effect: "water-underwater" },
      { id: "rise", duration: 2, effect: "water-underwater" },
      { id: "endcard", duration: 2.5 },
    ]),
    // Sound design on the action, not on every chapter boundary.
    cues: Object.freeze([
      { t: 0.74, name: "pop", gain: 1.1 },
      { t: 0.8, name: "impact", gain: 0.32 },
      { t: 0.82, name: "whoosh", gain: 0.55 },
      { t: 3.25, name: "riser", gain: 0.9 },
      { t: 4.46, name: "ping", gain: 0.9 },
      { t: 4.9, name: "scan", gain: 1 },
      { t: 7.72, name: "whoosh", gain: 0.9 },
      { t: 7.84, name: "impact", gain: 0.42 },
      { t: 11.32, name: "whoosh", gain: 0.8 },
      { t: 11.4, name: "pop", gain: 0.7 },
      { t: 13.15, name: "pop", gain: 1 },
      { t: 13.2, name: "chime", gain: 1 },
    ]),
    music: Object.freeze([
      [0, "intro"],
      [2.4, "drop"],
      [7.2, "break"],
      [10.8, "final"],
      [13.2, "tail"],
    ]),
  }),
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
