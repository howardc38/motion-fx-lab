// Fixed-FPS image sequences are random-access input, not wall-clock video playback.
export class FrameSource {
  static async load(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Missing frame manifest: " + url);
    const data = await response.json();
    if (
      !(data.fps > 0) ||
      !Number.isInteger(data.count) ||
      data.count < 1 ||
      !data.pattern.includes("%06d")
    )
      throw new Error("Invalid frame manifest");
    return new FrameSource(new URL(".", url), data);
  }
  constructor(base, data) {
    this.base = base;
    this.data = data;
    this.cache = new Map();
  }
  indexAt(t) {
    if (!Number.isFinite(t)) throw new Error("Invalid source time");
    return Math.max(
      0,
      Math.min(this.data.count - 1, Math.floor(t * this.data.fps + 1e-7)),
    );
  }
  async at(t) {
    const index = this.indexAt(t);
    if (!this.cache.has(index)) {
      const image = new Image();
      image.src = new URL(
        this.data.pattern.replace("%06d", String(index).padStart(6, "0")),
        this.base,
      ).href;
      const ready = image.decode().then(() => {
        if (
          image.width !== this.data.width ||
          image.height !== this.data.height
        )
          throw new Error("Frame dimensions disagree with manifest");
        return image;
      });
      this.cache.set(index, ready);
      ready.catch(() => this.cache.delete(index));
    }
    const frame = await this.cache.get(index);
    // Retain only bounded decoded state; evicted frames can always be decoded again.
    while (this.cache.size > 24)
      this.cache.delete(this.cache.keys().next().value);
    return frame;
  }
}
