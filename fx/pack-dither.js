// Motion FX Lab: three-ink ordered dither, a building block for the dithered variant of the
// Character shading family (fx/pack-shading.js) and any other scene that wants a pixel-ink look.
// It registers no tiles itself.
//
// A scene is first drawn into a low-resolution "tone" target: red = tone (0 paper, 0.5 ink A,
// 1 ink B), green = solid line, alpha = 0 where nothing was drawn. quantizeMaterial() then maps
// every grid cell to paper, ink A or ink B with a 4 × 4 Bayer threshold, so mid tones become the
// familiar cross-hatched checkerboards. The grid is sized from the render height (cell()), so a
// 1280 × 720 film and a 640 × 360 tile show the same number of cells.
(() => {
  if (!window.FX || !window.THREE) return;
  const BAYER = `float bayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
    float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }`;

  // Size of one dither cell in render pixels: `per720` pixels at a 720-pixel-high render.
  const cell = (renderHeight, per720 = 8) => Math.max(2, (per720 * renderHeight) / 720);

  // Full-screen material that turns a tone target into paper + two inks. `stars` sprinkles a
  // few twinkling cells over the empty upper background; uTime is the twinkle phase in radians,
  // so a looping caller passes a whole number of turns per loop.
  function quantizeMaterial({ tone, grid, paper, inkA, inkB, line, stars = 0 }) {
    const uniforms = {
      tTone: { value: tone }, uLow: { value: new THREE.Vector2(grid.x, grid.y) }, uTime: { value: 0 }, uStars: { value: stars },
      uPaper: { value: new THREE.Color(paper) }, uInkA: { value: new THREE.Color(inkA) }, uInkB: { value: new THREE.Color(inkB) },
      uLine: { value: new THREE.Color(line ?? paper) },
    };
    return new THREE.ShaderMaterial({
      uniforms, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tTone; uniform vec2 uLow; uniform float uTime; uniform float uStars;
        uniform vec3 uPaper; uniform vec3 uInkA; uniform vec3 uInkB; uniform vec3 uLine; varying vec2 vUv;
        ${BAYER}
        float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
        void main(){
          vec2 c = floor(vUv * uLow);
          vec4 e = texture2D(tTone, (c + 0.5) / uLow);
          float v = clamp(e.r, 0.0, 1.0) * 2.0, i = floor(v);
          i += step(bayer4(c) + 0.001, v - i);
          vec3 col = i < 0.5 ? uPaper : (i < 1.5 ? uInkA : uInkB);
          if (e.a < 0.5 && uStars > 0.0 && vUv.y > 0.32) {
            float s = h21(c), tw = 0.5 + 0.5 * sin(uTime + s * 60.0);
            if (s > 1.0 - uStars && tw > 0.35) col = s > 1.0 - uStars * 0.35 ? uInkB : uInkA;
          }
          col = mix(col, uLine, step(0.5, e.g));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
  }
  window.FX.dither = { BAYER, cell, quantizeMaterial };
})();
