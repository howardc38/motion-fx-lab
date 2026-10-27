// Six optical effects. Every draw is a pure function of (time, strength).
// Canvas 2D effects lay out in 1120 x 630 logical units and scale to the target canvas;
// the shader effects share one WebGL context that is resized to the target canvas, so
// line widths, grating periods and sparkle sizes all follow the render size.
(() => {
  const W = 1120,
    H = 630,
    TAU = Math.PI * 2,
    DEG = Math.PI / 180;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
  const ramp = (a, b, x) => smooth((x - a) / (b - a));
  const inOutCubic = (x) => {
    x = clamp(x);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const outCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const inCubic = (x) => Math.pow(clamp(x), 3);
  const bump = (a, b, x) => (x <= a || x >= b ? 0 : Math.pow(Math.sin((Math.PI * (x - a)) / (b - a)), 2));
  // Damped spring step: 0 before t=0, settles at 1 with one visible overshoot.
  function spring(t, period = 0.34, damping = 0.5) {
    if (t <= 0) return 0;
    const w = TAU / period,
      wd = w * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
  }

  // ---------------------------------------------------------------- shared WebGL
  const GLSL_COMMON = `
    precision highp float;
    float sdBox(vec2 q, vec2 b, float r){vec2 d=abs(q)-b+r;return length(max(d,0.))+min(max(d.x,d.y),0.)-r;}
    float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
    vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
  `;
  const SHADERS = {
    // Unchanged look: flowing bands of water light.
    caustic: `
      uniform vec2 resolution; uniform float time; uniform float amount;
      uniform vec3 bg; uniform vec3 fg; uniform vec3 cb;
      void main(){
        vec2 uv=gl_FragCoord.xy/resolution;vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.);float a=time*6.283185/8.;
        vec3 light=mix(fg,bg,step(dot(fg,vec3(.299,.587,.114)),dot(bg,vec3(.299,.587,.114))));
        vec2 q=p*6.;
        q+=vec2(sin(q.y*.8+a),cos(q.x*.7-a))*.85*amount;
        float s=sin(q.x*1.9+sin(q.y*2.+a)*1.3)+sin(q.y*2.3-cos(q.x*1.7-a)*1.4);
        float k=pow(max(0.,1.-abs(s)*.8),12.);
        float s2=sin(q.x*2.1+cos(q.y*1.6-a))+cos(q.y*2.+sin(q.x*1.5+a));
        float k2=pow(max(0.,1.-abs(s2)*.9),18.);
        vec3 col=mix(bg,cb,.60+.1*sin(q.y));col=mix(col,mix(light,cb,.06),min(.98,k*.9+k2*.6));
        gl_FragColor=vec4(col,1.);
      }`,
    // Holographic trading card: perspective card, embossed faceted star, sunburst foil,
    // a full-spectrum band that follows the reflection angle, and angle-keyed glitter flakes.
    foil: `
      uniform vec2 res; uniform vec2 rot; uniform float vel; uniform float amount; uniform float m0; uniform float spill;
      uniform sampler2D print;
      const float D=3.0, F=2.0;
      const vec2 HALF=vec2(.3393,.475);
      const vec3 LIGHT=vec3(-1.5,1.4,2.8);
      const vec2 SWEEP=vec2(.9535,.3015);
      const vec2 STAR=vec2(0.,.065);
      float sdStar5(vec2 p,float r,float rf){
        const vec2 k1=vec2(.809016994375,-.587785252292);const vec2 k2=vec2(-k1.x,k1.y);
        p.x=abs(p.x);p-=2.*max(dot(k1,p),0.)*k1;p-=2.*max(dot(k2,p),0.)*k2;p.x=abs(p.x);p.y-=r;
        vec2 ba=rf*vec2(-k1.y,k1.x)-vec2(0,1);float h=clamp(dot(p,ba)/dot(ba,ba),0.,r);
        return length(p-ba*h)*sign(p.y*ba.x-p.x*ba.y);
      }
      float star(vec2 c){return sdStar5(c-STAR,.215,.46);}
      mat3 basis(){float cy=cos(rot.x),sy=sin(rot.x),cx=cos(rot.y),sx=sin(rot.y);
        return mat3(cy,0.,-sy,0.,1.,0.,sy,0.,cy)*mat3(1.,0.,0.,0.,cx,sx,0.,-sx,cx);}
      vec3 hit(vec2 p,mat3 R,out vec3 X){vec3 o=vec3(0.,0.,D);vec3 d=normalize(vec3(p,-F));float s=-dot(o,R[2])/dot(d,R[2]);X=o+s*d;return vec3(dot(X,R[0]),dot(X,R[1]),s);}
      float sweepAt(vec3 X,mat3 R){vec3 V=normalize(vec3(0.,0.,D)-X),L=normalize(LIGHT-X);vec3 Hh=normalize(V+L);return dot(vec2(dot(Hh,R[0]),dot(Hh,R[1])),SWEEP)-m0;}
      vec3 spectrum(float h){return clamp(.5+.5*cos(6.28318*(h+vec3(0.,.333,.667))),0.,1.);}
      void main(){
        vec2 p=(gl_FragCoord.xy-.5*res)/res.y;float px=1./res.y;
        mat3 R=basis();
        vec3 col=vec3(.026,.029,.036)+vec3(.085,.088,.10)*exp(-dot(p-vec2(-.12,.14),p-vec2(-.12,.14))*2.4);
        col*=1.-.22*dot(p,p);
        vec3 Xs;vec3 hs=hit(p-vec2(.05,-.06),R,Xs);
        col*=1.-.6*(1.-smoothstep(-.05,.11,sdBox(hs.xy,HALF,.045)));
        vec3 X;vec3 h=hit(p,R,X);vec2 c=h.xy;
        float pw=h.z*px/F;
        float sd=sdBox(c,HALF,.045);
        float halo=spill*exp(-max(sd,0.)*7.);
        col+=.16*halo*spectrum(atan(p.y,p.x)/6.28318+.15);
        float mask=1.-smoothstep(-pw,pw,sd);
        if(mask>0.){
          vec3 V=normalize(vec3(0.,0.,D)-X),L=normalize(LIGHT-X);vec3 Hh=normalize(V+L);
          vec2 Hl=vec2(dot(Hh,R[0]),dot(Hh,R[1]));
          float st=star(c);float e=.0016;
          vec2 g=vec2(star(c+vec2(e,0.))-star(c-vec2(e,0.)),star(c+vec2(0.,e))-star(c-vec2(0.,e)))/(2.*e);
          float inStar=1.-smoothstep(-pw,pw,st);
          vec2 tilt=g*.24*inStar;
          float ang=atan(c.y-STAR.y,c.x-STAR.x);
          float sector=floor((ang+3.14159)/(6.28318/40.));
          float secOff=(hash12(vec2(sector,7.))-.5)*(1.-inStar);
          float m=dot(Hl-tilt,SWEEP)-m0+secOff*.035;
          float sigma=dot(c/HALF,SWEEP);
          vec3 rb=spectrum(2.4*m-.75*sigma+secOff*.12+.05);
          float band=exp(-m*m/(.085*.085));
          float lp=.008;float vis=clamp((lp/pw-2.2)/1.5,0.,1.);
          float groove=.5+.5*cos(6.28318*dot(c,SWEEP)/lp);
          vec3 Nw=normalize(R*vec3(-tilt,1.));
          float diff=max(0.,dot(Nw,L));
          vec3 fc=vec3(.07,.075,.09)+vec3(.12,.12,.13)*diff;
          fc+=.07*amount*spectrum(1.1*m+.3*sigma+.4)*(.4+.6*smoothstep(.45,0.,abs(m)));
          fc+=rb*band*(1.-.22*vis*groove)*1.15*amount;
          float glint=exp(-pow((m-.018)/.016,2.));
          fc+=vec3(glint)*(.55+.4*amount);
          fc+=vec3(.5)*smoothstep(.006,0.,abs(st))*inStar*(.3+.7*diff);
          float cs=.0185;vec2 cell=floor(c/cs);float spark=0.;float win=.006+vel*.022;
          float core=max(.0032,pw*1.1),thin=max(.0016,pw*.8);
          for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){
            vec2 id=cell+vec2(float(i),float(j));
            if(hash12(id+17.)>.13)continue;
            vec2 fp=(id+.2+.6*hash22(id+3.))*cs;
            if(sdBox(fp,HALF-.025,.03)>0.)continue;
            vec3 Xf=R[0]*fp.x+R[1]*fp.y;
            float a=(hash12(id+41.)-.5)*.34;
            float I=exp(-pow((sweepAt(Xf,R)-a)/win,2.))*(.65+.35*hash12(id+9.));
            if(I<.02)continue;
            vec2 dv=c-fp;float arm=max(.0075*I,pw*1.5);
            float cr=exp(-abs(dv.x)/arm)*exp(-dv.y*dv.y/(thin*thin))+exp(-abs(dv.y)/arm)*exp(-dv.x*dv.x/(thin*thin));
            spark+=I*(exp(-dot(dv,dv)/(core*core))*1.5+cr*.8);
          }
          fc+=vec3(1.,.97,.92)*spark*(.4+.6*amount);
          vec4 ink=texture2D(print,vec2(c.x/HALF.x*.5+.5,.5-c.y/HALF.y*.5));
          fc=mix(fc,ink.rgb*(.72+.28*diff)+ink.rgb*glint*.3,ink.a);
          fc+=vec3(.38)*exp(-pow((sd+.004)/.0035,2.))*(.35+.65*diff);
          col=mix(col,fc,mask);
        }
        gl_FragColor=vec4(min(col,1.),1.);
      }`,
    // Two line gratings. Layer B (an acetate sheet) repeats layer A's grating: black lines
    // everywhere except inside the glyphs of a word, where the lines are coloured filters.
    // Aligned and still, B's lines hide behind A's and neither the sheet nor the word shows.
    moire: `
      uniform vec2 res; uniform vec4 pose; uniform float presence; uniform float amount;
      uniform sampler2D glyph;
      const float PA=1./42.;
      const vec2 SHEET=vec2(1.22,.68);
      const vec2 GH=vec2(.86,.43);
      vec3 filt(float x){float k=clamp(x/1.6+.5,0.,1.);
        vec3 a=vec3(1.,.12,.55),b=vec3(1.,.58,.06),c=vec3(.08,.78,1.);
        return k<.5?mix(a,b,k*2.):mix(b,c,k*2.-1.);}
      void main(){
        vec2 p=(gl_FragCoord.xy-.5*res)/res.y;float px=1./res.y;
        float cs=cos(pose.z),sn=sin(pose.z);mat2 inv=mat2(cs,-sn,sn,cs);
        vec2 q0=inv*(p-pose.xy)/pose.w;
        vec2 gu=q0/(2.*GH)+.5;float M=0.;
        if(gu.x>0.&&gu.y>0.&&gu.x<1.&&gu.y<1.)M=texture2D(glyph,vec2(gu.x,1.-gu.y)).a;
        vec3 f=mix(vec3(1.),filt(q0.x),amount*.25+.75);
        vec3 T=vec3(0.);float sheet=0.;
        for(int j=0;j<4;j++)for(int i=0;i<4;i++){
          vec2 ps=p+(vec2(float(i),float(j))-1.5)*.25*px;
          float ga=step(.5,fract(ps.x/PA));
          vec2 qs=inv*(ps-pose.xy)/pose.w;
          float inS=step(sdBox(qs,SHEET,0.),0.)*presence;
          float lb=1.-step(.5,fract(qs.x/PA));
          T+=ga*mix(vec3(1.),mix(vec3(.05),f,M),lb*inS);
          sheet+=inS;
        }
        T*=1./16.;sheet*=1./16.;
        vec3 back=vec3(.96,.95,.91)*(.80+.20*exp(-dot(p,p)*1.1));
        vec3 ink=vec3(.035,.04,.06);
        vec3 col=ink+(back-ink)*T;
        col=mix(col,col*vec3(.90,.95,1.),sheet*.9);
        float se=sdBox(q0,SHEET,0.)*pose.w;
        col+=vec3(.85,.93,1.)*exp(-pow(se/.0032,2.))*.6*presence;
        col*=1.-.25*smoothstep(.06,0.,se)*step(0.,se)*presence;
        gl_FragColor=vec4(col,1.);
      }`,
  };

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
    const programs = {},
      textures = {};
    let quad = null;
    function compile(name) {
      if (programs[name]) return programs[name];
      function shader(type, source) {
        const s = gl.createShader(type);
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("GLSL compilation failed: " + gl.getShaderInfoLog(s));
        return s;
      }
      const p = gl.createProgram();
      gl.attachShader(p, shader(gl.VERTEX_SHADER, "attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}"));
      gl.attachShader(p, shader(gl.FRAGMENT_SHADER, GLSL_COMMON + SHADERS[name]));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("GLSL link failed: " + gl.getProgramInfoLog(p));
      const locs = {};
      programs[name] = {
        p,
        attr: gl.getAttribLocation(p, "p"),
        loc: (n) => (n in locs ? locs[n] : (locs[n] = gl.getUniformLocation(p, n))),
      };
      return programs[name];
    }
    function texture(name, build) {
      if (textures[name]) return textures[name];
      const source = build();
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return (textures[name] = tex);
    }
    function render(name, w, h, uniforms, textureBuilders = {}) {
      if (!gl) throw new Error("WebGL is unavailable for this optical effect.");
      if (gl.isContextLost()) throw new Error("Optical WebGL context lost");
      if (glCanvas.width !== w || glCanvas.height !== h) {
        glCanvas.width = w;
        glCanvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      const prog = compile(name);
      gl.useProgram(prog.p);
      if (!quad) {
        quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(prog.attr);
      gl.vertexAttribPointer(prog.attr, 2, gl.FLOAT, false, 0, 0);
      for (const [n, v] of Object.entries(uniforms)) {
        const l = prog.loc(n);
        if (typeof v === "number") gl.uniform1f(l, v);
        else if (v.length === 2) gl.uniform2fv(l, v);
        else if (v.length === 3) gl.uniform3fv(l, v);
        else gl.uniform4fv(l, v);
      }
      Object.entries(textureBuilders).forEach(([n, [key, build]], unit) => {
        const tex = texture(key, build);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(prog.loc(n), unit);
      });
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return glCanvas;
    }
    return { render };
  }

  // ---------------------------------------------------------------- textures
  // Printed ink on the card face: 1024 x 1024 texels over a 5:7 card, drawn in a
  // 1024 x 1434 virtual space so the type is not stretched.
  function cardPrint() {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const g = c.getContext("2d");
    g.scale(1, 1024 / 1434);
    const ink = "rgba(9,12,20,0.86)";
    function rr(x, y, w, h, r) {
      g.beginPath();
      g.roundRect(x, y, w, h, r);
    }
    g.lineWidth = 11;
    g.strokeStyle = ink;
    rr(52, 52, 920, 1330, 34);
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = "rgba(240,236,226,0.55)";
    rr(70, 70, 884, 1294, 24);
    g.stroke();
    g.fillStyle = ink;
    rr(92, 1150, 840, 170, 22);
    g.fill();
    g.fillStyle = "#f3efe6";
    g.textBaseline = "middle";
    g.font = "900 104px Arial, Helvetica, sans-serif";
    g.textAlign = "left";
    if ("letterSpacing" in g) g.letterSpacing = "10px";
    g.fillText("NOVA", 140, 1238);
    if ("letterSpacing" in g) g.letterSpacing = "2px";
    g.font = "700 40px Arial, Helvetica, sans-serif";
    g.textAlign = "right";
    g.fillText("07 / 99", 890, 1212);
    g.font = "500 26px Arial, Helvetica, sans-serif";
    g.fillStyle = "rgba(243,239,230,0.75)";
    g.fillText("HOLO RARE", 890, 1266);
    g.fillStyle = ink;
    rr(92, 96, 300, 66, 14);
    g.fill();
    g.fillStyle = "#f3efe6";
    g.textAlign = "left";
    g.font = "700 30px Arial, Helvetica, sans-serif";
    g.fillText("SERIES 01", 116, 130);
    g.save();
    g.translate(880, 130);
    g.fillStyle = ink;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 11 : 38,
        a = (i * Math.PI) / 4 - Math.PI / 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.restore();
    return c;
  }
  function moireGlyphs() {
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 1024;
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    let size = 400;
    const font = (s) => "900 " + s + "px 'Arial Black', 'Arial Bold', Arial, Helvetica, sans-serif";
    g.font = font(size);
    size *= 1900 / g.measureText("MOIRÉ").width;
    g.font = font(size);
    const m = g.measureText("MOIRÉ");
    const top = m.actualBoundingBoxAscent,
      bottom = m.actualBoundingBoxDescent;
    g.fillText("MOIRÉ", 1024, 512 + (top - bottom) / 2);
    return c;
  }

  // ---------------------------------------------------------------- timelines
  const PERIODS = { foil: 6 };
  // Foil: wrist flick, looping every 6 s. Angles in degrees; band crosses the card centre at the mirror pose.
  function foilPose(t) {
    let ry;
    if (t < 0.8) ry = lerp(-18, -22, smooth(t / 0.8));
    else if (t < 1.5) ry = lerp(-22, 24, inOutCubic((t - 0.8) / 0.7));
    else if (t < 1.9) ry = lerp(24, 21, smooth((t - 1.5) / 0.4));
    else if (t < 4.3) ry = lerp(21, 15, smooth((t - 1.9) / 2.4));
    else if (t < 5.2) ry = lerp(15, -20, inOutCubic((t - 4.3) / 0.9));
    else ry = lerp(-20, -18, smooth((t - 5.2) / 0.8));
    const rx = 2.5 * Math.sin((TAU * t) / 3 + 0.3) + 6 * bump(0.8, 1.7, t) - 4 * bump(4.3, 5.4, t);
    return { ry: ry * DEG, rx: rx * DEG };
  }
  const FOIL_MIRROR = { ry: 9 * DEG, rx: 2 * DEG };
  // Sweep coordinate at the card centre (mirrors the shader) to place the band and its spill.
  function foilSweep(pose) {
    const L = [-1.5, 1.4, 2.8],
      cy = Math.cos(pose.ry),
      sy = Math.sin(pose.ry),
      cx = Math.cos(pose.rx),
      sx = Math.sin(pose.rx);
    const u = [cy, 0, -sy],
      v = [sy * sx, cx, cy * sx];
    const V = [0, 0, 1],
      ln = Math.hypot(...L),
      Lu = L.map((x) => x / ln);
    let Hh = V.map((x, i) => x + Lu[i]);
    const hn = Math.hypot(...Hh);
    Hh = Hh.map((x) => x / hn);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return 0.9535 * dot(Hh, u) + 0.3015 * dot(Hh, v);
  }
  const FOIL_M0 = foilSweep(FOIL_MIRROR);

  // Moiré: pose of layer B = [offset x, offset y, rotation, scale] in screen-height units,
  // plus its presence. B slides in fast (impact), pops in scale so fringes burst from the
  // word, sweeps slowly by rotating a few degrees, settles aligned (the word vanishes), is
  // tapped once (the word flickers back) and is withdrawn while aligned, which shows nothing.
  const PA = 1 / 42;
  function moirePose(t, amp) {
    let ox = 0,
      th = 0,
      s = 1,
      presence = 1;
    if (t < 0.9) ox = 2.3;
    else if (t < 1.45) {
      const k = (t - 0.9) / 0.55;
      ox = 2.3 * (1 - outCubic(k));
      th = -3.5 * DEG * (1 - k);
    } else {
      const pop = spring(t - 1.45, 0.5, 0.35);
      s = 1 + (0.08 * Math.exp(-(t - 1.45) / 0.4) * Math.cos((TAU * (t - 1.45)) / 1.3) + 0.02 * ramp(1.45, 2.0, t)) * (1 - ramp(4.4, 5.6, t)) * pop;
      // half a period of offset keeps the word centre in a dark fringe while it sweeps
      const sweep = ramp(1.55, 2.0, t) * (1 - ramp(4.4, 5.6, t));
      th = (3.4 + 1.4 * Math.sin((TAU * (t - 2)) / 3.2)) * DEG * sweep;
      ox = (0.5 + 0.3 * Math.sin((TAU * (t - 2)) / 2.8)) * PA * sweep;
      ox += 0.35 * PA * bump(6.0, 6.6, t);
      presence = 1 - ramp(6.65, 7.3, t);
    }
    return [ox, 0, th * (0.55 + 0.45 * amp), 1 + (s - 1) * (0.55 + 0.45 * amp), presence];
  }

  // ---------------------------------------------------------------- effect instances
  function create(canvas, mode) {
    if (!["moire", "slit", "ribbon", "caustic", "foil", "morph"].includes(mode)) throw new Error("Unknown optical effect: " + mode);
    const ctx = canvas.getContext("2d");
    const palette = {
      bg: [10, 15, 20],
      fg: [240, 245, 241],
      a: [180, 118, 255],
      b: [71, 155, 244],
      c: [255, 156, 94],
    };
    // The foil loops every 6 s; the other effects every 8 s.
    const PERIOD = PERIODS[mode] || 8;
    let t = 0,
      amp = 1;
    const sx = () => canvas.width / W,
      sy = () => canvas.height / H;
    function gpu(name, uniforms, textures) {
      sharedGPU ||= makeGPU();
      const img = sharedGPU.render(name, canvas.width, canvas.height, uniforms, textures);
      ctx.drawImage(img, 0, 0, W, H);
    }
    const rgb = (c) => "rgb(" + c.map(Math.round).join(",") + ")";
    const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    const ease = (x) => x * x * (3 - 2 * x);
    function text(txt, x, y, size, col, align = "left", weight = 500) {
      ctx.fillStyle = typeof col === "string" ? col : rgb(col);
      ctx.textAlign = align;
      ctx.textBaseline = "alphabetic";
      ctx.font = weight + " " + size + "px Arial, sans-serif";
      ctx.fillText(txt, x, y);
    }
    function clear(color = palette.bg) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      ctx.setTransform(sx(), 0, 0, sy(), 0, 0);
      ctx.fillStyle = rgb(color);
      ctx.fillRect(0, 0, W, H);
    }
    // Small corner captions; a plate keeps them legible over busy frames.
    function label(a, b, plate = false) {
      ctx.font = "600 15px Arial, sans-serif";
      if (plate) {
        ctx.fillStyle = "rgba(8,11,16,0.78)";
        const wa = ctx.measureText(a).width,
          wb = ctx.measureText(b).width;
        ctx.fillRect(28, 28, wa + 24, 30);
        ctx.fillRect(W - 40 - wb - 12, H - 52, wb + 24, 30);
      }
      text(a, 40, 48, 15, "rgba(240,245,241,0.92)", "left", 600);
      text(b, W - 40, H - 32, 15, "rgba(240,245,241,0.7)", "right", 500);
    }

    // ------------------------------------------------ slit-scan
    // Output column x shows the source at time t - (x / W) * delta. The source (a word
    // spinning about its vertical axis and a pendulum light) is a function of time, so every
    // device column is sampled exactly from pre-rendered sprites; nothing is buffered.
    // Spin about the vertical axis: ramps up, holds about 1.7 turns per second, then lands
    // exactly on the front face (7 whole turns) at 5.9 s.
    const SPIN_A = 0.7,
      SPIN_R1 = 0.9,
      SPIN_B = 4.6,
      SPIN_R2 = 1.3,
      TURNS = 7;
    const SPIN_W = (TAU * TURNS) / (SPIN_R1 / 2 + (SPIN_B - SPIN_A - SPIN_R1) + SPIN_R2 / 2);
    function spin(tau) {
      if (tau <= SPIN_A) return 0;
      if (tau < SPIN_A + SPIN_R1) {
        const u = (tau - SPIN_A) / SPIN_R1;
        return SPIN_W * SPIN_R1 * (u * u * u - (u * u * u * u) / 2);
      }
      const plateau = SPIN_R1 / 2 + (Math.min(tau, SPIN_B) - SPIN_A - SPIN_R1);
      if (tau < SPIN_B) return SPIN_W * plateau;
      const v = Math.min(1, (tau - SPIN_B) / SPIN_R2);
      return SPIN_W * (plateau + SPIN_R2 * (v - (v * v * v - (v * v * v * v) / 2)));
    }
    function slitDelta(time) {
      if (time < 1 || time >= 6.05) return 0;
      let d = 1.9 * inOutCubic((time - 1) / 1.7);
      if (time > 2.7) d = 1.9 * (1 + 0.08 * Math.sin((TAU * (time - 2.7)) / 3.1));
      d += 0.3 * bump(2.7, 3.3, time);
      if (time > 5.8) d *= 1 - inCubic((time - 5.8) / 0.25);
      return d * amp;
    }
    const PIVOT = [W / 2, -0.3 * H],
      ROD = 1.0 * H;
    function orbAt(tau) {
      const a = 0.62 * Math.sin((TAU * tau) / 4 + 0.2);
      return [PIVOT[0] + ROD * Math.sin(a), PIVOT[1] + ROD * Math.cos(a)];
    }
    // The source is a printed banner, 760 x 240 logical units, spinning in perspective.
    const BANNER = { hw: 380, hh: 118, cy: 292, dist: 1300 };
    let slitSprites = null;
    function makeSlitSprites() {
      const S = 2,
        font = "900 230px Arial, Helvetica, sans-serif";
      const probe = document.createElement("canvas").getContext("2d");
      probe.font = font;
      const m = probe.measureText("TIME");
      const capTop = m.actualBoundingBoxAscent;
      function banner(back) {
        const c = document.createElement("canvas");
        c.width = BANNER.hw * 2 * S;
        c.height = BANNER.hh * 2 * S;
        const g = c.getContext("2d");
        g.scale(S, S);
        const bg = g.createLinearGradient(0, 0, BANNER.hw * 2, BANNER.hh * 2);
        if (back) {
          bg.addColorStop(0, "#ff2f7d");
          bg.addColorStop(0.55, "#ff7a2f");
          bg.addColorStop(1, "#ffc93a");
        } else {
          bg.addColorStop(0, "#fbf6ec");
          bg.addColorStop(1, "#dfeaff");
        }
        g.fillStyle = bg;
        g.beginPath();
        g.roundRect(2, 2, BANNER.hw * 2 - 4, BANNER.hh * 2 - 4, 26);
        g.fill();
        g.strokeStyle = back ? "rgba(255,240,225,0.75)" : "rgba(20,28,52,0.85)";
        g.lineWidth = 5;
        g.beginPath();
        g.roundRect(16, 16, BANNER.hw * 2 - 32, BANNER.hh * 2 - 32, 16);
        g.stroke();
        g.fillStyle = back ? "#fff4e6" : "#141c34";
        g.font = font;
        g.textAlign = "center";
        g.textBaseline = "alphabetic";
        g.fillText("TIME", BANNER.hw, BANNER.hh + capTop / 2);
        return c;
      }
      const letters = [];
      let x = -m.width / 2;
      for (const ch of "TIME") {
        const w = probe.measureText(ch).width;
        letters.push([ch, x, x + w]);
        x += w;
      }
      const R = 92,
        orb = document.createElement("canvas");
      orb.width = orb.height = R * 2 * S;
      const og = orb.getContext("2d");
      og.scale(S, S);
      const gr = og.createRadialGradient(R, R, 0, R, R, R);
      gr.addColorStop(0, "rgba(255,248,226,1)");
      gr.addColorStop(0.12, "rgba(255,222,150,1)");
      gr.addColorStop(0.32, "rgba(120,200,255,0.55)");
      gr.addColorStop(1, "rgba(60,140,255,0)");
      og.fillStyle = gr;
      og.fillRect(0, 0, R * 2, R * 2);
      return { S, letters, R, orb, front: banner(false), back: banner(true) };
    }
    // Banner column seen at screen column x when the banner has turned by theta.
    function bannerColumn(x, theta) {
      const c = Math.cos(theta),
        s = Math.sin(theta),
        dx = x - W / 2,
        den = BANNER.dist * c + dx * s;
      if (Math.abs(den) < 1e-6) return null;
      const xl = (dx * BANNER.dist) / den;
      if (Math.abs(xl) > BANNER.hw) return null;
      const depth = BANNER.dist - xl * s;
      if (depth <= 1) return null;
      return { xl, c, scale: BANNER.dist / depth, slope: Math.abs((BANNER.dist * BANNER.dist * c) / (den * den)) };
    }
    function slit() {
      const sp = (slitSprites ||= makeSlitSprites());
      clear([7, 9, 14]);
      const bgG = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 700);
      bgG.addColorStop(0, "rgba(40,52,78,0.55)");
      bgG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bgG;
      ctx.fillRect(0, 0, W, H);
      const delta = slitDelta(t);
      const flash = t >= 2.86 ? Math.exp(-Math.max(0, t - 2.9) / 0.09) * Math.min(1, (t - 2.86) / 0.04) : 0;
      const orbScale = 1 + 0.5 * flash;
      const Rv = sp.R * orbScale;
      const cw = canvas.width,
        kx = sx(),
        ky = sy();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // delta = 0 is the plain source: every column shares one moment
      for (let X = 0; X < cw; X++) {
        const x = (X + 0.5) / kx,
          tau = t - (x / W) * delta;
        const col = bannerColumn(x, spin(tau));
        if (col) {
          const front = col.c >= 0,
            img = front ? sp.front : sp.back;
          const u0 = (front ? col.xl + BANNER.hw : BANNER.hw - col.xl) * sp.S;
          const du = Math.min(img.width / 4, Math.max(0.5, (sp.S * col.slope) / kx));
          const u = clamp(u0 - du / 2, 0, img.width - du);
          const h = BANNER.hh * col.scale;
          ctx.globalAlpha = 1;
          ctx.drawImage(img, u, 0, du, img.height, X, (BANNER.cy - h) * ky, 1, 2 * h * ky);
          const dark = 0.62 * (1 - Math.abs(col.c));
          if (dark > 0.01) {
            ctx.fillStyle = "rgba(6,8,14," + dark.toFixed(3) + ")";
            ctx.fillRect(X, (BANNER.cy - h) * ky, 1, 2 * h * ky);
          }
        }
        const [ox, oy] = orbAt(tau);
        const dx = x - ox;
        if (Math.abs(dx) < Rv) {
          const du = Math.max(0.5, sp.S / kx / orbScale);
          const u = clamp((dx / orbScale + sp.R) * sp.S - du / 2, 0, sp.orb.width - du);
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(sp.orb, u, 0, du, sp.orb.height, X, (oy - Rv) * ky, 1, Rv * 2 * ky);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      if (flash > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(255,240,220," + (0.36 * flash).toFixed(4) + ")";
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
      }
      // Time ruler: column x shows the moment t - (x / W) * delta.
      const y = 560,
        x0 = 60,
        x1 = W - 60;
      ctx.strokeStyle = "rgba(240,245,241,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      for (let i = 0; i <= 16; i++) {
        const x = lerp(x0, x1, i / 16),
          h = i % 4 ? 5 : 10;
        ctx.moveTo(x, y - h);
        ctx.lineTo(x, y + h);
      }
      ctx.stroke();
      text("NOW", x0, y + 32, 15, "rgba(240,245,241,0.75)", "left", 600);
      text(delta > 0 ? "NOW − " + delta.toFixed(2) + " s" : "NOW", x1, y + 32, 15, "rgba(240,245,241,0.75)", "right", 600);
      label("SLIT-SCAN · TIME DISPLACEMENT", "");
    }
    // Instances of one printed letter across the frame on a 1280-column grid.
    function slitLetterRuns(time, letterIndex = 0, columns = 1280) {
      const sp = (slitSprites ||= makeSlitSprites());
      const delta = slitDelta(time),
        [, a, b] = sp.letters[letterIndex];
      const runs = [];
      let run = null;
      for (let X = 0; X < columns; X++) {
        const x = ((X + 0.5) / columns) * W,
          tau = time - (x / W) * delta,
          th = spin(tau);
        const col = bannerColumn(x, th);
        // the back print is mirrored in banner space
        const xl = col ? (col.c >= 0 ? col.xl : -col.xl) : NaN;
        const inside = col && xl >= a && xl <= b;
        if (inside && !run) run = { from: X, to: X, angles: [] };
        if (inside) {
          run.to = X;
          run.angles.push(((th % TAU) + TAU) % TAU);
          run.front = col.c >= 0;
        }
        if (!inside && run) {
          runs.push(run);
          run = null;
        }
      }
      if (run) runs.push(run);
      return runs.map((r) => ({ from: r.from, to: r.to, front: r.front, angle: Math.round(r.angles.reduce((s, v) => s + v, 0) / r.angles.length / DEG) }));
    }

    // ------------------------------------------------ paper ribbon
    const SEGMENTS = 96,
      STRIP_LEN = 1280,
      SEG_LEN = STRIP_LEN / SEGMENTS,
      PB = 114;
    function ribbonPrint(back) {
      const c = document.createElement("canvas");
      c.width = STRIP_LEN * 2;
      c.height = PB * 2;
      const g = c.getContext("2d");
      g.scale(2, 2);
      g.fillStyle = back ? "#ef5640" : "#f6f0e4";
      g.fillRect(0, 0, STRIP_LEN, PB);
      let seed = back ? 91 : 17;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(60,40,20,0.06)";
        g.fillRect(rnd() * STRIP_LEN, rnd() * PB, 1 + rnd() * 2.5, 0.7);
      }
      if (back) {
        g.strokeStyle = "rgba(255,228,204,0.30)";
        g.lineWidth = 7;
        for (let x = -PB; x < STRIP_LEN + PB; x += 26) {
          g.beginPath();
          g.moveTo(x, PB);
          g.lineTo(x + PB, 0);
          g.stroke();
        }
        g.fillStyle = "rgba(255,242,228,0.92)";
        g.fillRect(0, 9, STRIP_LEN, 4);
        g.fillRect(0, PB - 13, STRIP_LEN, 4);
      } else {
        g.fillStyle = "#1c2748";
        g.fillRect(0, 9, STRIP_LEN, 5);
        g.fillRect(0, PB - 14, STRIP_LEN, 5);
        g.textBaseline = "middle";
        g.textAlign = "center";
        const words = ["CURL", "✦", "LOOP", "✦", "FLOAT"];
        const xs = [210, 425, 640, 855, 1070];
        words.forEach((w, i) => {
          g.fillStyle = w === "✦" ? "#ef5640" : "#1c2748";
          g.font = (w === "✦" ? "700 42px" : "900 60px") + " Arial, Helvetica, sans-serif";
          g.fillText(w, xs[i], PB / 2 + 2);
        });
      }
      if (back) {
        // The back is seen from behind: mirror it so its pattern runs the right way.
        const m = document.createElement("canvas");
        m.width = c.width;
        m.height = c.height;
        const mg = m.getContext("2d");
        mg.translate(c.width, 0);
        mg.scale(-1, 1);
        mg.drawImage(c, 0, 0);
        return m;
      }
      return c;
    }
    let ribbonTex = null;
    const shadowCanvas = document.createElement("canvas");
    // 3x4 affine matrices as arrays [r00,r01,r02,tx, r10,r11,r12,ty, r20,r21,r22,tz]
    const mul = (A, B) => {
      const C = new Array(12);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          let v = c === 3 ? A[r * 4 + 3] : 0;
          for (let k = 0; k < 3; k++) v += A[r * 4 + k] * B[k * 4 + c];
          C[r * 4 + c] = v;
        }
      }
      return C;
    };
    const apply = (M, p) => [0, 1, 2].map((r) => M[r * 4] * p[0] + M[r * 4 + 1] * p[1] + M[r * 4 + 2] * p[2] + M[r * 4 + 3]);
    const rotY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 0, 1, 0, 0, -Math.sin(a), 0, Math.cos(a), 0];
    const rotX = (a) => [1, 0, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, 0, Math.sin(a), Math.cos(a), 0];
    const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, 0, Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0];
    const trans = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
    const norm = (v) => {
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    };
    const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const CAM = [0, 260, 1500],
      FOCAL = 1250,
      PITCH = Math.atan2(CAM[1] - 10, CAM[2]);
    const LIGHT_DIR = norm([-0.42, 1, 0.48]);
    const FLOOR = -150;
    function toCam(p) {
      const x = p[0] - CAM[0],
        y = p[1] - CAM[1],
        z = p[2] - CAM[2];
      const c = Math.cos(PITCH),
        s = Math.sin(PITCH);
      return [x, y * c - z * s, y * s + z * c];
    }
    function project(p) {
      const q = toCam(p);
      const d = -q[2];
      return [W / 2 + (FOCAL * q[0]) / d, H / 2 - (FOCAL * q[1]) / d, d];
    }
    function ribbonState(time) {
      // Fly in as a silk-smooth undulating paper streamer, curl continuously into a
      // saddle-curved sculptural loop (constant arc length, zero polygon creases), float, drift out.
      const curlK = inOutCubic(clamp((time - 0.52) / 1.16));
      const alpha = lerp(0.34, TAU, curlK);
      const baseR = STRIP_LEN / alpha;
      const zCentroid = (baseR * Math.sin(alpha * 0.5)) / (alpha * 0.5);
      const wavePhase = (TAU * time) / 4;
      const saddleAmp = curlK * (28 + 16 * amp);
      const radAmp = curlK * (12 + 10 * amp);
      const flyAmp = (1 - curlK) * (16 + 22 * amp);

      const centerAt = (u) => {
        const th = (u - 0.5) * alpha;
        const r = baseR + radAmp * Math.cos(2 * th - wavePhase * 0.5);
        const x = r * Math.sin(th);
        const z = r * Math.cos(th) - zCentroid + flyAmp * Math.sin(u * Math.PI * 2.5 - time * TAU * 1.25);
        const y =
          saddleAmp * Math.sin(2 * th + wavePhase) +
          flyAmp * 0.55 * Math.cos(u * Math.PI * 2.0 - time * TAU * 1.25);
        return [x, y, z];
      };

      const twistAt = (u) => {
        const th = (u - 0.5) * alpha;
        const loopTwist =
          curlK * ((0.46 + 0.18 * amp) * Math.sin(th + wavePhase * 0.5) + 0.22 * Math.cos(2 * th - wavePhase));
        const streamTwist = (1 - curlK) * 0.34 * amp * Math.sin(u * Math.PI * 2.2 - time * TAU * 1.25);
        return loopTwist + streamTwist;
      };

      const rings = [];
      const eps = 0.002;
      for (let k = 0; k <= SEGMENTS; k++) {
        const u = k / SEGMENTS;
        const c = centerAt(u);
        const p0 = centerAt(curlK > 0.999 ? ((u - eps + 1) % 1) : Math.max(0, u - eps));
        const p1 = centerAt(curlK > 0.999 ? ((u + eps) % 1) : Math.min(1, u + eps));
        const tang = norm([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]);
        const n0 = norm(cross3(tang, [0, 1, 0]));
        const b0 = norm(cross3(n0, tang));
        const psi = twistAt(u);
        const cp = Math.cos(psi),
          sp = Math.sin(psi);
        const binorm = [cp * b0[0] + sp * n0[0], cp * b0[1] + sp * n0[1], cp * b0[2] + sp * n0[2]];
        const half = PB * 0.5;
        rings.push({
          lo: [c[0] - binorm[0] * half, c[1] - binorm[1] * half, c[2] - binorm[2] * half],
          hi: [c[0] + binorm[0] * half, c[1] + binorm[1] * half, c[2] + binorm[2] * half],
        });
      }

      let cx = 0,
        cy = 0,
        cz = 0;
      const local = [];
      for (let k = 0; k < SEGMENTS; k++) {
        const r0 = rings[k],
          r1 = rings[k + 1];
        const v = [r0.lo, r1.lo, r1.hi, r0.hi];
        v.forEach((p) => {
          cx += p[0];
          cy += p[1];
          cz += p[2];
        });
        local.push(v);
      }
      const n = SEGMENTS * 4;
      const centre = trans(-cx / n, -cy / n, -cz / n);

      const ringK = ramp(0.68, 1.65, time);
      const spinA = (-22 + 28 * Math.max(0, time - 1.15) * (0.6 + 0.4 * amp) + 38 * ramp(6.5, 8, time) * (time - 6.5)) * DEG;
      const flyRoll = (13 * (1 - outCubic(time / 0.9)) - 3) * DEG * (1 - ringK);
      const tiltX = lerp(-6, 33, ringK) + 4 * amp * Math.sin(wavePhase) * ringK;
      const orient = mul(rotX(tiltX * DEG), mul(rotZ(flyRoll), rotY(spinA * ringK + (1 - ringK) * -6 * DEG)));

      const fly = outCubic(time / 0.95);
      const settle = ramp(0.85, 1.8, time);
      let px = lerp(-1040, -16, fly) + 16 * settle,
        py = lerp(225, 68, fly),
        pz = lerp(-460, 0, fly) + 390 * settle;
      const bob = 10 * Math.sin((TAU * (time - 1.6)) / 2.8) * ramp(1.4, 2.2, time) * amp;
      py += bob;
      const exit = inCubic((time - 6.55) / 1.45);
      if (time > 6.55) {
        px += 1180 * exit;
        py += 230 * exit;
        pz -= 420 * exit;
      }
      const pop = 1 + 0.04 * bump(1.38, 1.74, time);
      const S = [pop, 0, 0, 0, 0, pop, 0, 0, 0, 0, pop, 0];
      const M = mul(trans(px, py, pz), mul(orient, mul(S, centre)));
      const panels = local.map((v, k) => {
        const w = v.map((p) => apply(M, p));
        const e1 = w[1].map((x, i) => x - w[0][i]),
          e2 = w[3].map((x, i) => x - w[0][i]);
        const nrm = norm(cross3(e1, e2));
        const ctr = [0, 1, 2].map((i) => (w[0][i] + w[1][i] + w[2][i] + w[3][i]) / 4);
        return { k, w, nrm, ctr, depth: -toCam(ctr)[2] };
      });
      return { panels, M, local, closed: curlK > 0.995 };
    }
    function triangle(img, s0, s1, s2, d0, d1, d2) {
      // affine map from texture triangle s to screen triangle d (logical units), clip slightly enlarged
      const cxs = (d0[0] + d1[0] + d2[0]) / 3,
        cys = (d0[1] + d1[1] + d2[1]) / 3;
      const grow = (p) => {
        const dx = p[0] - cxs,
          dy = p[1] - cys,
          l = Math.hypot(dx, dy) || 1;
        return [p[0] + (dx / l) * 0.85, p[1] + (dy / l) * 0.85];
      };
      const [g0, g1, g2] = [grow(d0), grow(d1), grow(d2)];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(g0[0], g0[1]);
      ctx.lineTo(g1[0], g1[1]);
      ctx.lineTo(g2[0], g2[1]);
      ctx.closePath();
      ctx.clip();
      const den = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
      if (Math.abs(den) < 1e-9) {
        ctx.restore();
        return;
      }
      const a = (d0[0] * (s1[1] - s2[1]) + d1[0] * (s2[1] - s0[1]) + d2[0] * (s0[1] - s1[1])) / den;
      const b = (d0[1] * (s1[1] - s2[1]) + d1[1] * (s2[1] - s0[1]) + d2[1] * (s0[1] - s1[1])) / den;
      const c = (d0[0] * (s2[0] - s1[0]) + d1[0] * (s0[0] - s2[0]) + d2[0] * (s1[0] - s0[0])) / den;
      const d = (d0[1] * (s2[0] - s1[0]) + d1[1] * (s0[0] - s2[0]) + d2[1] * (s1[0] - s0[0])) / den;
      const e = (d0[0] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[0] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[0] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
      const f = (d0[1] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[1] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[1] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
      ctx.transform(a, b, c, d, e, f);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
    function ribbon() {
      ribbonTex ||= { front: ribbonPrint(false), back: ribbonPrint(true) };
      clear([16, 21, 29]);
      // studio sweep: warm slate wall fading into a softly lit studio floor
      const wall = ctx.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, "#19212f");
      wall.addColorStop(0.55, "#283344");
      wall.addColorStop(1, "#394558");
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, W, H);
      const pool = ctx.createRadialGradient(W / 2, 535, 24, W / 2, 535, 580);
      pool.addColorStop(0, "rgba(162,174,196,0.52)");
      pool.addColorStop(1, "rgba(120,136,160,0)");
      ctx.fillStyle = pool;
      ctx.fillRect(0, 0, W, H);
      const state = ribbonState(t);
      // cast shadow on the floor plane, drawn as a continuous strip in device pixels and blurred to scale
      const cw = canvas.width,
        ch = canvas.height;
      if (shadowCanvas.width !== cw || shadowCanvas.height !== ch) {
        shadowCanvas.width = cw;
        shadowCanvas.height = ch;
      }
      const sg = shadowCanvas.getContext("2d");
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.clearRect(0, 0, cw, ch);
      sg.setTransform(sx(), 0, 0, sy(), 0, 0);
      sg.fillStyle = "#080c14";
      let lift = 0;
      for (const p of state.panels) {
        sg.beginPath();
        p.w.forEach((q, i) => {
          const k = (q[1] - FLOOR) / LIGHT_DIR[1];
          lift += q[1] - FLOOR;
          const s = project([q[0] - LIGHT_DIR[0] * k, FLOOR, q[2] - LIGHT_DIR[2] * k]);
          if (i) sg.lineTo(s[0], s[1]);
          else sg.moveTo(s[0], s[1]);
        });
        sg.closePath();
        sg.fill();
      }
      lift /= state.panels.length * 4;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const blurPx = (8 + lift * 0.042) * sx();
      ctx.filter = "blur(" + blurPx.toFixed(2) + "px)";
      ctx.globalAlpha = clamp(0.76 - lift * 0.00065, 0.28, 0.68);
      ctx.drawImage(shadowCanvas, 0, 0);
      ctx.restore();
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      // continuous ribbon segments sorted far to near, smooth warm shading, zero polygon crease strokes
      const toCamera = (p) => norm(CAM.map((c, i) => c - p[i]));
      const order = [...state.panels].sort((a, b) => b.depth - a.depth);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      for (const p of order) {
        const view = toCamera(p.ctr);
        const front = dot3(p.nrm, view) > 0;
        const n = front ? p.nrm : p.nrm.map((x) => -x);
        const diff = Math.max(0, dot3(n, LIGHT_DIR));
        const halfVec = norm([LIGHT_DIR[0] + view[0], LIGHT_DIR[1] + view[1], LIGHT_DIR[2] + view[2]]);
        const spec = Math.pow(Math.max(0, dot3(n, halfVec)), 34) * (front ? 0.20 : 0.15);
        const img = front ? ribbonTex.front : ribbonTex.back;
        const scr = p.w.map(project);
        const tx = (u) => (front ? u : STRIP_LEN * 2 - u);
        const u0 = tx(p.k * SEG_LEN * 2),
          u1 = tx((p.k + 1) * SEG_LEN * 2);
        triangle(img, [u0, PB * 2], [u1, PB * 2], [u1, 0], scr[0], scr[1], scr[2]);
        triangle(img, [u0, PB * 2], [u1, 0], [u0, 0], scr[0], scr[2], scr[3]);

        const shade = Math.min(1, 0.50 + 0.44 * diff + 0.16 * Math.max(0, dot3(n, view)));
        const growQ = (q, cxq, cyq) => {
          const dx = q[0] - cxq,
            dy = q[1] - cyq,
            l = Math.hypot(dx, dy) || 1;
          return [q[0] + (dx / l) * 0.65, q[1] + (dy / l) * 0.65];
        };
        const cxq = (scr[0][0] + scr[1][0] + scr[2][0] + scr[3][0]) * 0.25,
          cyq = (scr[0][1] + scr[1][1] + scr[2][1] + scr[3][1]) * 0.25;
        ctx.beginPath();
        scr.forEach((q, i) => {
          const gq = growQ(q, cxq, cyq);
          if (i) ctx.lineTo(gq[0], gq[1]);
          else ctx.moveTo(gq[0], gq[1]);
        });
        ctx.closePath();
        ctx.globalCompositeOperation = "multiply";
        const rCh = Math.round(255 * Math.min(1, shade * 1.01)),
          gCh = Math.round(255 * shade),
          bCh = Math.round(255 * Math.min(1, shade * 0.96 + 0.03));
        ctx.fillStyle = "rgb(" + rCh + "," + gCh + "," + bCh + ")";
        ctx.fill();
        if (spec > 0.004) {
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = "rgba(255,248,236," + spec.toFixed(4) + ")";
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
        // crisp paper rim highlight along the continuous top and bottom edges only
        ctx.lineWidth = 1.15;
        ctx.strokeStyle = front ? "rgba(255,252,244,0.28)" : "rgba(255,232,216,0.22)";
        ctx.beginPath();
        ctx.moveTo(scr[0][0], scr[0][1]);
        ctx.lineTo(scr[1][0], scr[1][1]);
        ctx.moveTo(scr[3][0], scr[3][1]);
        ctx.lineTo(scr[2][0], scr[2][1]);
        ctx.stroke();
        if (!state.closed && (p.k === 0 || p.k === SEGMENTS - 1)) {
          ctx.strokeStyle = "rgba(255,250,240,0.24)";
          ctx.beginPath();
          if (p.k === 0) {
            ctx.moveTo(scr[0][0], scr[0][1]);
            ctx.lineTo(scr[3][0], scr[3][1]);
          } else {
            ctx.moveTo(scr[1][0], scr[1][1]);
            ctx.lineTo(scr[2][0], scr[2][1]);
          }
          ctx.stroke();
        }
      }
      label("PAPER RIBBON", "CANVAS 2D · CONTINUOUS CURL · CAST SHADOW");
    }

    // ------------------------------------------------ path morph (aligned clockwise contours)
    // All three emblems start at top-centre and wind clockwise with filleted corners,
    // so Flubber's perimeter correspondence never twists or self-intersects mid-morph.
    const shapes = [
      "M0,-34 Q8,-34 15,-48 L38,-94 Q47,-112 66,-112 L108,-112 Q128,-112 128,-92 L128,92 Q128,112 108,112 L74,112 Q56,112 56,94 L56,18 Q56,4 46,20 L16,68 Q0,92 -16,68 L-46,20 Q-56,4 -56,18 L-56,94 Q-56,112 -74,112 L-108,112 Q-128,112 -128,92 L-128,-92 Q-128,-112 -108,-112 L-66,-112 Q-47,-112 -38,-94 L-15,-48 Q-8,-34 0,-34 Z",
      "M18,-142 L68,-142 Q86,-142 76,-124 L30,-32 Q22,-18 38,-18 L98,-18 Q118,-18 104,-2 L-16,136 Q-30,152 -25,131 L-4,32 Q0,16 -16,16 L-88,16 Q-108,16 -96,-2 L-2,-130 Q6,-142 18,-142 Z",
      "M0,-62 C22,-112 108,-122 138,-56 C166,6 106,72 14,120 Q0,128 -14,120 C-106,72 -166,6 -138,-56 C-108,-122 -22,-112 0,-62 Z",
    ];
    let interpolators = [];
    if (mode === "morph" && window.flubber) {
      interpolators = shapes.map((s, i) =>
        window.flubber.interpolate(s, shapes[(i + 1) % 3], {
          maxSegmentLength: 3,
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
        ctx.fillStyle = rgb(j === 0 ? palette.fg : mix(palette.bg, mix(palette.a, palette.b, j / 9), 0.9 - j * 0.065));
        ctx.fill(path);
        ctx.restore();
      }
      label("PATH MORPH", "FLUBBER 0.4.2 · ARBITRARY PATHS");
      text(["MONOGRAM → ENERGY", "ENERGY → LOVE", "LOVE → MONOGRAM"][i], 40, 548, 28, palette.a);
    }

    const toGL = (c) => c.map((v) => v / 255);
    function draw() {
      clear();
      if (mode === "moire") {
        const pose = moirePose(t, amp);
        gpu("moire", { res: [canvas.width, canvas.height], pose: pose.slice(0, 4), presence: pose[4], amount: amp }, { glyph: ["moire-glyphs", moireGlyphs] });
        label("OPTICAL INTERFERENCE", "GLSL · TWO LINE GRATINGS · HIDDEN WORD", true);
      }
      if (mode === "slit") slit();
      if (mode === "ribbon") ribbon();
      if (mode === "caustic") {
        gpu("caustic", { resolution: [canvas.width, canvas.height], time: t, amount: amp, bg: toGL(palette.bg), fg: toGL(palette.fg), cb: toGL(palette.b) });
        text("AFTER", W / 2, 295, 88, palette.fg, "center");
        text("THE RAIN", W / 2, 389, 88, palette.fg, "center");
        label("CAUSTIC LIGHT", "PROCEDURAL WATER LIGHT");
      }
      if (mode === "foil") {
        const pose = foilPose(t);
        const e = 0.01,
          a = foilPose(t - e),
          b = foilPose(t + e);
        const vel = Math.hypot(b.ry - a.ry, b.rx - a.rx) / (2 * e);
        const m = foilSweep(pose) - FOIL_M0;
        gpu(
          "foil",
          { res: [canvas.width, canvas.height], rot: [pose.ry, pose.rx], vel, amount: amp, m0: FOIL_M0, spill: Math.exp(-(m * m) / 0.012) * amp },
          { print: ["foil-card", cardPrint] },
        );
        label("HOLOGRAPHIC FOIL", "GLSL · ART-DIRECTED DIFFRACTION · GLITTER FLAKES");
      }
      if (mode === "morph") morph();
    }
    const frame = (time, strength = 1) => {
      if (!Number.isFinite(time) || !Number.isFinite(strength)) throw new Error("Optical time and strength must be finite");
      t = ((time % PERIOD) + PERIOD) % PERIOD;
      amp = Math.max(0.25, Math.min(1.5, strength));
      draw();
    };
    // Measured facts for tests and review; computed from the same timelines as the pixels.
    frame.proof = (time, strength = 1) => {
      const tt = ((time % PERIOD) + PERIOD) % PERIOD,
        a = Math.max(0.25, Math.min(1.5, strength));
      if (mode === "slit") {
        amp = a;
        const delta = slitDelta(tt);
        let lo = Infinity,
          hi = -Infinity;
        if (delta > 0)
          for (let X = 0; X < 1280; X++) {
            const x = ((X + 0.5) / 1280) * W,
              [ox] = orbAt(tt - (x / W) * delta);
            if (Math.abs(x - ox) < 30) {
              lo = Math.min(lo, X);
              hi = Math.max(hi, X);
            }
          }
        return { delta, spin: spin(tt), columns: delta ? "per device column" : "single source frame", tRuns: slitLetterRuns(tt), orbTrailOfWidth: hi > lo ? (hi - lo) / 1280 : 0 };
      }
      if (mode === "moire") {
        const [ox, oy, th, s, presence] = moirePose(tt, a);
        const k = [1 - Math.cos(th) / s, -Math.sin(th) / s];
        const fringe = PA / Math.max(1e-9, Math.hypot(k[0], k[1]));
        return { pose: [ox, oy, th, s], presence, fringePeriodOfWidth: fringe / (16 / 9), aligned: Math.abs(th) < 1e-9 && Math.abs(s - 1) < 1e-9 && Math.abs(ox - Math.round(ox / PA) * PA) < 1e-9 };
      }
      if (mode === "foil") {
        const pose = foilPose(tt);
        return { ry: pose.ry / DEG, rx: pose.rx / DEG, sweep: foilSweep(pose) - FOIL_M0 };
      }
      return {};
    };
    return frame;
  }
  window.FXOptical = { create, periods: { moire: 8, slit: 8, ribbon: 8, caustic: 8, foil: 6, morph: 8 } };
})();
