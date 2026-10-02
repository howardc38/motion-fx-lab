// Six optical studies. Every draw is a pure function of time and strength.
// All shader studies share one WebGL context; canvas instances keep no simulation history.
(() => {
  const W = 1120,
    H = 630,
    TAU = Math.PI * 2;
  let sharedGPU;
  function makeGPU() {
    const glCanvas = document.createElement("canvas");
    glCanvas.width = W;
    glCanvas.height = H;
    const gl = glCanvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    let program,
      locations,
      glError = "";
    if (gl) {
      try {
        function shader(type, source) {
          const s = gl.createShader(type);
          gl.shaderSource(s, source);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
            throw new Error(gl.getShaderInfoLog(s));
          return s;
        }
        const vs = shader(
          gl.VERTEX_SHADER,
          "attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}",
        );
        const fs = shader(
          gl.FRAGMENT_SHADER,
          `
        precision highp float;
        uniform vec2 resolution; uniform float time; uniform float amount; uniform int mode;
        uniform vec3 bg; uniform vec3 fg; uniform vec3 ca; uniform vec3 cb; uniform vec3 cc;
        const float PI=3.14159265359;
        vec3 spectrum(float s){float a=.5+.5*sin(s*6.28318);float b=.5+.5*sin(s*6.28318+2.094);return mix(mix(ca,cb,a),cc,b*.7);}
        void main(){
          vec2 uv=gl_FragCoord.xy/resolution;vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.);float a=time*6.283185/8.; vec3 col=bg;
          vec3 light=mix(fg,bg,step(dot(fg,vec3(.299,.587,.114)),dot(bg,vec3(.299,.587,.114))));
          if(mode==0){
            vec2 o1=vec2(-.23+.08*sin(a),.06*cos(a));vec2 o2=vec2(.23+.10*cos(a),.12*sin(a));
            float r1=length(p-o1),r2=length(p-o2);float density=140.+40.*amount;
            float v1=.5+.5*cos(r1*density),v2=.5+.5*cos(r2*density+a*2.);
            float v=pow(max(v1*v2,.00001),.8);float macro=.5+.5*cos((r1-r2)*density);
            col=mix(bg,mix(fg,mix(ca,cb,macro),.65),v*.9);
          }else if(mode==1){
            vec2 q=p*6.;
            q+=vec2(sin(q.y*.8+a),cos(q.x*.7-a))*.85*amount;
            float s=sin(q.x*1.9+sin(q.y*2.+a)*1.3)+sin(q.y*2.3-cos(q.x*1.7-a)*1.4);
            float k=pow(max(0.,1.-abs(s)*.8),12.);
            float s2=sin(q.x*2.1+cos(q.y*1.6-a))+cos(q.y*2.+sin(q.x*1.5+a));
            float k2=pow(max(0.,1.-abs(s2)*.9),18.);
            col=mix(bg,cb,.60+.1*sin(q.y));col=mix(col,mix(light,cb,.06),min(.98,k*.9+k2*.6));
          }else{
            float ang=atan(p.y,p.x),r=length(p);float mask=1.-smoothstep(.363,.368,r);
            float tilt=sin(a)*.4*amount;float sheen=sin(ang*5.+r*20.-a*2.)*.08;
            float phase=ang/6.283185+r*1.8+dot(p,vec2(cos(a),sin(a)))*2.*amount+sheen;
            vec3 foil=spectrum(phase);
            float grooves=.5+.5*sin(r*1250.);foil=mix(foil,fg,grooves*.12);
            float highlight=pow(max(0.,cos(ang-a+tilt)),28.)*.8;
            foil=mix(foil,light,highlight);
            float edge=pow(clamp(r/.366,0.,1.),30.);foil=mix(foil,light,edge*.7);
            float hole=smoothstep(.054,.058,r);mask*=hole;
            col=mix(bg,foil,mask);
          }
          gl_FragColor=vec4(col,1.);
        }
      `,
        );
        program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          throw new Error(gl.getProgramInfoLog(program));
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
          gl.STATIC_DRAW,
        );
        const attr = gl.getAttribLocation(program, "p");
        gl.enableVertexAttribArray(attr);
        gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
        locations = Object.fromEntries(
          [
            "resolution",
            "time",
            "amount",
            "mode",
            "bg",
            "fg",
            "ca",
            "cb",
            "cc",
          ].map((n) => [n, gl.getUniformLocation(program, n)]),
        );
      } catch (e) {
        glError = "GLSL compilation failed: " + e.message;
      }
    } else glError = "WebGL is unavailable for this optical effect.";
    function render(which, t, amp, palette) {
      if (gl && gl.isContextLost())
        throw new Error("Optical WebGL context lost");
      if (glError) {
        throw new Error(glError);
      }
      gl.useProgram(program);
      gl.uniform2f(locations.resolution, W, H);
      gl.uniform1f(locations.time, t);
      gl.uniform1f(locations.amount, amp);
      gl.uniform1i(locations.mode, which);
      [
        ["bg", "bg"],
        ["fg", "fg"],
        ["ca", "a"],
        ["cb", "b"],
        ["cc", "c"],
      ].forEach(([u, c]) =>
        gl.uniform3fv(
          locations[u],
          palette[c].map((v) => v / 255),
        ),
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return glCanvas;
    }

    return { render };
  }
  function create(canvas, mode) {
    if (!["moire", "slit", "ribbon", "caustic", "foil", "morph"].includes(mode))
      throw new Error("Unknown optical effect: " + mode);
    const ctx = canvas.getContext("2d");
    const palette = {
      bg: [10, 15, 20],
      fg: [240, 245, 241],
      a: [180, 118, 255],
      b: [71, 155, 244],
      c: [255, 156, 94],
    };
    let t = 0,
      amp = 1;
    function gpu(which) {
      sharedGPU ||= makeGPU();
      ctx.drawImage(sharedGPU.render(which, t, amp, palette), 0, 0, W, H);
    }
    const rgb = (c) => "rgb(" + c.map(Math.round).join(",") + ")";
    const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    const ease = (x) => x * x * (3 - 2 * x);
    function text(txt, x, y, size, col, align = "left") {
      ctx.fillStyle = rgb(col);
      ctx.textAlign = align;
      ctx.font = "500 " + size + "px Arial, sans-serif";
      ctx.fillText(txt, x, y);
    }
    function clear() {
      ctx.globalAlpha = 1;
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      ctx.fillStyle = rgb(palette.bg);
      ctx.fillRect(0, 0, W, H);
    }
    function label(a, b) {
      text(a, 40, 48, 17, palette.fg);
      text(b, W - 40, H - 30, 16, palette.fg, "right");
    }
    const source = document.createElement("canvas");
    source.width = W;
    source.height = H;
    const sg = source.getContext("2d");
    function slit() {
      const a = (t * TAU) / 8;
      sg.clearRect(0, 0, W, H);
      sg.fillStyle = rgb(palette.fg);
      sg.textAlign = "center";
      sg.font = "500 210px Arial, sans-serif";
      sg.fillText("FLOW", W / 2, 360);
      for (let y = 90; y < 480; y += 3) {
        const phase = a * 2 + (y / H) * 4.5 * amp;
        const dx = Math.sin(phase) * 125 * amp;
        const scale = 0.88 + 0.15 * Math.cos(phase + 0.7);
        ctx.drawImage(
          source,
          0,
          y,
          W,
          3,
          dx + (W * (1 - scale)) / 2,
          y,
          W * scale,
          3,
        );
      }
      ctx.globalAlpha = 0.65;
      for (let y = 110; y < 470; y += 15) {
        ctx.fillStyle = rgb(mix(palette.a, palette.b, y / H));
        ctx.fillRect(45, y, 7, 3);
      }
      ctx.globalAlpha = 1;
      text("TIME / SPACE", 40, 545, 30, palette.a);
      label("02 / SLIT SCAN", "CANVAS · TIME-OFFSET SLICES");
    }
    function ribbon() {
      const a = (t * TAU) / 8,
        faces = [];
      function p(u, v) {
        let x = (u - 0.5) * 820,
          y = Math.sin(u * TAU * 1.4 + a) * 55 * amp;
        const roll = Math.sin(u * TAU - a) * 1.25 * amp + u * 4;
        y += Math.cos(roll) * v * 110;
        let z = Math.sin(roll) * v * 110 + Math.cos(u * TAU + a) * 80;
        const tilt = 0.24;
        const yy = y * Math.cos(tilt) - z * Math.sin(tilt);
        const zz = y * Math.sin(tilt) + z * Math.cos(tilt);
        const s = 900 / (900 - zz);
        return { x: W / 2 + x * s, y: H / 2 + yy * s, z: zz };
      }
      for (let i = 0; i < 86; i++) {
        let u = i / 86;
        const v = [p(u, -1), p(u + 1 / 86, -1), p(u + 1 / 86, 1), p(u, 1)];
        const shade =
          0.5 + 0.5 * Math.cos(Math.sin(u * TAU - a) * 1.25 * amp + u * 4);
        faces.push({ v, z: v.reduce((s, p) => s + p.z, 0) / 4, u, shade });
      }
      faces.sort((a, b) => a.z - b.z);
      for (const f of faces) {
        const base = mix(palette.a, palette.b, f.u);
        const col = mix(
          mix(palette.bg, base, 0.55),
          mix(base, palette.fg, 0.4),
          f.shade,
        );
        ctx.fillStyle = rgb(col);
        ctx.strokeStyle = rgb(col);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        f.v.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (Math.floor(f.u * 86) % 7 === 0) {
          ctx.strokeStyle = rgb(mix(col, palette.fg, 0.36));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(f.v[0].x, f.v[0].y);
          ctx.lineTo(f.v[3].x, f.v[3].y);
          ctx.stroke();
        }
      }
      text("FOLD / UNFOLD", 40, 546, 36, palette.fg);
      label("03 / PAPER RIBBON", "PROJECTED GEOMETRY · NO PHYSICS");
    }
    const shapes = [
      "M-130,-110 L-40,-110 L0,-20 L40,-110 L130,-110 L130,110 L45,110 L45,10 L0,95 L-45,10 L-45,110 L-130,110 Z",
      "M-5,-155 L-135,25 L-25,25 L-55,155 L140,-45 L25,-45 L80,-155 Z",
      "M0,130 C-200,5 -140,-150 -45,-90 C-18,-75 0,-52 0,-52 C0,-52 18,-75 45,-90 C140,-150 200,5 0,130 Z",
    ];
    let interpolators = [];
    if (mode === "morph" && window.flubber) {
      interpolators = shapes.map((s, i) =>
        window.flubber.interpolate(s, shapes[(i + 1) % 3], {
          maxSegmentLength: 6,
        }),
      );
    }
    function morph() {
      if (!interpolators.length) {
        throw new Error("Flubber 0.4.2 failed to load");
      }
      const phase = (t / 8) * 3,
        i = Math.floor(phase) % 3,
        f = phase - Math.floor(phase),
        v = ease(Math.max(0, Math.min(1, (f - 0.15) / 0.7)));
      const path = new Path2D(interpolators[i](v));
      for (let j = 9; j >= 0; j--) {
        ctx.save();
        ctx.translate(W / 2 - j * 9 * amp, H / 2 + j * 6 * amp);
        ctx.scale(1.15, 1.15);
        ctx.fillStyle = rgb(
          j === 0
            ? palette.fg
            : mix(
                palette.bg,
                mix(palette.a, palette.b, j / 9),
                0.9 - j * 0.065,
              ),
        );
        ctx.fill(path);
        ctx.restore();
      }
      label("06 / SHAPE LANGUAGE", "FLUBBER 0.4.2 · ARBITRARY PATHS");
      text(
        ["MONOGRAM → ENERGY", "ENERGY → LOVE", "LOVE → MONOGRAM"][i],
        40,
        548,
        28,
        palette.a,
      );
    }
    function draw() {
      clear();
      if (mode === "moire") {
        gpu(0);
        label("01 / OPTICAL INTERFERENCE", "GLSL · TWO WAVE FIELDS");
      }
      if (mode === "slit") slit();
      if (mode === "ribbon") ribbon();
      if (mode === "caustic") {
        gpu(1);
        text("AFTER", W / 2, 295, 88, palette.fg, "center");
        text("THE RAIN", W / 2, 389, 88, palette.fg, "center");
        label("04 / CAUSTIC LIGHT", "PROCEDURAL WATER LIGHT");
      }
      if (mode === "foil") {
        gpu(2);
        text("SPECTRUM", 40, 545, 34, palette.fg);
        label("05 / HOLOGRAPHIC FOIL", "GLSL · IRIDESCENT DISC");
      }
      if (mode === "morph") morph();
    }
    return (time, strength = 1) => {
      if (!Number.isFinite(time) || !Number.isFinite(strength))
        throw new Error("Optical time and strength must be finite");
      t = ((time % 8) + 8) % 8;
      amp = Math.max(0.25, Math.min(1.5, strength));
      draw();
    };
  }
  window.FXOptical = { create };
})();
