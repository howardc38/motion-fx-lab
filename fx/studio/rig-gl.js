// GPU drawing for fx/character cutout rigs. It reproduces CutoutRig.draw (same
// joints, skinVertex mesh deformation, rigid part transforms and layer order)
// with textured triangles, instead of one clipped drawImage per triangle, so a
// subject can be redrawn many times per frame (echoes, dot sampling).
import { skinVertex } from "../character/rig.js";

const VS = `#version 300 es
in vec2 aPos; in vec2 aUv; uniform vec2 uSize; out vec2 vUv;
void main(){ vUv=aUv; gl_Position=vec4(aPos.x/uSize.x*2.-1., 1.-aPos.y/uSize.y*2., 0., 1.); }`;
const FS = `#version 300 es
precision mediump float; in vec2 vUv; uniform sampler2D uTex; uniform float uAlpha; uniform vec4 uTint; out vec4 o;
void main(){ vec4 c=texture(uTex,vUv)*uAlpha; o=vec4(mix(c.rgb,uTint.rgb*c.a,uTint.a),c.a); }`;
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const translate = (x, y) => [1, 0, 0, 1, x, y];
const rotate = (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
const scale = (x, y) => [x, 0, 0, y, 0, 0];

let shared;
export function rigRenderer() {
  if (shared) return shared;
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true });
  if (!gl) throw new Error("WebGL2 is required for the studio subject renderer");
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const buffer = gl.createBuffer(), vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const aPos = gl.getAttribLocation(program, "aPos"), aUv = gl.getAttribLocation(program, "aUv");
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
  const U = Object.fromEntries(["uSize", "uTex", "uAlpha", "uTint"].map((n) => [n, gl.getUniformLocation(program, n)]));
  const textures = new WeakMap();
  function texture(image) {
    let t = textures.get(image);
    if (t) return t;
    t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.set(image, t);
    return t;
  }
  let size = [1280, 720];
  const api = {
    canvas,
    // Start a frame of w×h pixels (top-left region of the shared canvas).
    begin(w = 1280, h = 720) {
      size = [w, h];
      gl.viewport(0, canvas.height - h, w, h);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform2f(U.uSize, w, h);
      gl.uniform1i(U.uTex, 0);
      gl.activeTexture(gl.TEXTURE0);
    },
    // Draw a posed rig with its origin at (x, y) in the frame, `s` pixels per rig unit.
    draw(rig, pose, x, y, s, { flip = false, alpha = 1, tint = null } = {}) {
      const d = rig.definition, joints = { ...d.joints, ...pose.joints }, tr = pose.transform || {}, o = d.canvas.origin;
      let m = mul(translate(x, y), scale(s * (flip ? -1 : 1), s));
      m = mul(m, translate(-o[0], -o[1]));
      m = mul(m, translate(o[0] + (tr.x || 0), o[1] + (tr.y || 0)));
      m = mul(m, rotate(tr.rotation || 0));
      m = mul(m, scale(tr.scaleX ?? 1, tr.scaleY ?? 1));
      gl.uniform4f(U.uTint, ...(tint ? [...tint.slice(0, 3).map((v) => v / 255), 1] : [0, 0, 0, 0]));
      for (const p of rig.parts) {
        const iw = p.image.width, ih = p.image.height, verts = [];
        const push = (sx, sy, dx, dy) => verts.push(dx, dy, sx / iw, sy / ih);
        if (p.mesh) {
          const [nx, ny] = p.mesh.grid || [8, 12], grid = [];
          for (let gy = 0; gy <= ny; gy++)
            for (let gx = 0; gx <= nx; gx++) {
              const src = [(gx * iw) / nx, (gy * ih) / ny];
              grid.push([src, apply(m, ...skinVertex(src, p.mesh, joints, grid.length))]);
            }
          for (let gy = 0; gy < ny; gy++)
            for (let gx = 0; gx < nx; gx++) {
              const a = grid[gy * (nx + 1) + gx], b = grid[gy * (nx + 1) + gx + 1], c = grid[(gy + 1) * (nx + 1) + gx], e = grid[(gy + 1) * (nx + 1) + gx + 1];
              for (const v of [a, b, e, a, e, c]) push(v[0][0], v[0][1], v[1][0], v[1][1]);
            }
        } else {
          const A = joints[p.from], B = p.to ? joints[p.to] : null, sc = Array.isArray(p.scale) ? p.scale : [p.scale ?? 1, p.scale ?? 1];
          let q = mul(m, translate(A[0], A[1]));
          q = mul(q, rotate((B ? Math.atan2(B[1] - A[1], B[0] - A[0]) - (p.sourceAngle || 0) : 0) + (p.rotation || 0)));
          q = mul(q, scale(sc[0], sc[1]));
          q = mul(q, translate(-p.pivot[0], -p.pivot[1]));
          const corners = [[0, 0], [iw, 0], [iw, ih], [0, ih]].map(([sx, sy]) => [sx, sy, ...apply(q, sx, sy)]);
          for (const i of [0, 1, 2, 0, 2, 3]) push(...corners[i]);
        }
        gl.bindTexture(gl.TEXTURE_2D, texture(p.image));
        gl.uniform1f(U.uAlpha, alpha * (p.opacity ?? 1));
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, verts.length / 4);
      }
    },
    // Top-down RGBA (premultiplied) pixels of the current frame region.
    read() {
      const [w, h] = size, raw = new Uint8Array(w * h * 4), out = new Uint8ClampedArray(w * h * 4);
      gl.readPixels(0, canvas.height - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      for (let y = 0; y < h; y++) out.set(raw.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      return out;
    },
    // Copy the current frame region onto a 2D context.
    blit(ctx, dx = 0, dy = 0, dw = size[0], dh = size[1]) {
      ctx.drawImage(canvas, 0, 0, size[0], size[1], dx, dy, dw, dh);
    },
  };
  shared = api;
  return api;
}
