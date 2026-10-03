// Screen-grid identities survive color/alpha changes. Geometry-bound samples
// use scene.js's barycentric identities instead of this screen-space grid.
export class PointField {
  sample(data, width, height, spacing = 5) {
    if (
      !Number.isInteger(spacing) ||
      spacing < 1 ||
      data.length !== width * height * 4
    )
      throw new Error("Invalid point-field input");
    const ids = [],
      rgba = [];
    for (let y = 0; y < height; y += spacing)
      for (let x = 0; x < width; x += spacing) {
        const i = y * width + x;
        if (data[i * 4 + 3] < 95) continue;
        ids.push(i);
        rgba.push(
          data[i * 4],
          data[i * 4 + 1],
          data[i * 4 + 2],
          data[i * 4 + 3],
        );
      }
    this.width = width;
    this.ids = Uint32Array.from(ids);
    this.rgba = Uint8Array.from(rgba);
    this.count = ids.length;
    return this;
  }
  xy(i) {
    return [this.ids[i] % this.width, Math.floor(this.ids[i] / this.width)];
  }
}
