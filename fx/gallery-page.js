// index.html page script: effect gallery, filters, film links on tiles, benchmark bars and stack table.
// Site words follow one glossary: use case, demo film, effect, variant, effect film, comparison (and Motion basics).
// Load after fx/catalog.js, fx/gallery-layout.js, fx/films-data.js (window.FXFilms) and fx/gallery-meta.js.
(() => {
  document.querySelectorAll('.film-preview').forEach(preview => {
    preview.addEventListener('click', () => {
      const loop = preview.querySelector('img, video.film-loop');
      if (loop) { loop.hidden = true; if (loop.pause) loop.pause(); }
      preview.querySelector('button').hidden = true;
      const video = preview.querySelector('video[controls]');   // the film with sound, not the silent loop
      video.hidden = false;
      video.play().catch(() => {}); // Native controls remain available if playback is blocked.
    }, {once:true});
  });
  // Card posters arrive as data-poster and are set only when the card comes within 400 px of the screen, so
  // the first screen does not download every poster on the page (a <video poster> is never lazy by itself).
  // The hidden full film in the same card gets its poster at the same time.
  const lazyPosters = [...document.querySelectorAll('video.film-loop[data-poster]')];
  const setPosters = box => box.querySelectorAll('video[data-poster]').forEach(v => { v.poster = v.dataset.poster; v.removeAttribute('data-poster'); });
  if (lazyPosters.length && 'IntersectionObserver' in window) {
    const near = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { near.unobserve(e.target); setPosters(e.target.closest('.film-preview')); }
    }, { rootMargin: '400px 0px' });
    lazyPosters.forEach(v => near.observe(v));
  } else lazyPosters.forEach(v => setPosters(v.closest('.film-preview')));
  // Film cards play a silent loop (media/<id>.preview.mp4, preload="none") only while a quarter of it is on
  // screen; off screen it pauses. With reduced motion it never starts and the card shows its poster.
  const loops = [...document.querySelectorAll('video.film-loop')], stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (loops.length) {
    const onScreen = new Set();
    const update = v => { if (onScreen.has(v) && !v.hidden && !stillMotion.matches) v.play().catch(() => {}); else if (!v.paused) v.pause(); };
    const watch = new IntersectionObserver(entries => {
      for (const e of entries) { if (e.isIntersecting) onScreen.add(e.target); else onScreen.delete(e.target); update(e.target); }
    }, { threshold: .25 });
    loops.forEach(v => watch.observe(v));
    stillMotion.addEventListener?.('change', () => loops.forEach(update));
  }
  const { R3 } = window.FX;
  const { families, showcases, stats, byId } = window.FXCatalog, basics = window.FXCatalog.basics || [];
  // Order, preview defaults and labels: fx/gallery-meta.js (order from fx/manifest.json).
  const { KINDS, NEEDS, STACKS, order: ORDER, showcaseOrder: SHOWCASE_ORDER, previewDefault: PREVIEW_DEFAULT, previewHero: PREVIEW_HERO, previewWindow: PREVIEW_WINDOW = {},
    TILE_FILM_LAYERS, TILE_FILM_LABELS, FILM_BOOKMARKS, FILM_RENAMES = {}, DEMO_ALIASES = {} } = window.FXGalleryMeta;
  // Cards missing from the order still appear, after the ordered ones; tools/fx-manifest.cjs --check rejects that.
  const rankIn = order => d => order.includes(d.id) ? order.indexOf(d.id) : order.length;
  // Films linked from effect tiles; the effects each film shows come from examples/films.json.
  const tileFilms = (Array.isArray(window.FXFilms) ? window.FXFilms : [])
    .filter(f => f.media?.mp4 && (TILE_FILM_LAYERS.includes(f.layer) || Object.hasOwn(TILE_FILM_LABELS, f.id)));
  const filmsShowing = id => tileFilms.filter(f => (f.effects || []).some(e => e.id === id));
  const gallery = document.getElementById("gallery");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cards = [];
  let playing = !reduce, clock = 0, last = performance.now(), lastDraw = 0;
  const state = { kind: "all", stack: "all" };
  const entryMatches = d => (state.kind === "all" || d.kind === state.kind) && (state.stack === "all" || d.stacks.includes(state.stack));
  function appendLink(host, href, text) {
    if(host.childNodes.length) host.append(document.createTextNode(' · '));
    const a=document.createElement('a'); a.href=href; a.textContent=text; host.append(a);
  }
  function appendFilmLinks(host, film, id) {
    const version=(film.media.mp4.match(/\?.*$/) || [''])[0];
    appendLink(host, film.media.mp4, TILE_FILM_LABELS[film.id] || `Watch the ${film.duration} s film`);
    appendLink(host, film.page || film.source || 'examples/'+film.id+'.html'+version, 'Scrub timeline');
    // A sampler plays one segment per effect card: link straight to this card's segment. An effect that
    // runs through (nearly) the whole film has no segment of its own, so it gets no extra link.
    const segment=film.layer==='effect-film' && new Set(film.effects.map(e=>e.id)).size>1 && film.effects.find(e=>e.id===id && e.at);
    if(segment && segment.at[1]-segment.at[0] < .9*film.duration) appendLink(host, `${film.media.mp4}#t=${segment.at[0]},${segment.at[1]}`, `Jump to this effect (${segment.at[0]}–${segment.at[1]} s)`);
  }
  // A film made for a family also covers its variants, unless the selected variant has its own film.
  const filmsFor = (card, d) => { const own=filmsShowing(d.id); return own.length ? own.map(f=>[f,d.id]) : filmsShowing(card.family.id).map(f=>[f,card.family.id]); };
  function details(card) {
    const d = byId.get(card.selected);
    card.caption.querySelector('.pills').innerHTML = `<span class="pill kind">${card.showcase ? 'Preset' : KINDS[d.kind]}</span><span class="grade" title="${NEEDS[d.grade][1]}">${NEEDS[d.grade][0]}</span>`;
    card.caption.querySelector('.chips').innerHTML = d.chips.map(c => `<code>${c}</code>`).join('');
    card.caption.querySelector('.variant-description').textContent = card.family.entries.length > 1 ? d.purpose : '';
    const link=card.caption.querySelector('.preview-link');link.replaceChildren();
    for (const [film, id] of filmsFor(card, d)) appendFilmLinks(link, film, id);
    if(d.id.startsWith('studio-') && FXStudio.previews[d.id.slice(7)]) appendLink(link,'examples/studio.html?compare=1#'+d.id.slice(7),'Open the input / effect comparison');
  }
  function choose(card, id) {
    if (!card.family.entries.some(e => e.id === id)) throw new Error('Demo is not in this family: ' + id);
    card.selected = id; card.dirty = true;
    if (card.select) card.select.value = id;
    for (const [key, instance] of card.instances) instance.stage.hidden = key !== id;
    card.placeholder.hidden = card.instances.has(id);
    details(card);
  }
  // Effects, then Motion basics (fundamentals, not counted as effects), then the comparison and scene presets.
  const basicsHost = document.getElementById('basicsGallery');
  for (const [list, host, showcase, rank, basic] of [[families, gallery, false, rankIn(ORDER), false], [basics, basicsHost || gallery, false, rankIn(ORDER), true], [showcases, document.getElementById('showcaseGallery'), true, rankIn(SHOWCASE_ORDER), false]]) {
    for (const family of [...list].sort((a,b) => rank(a)-rank(b))) {
      const fig = document.createElement('figure'); fig.className = 'tile'; fig.dataset.effectId = family.id; fig.id='demo-'+family.id; fig.tabIndex=-1;
      const preview = document.createElement('div'); preview.className = 'preview';
      const placeholder = document.createElement('div'); placeholder.className = 'stage'; placeholder.innerHTML = '<span class="loading">Preview loads when visible</span>'; preview.appendChild(placeholder);
      const caption = document.createElement('figcaption');
      caption.innerHTML = `<h3>${family.name}</h3><p>${family.purpose}</p><p class="variant-description"></p><p class="preview-link"></p><details class="implementation"><summary>Drawing details</summary><div class="pills"></div><div class="chips"></div></details>`;
      if (basic) fig.dataset.tier = 'basic';
      const card = {family, fig, preview, placeholder, caption, showcase, basic, selected: PREVIEW_DEFAULT[family.id] || family.id, instances:new Map(), work:Promise.resolve(), busy:false, visible:false, dirty:true};
      if (family.entries.length > 1) {
        const label = document.createElement('label'); label.className = 'variant-picker'; label.append('Variant');
        const select = document.createElement('select'); select.setAttribute('aria-label', family.name + ' variant');
        family.entries.forEach(d => { const option=document.createElement('option'); option.value=d.id; option.textContent=d.name; select.appendChild(option); });
        select.onchange = () => { card.manual=false; choose(card, select.value); }; label.append(select); caption.insertBefore(label, caption.querySelector('.variant-description')); card.select=select;
      }
      fig.append(preview,caption); host.appendChild(fig); cards.push(card); if(card.select) card.select.value=card.selected; details(card);
    }
  }
  const mk = (host, key, opts) => {
    for (const [v,label] of opts) {
      const button=document.createElement('button'); button.type='button'; button.dataset.filterValue=v; button.textContent=label; button.setAttribute('aria-pressed',String(state[key]===v));
      button.onclick=()=>{ state[key]=v; [...host.querySelectorAll('button')].forEach(b=>b.setAttribute('aria-pressed',String(b===button))); apply(); }; host.appendChild(button);
    }
  };
  function apply() {
    let n=0, nb=0, demoCount=0, variantCount=0;
    for (const card of cards) {
      if (card.showcase) continue;
      const matches=card.family.entries.filter(entryMatches); card.fig.hidden=matches.length===0;
      if (matches.length) { if (card.basic) nb++; else n++; demoCount+=matches.length; variantCount+=matches.filter(d=>d.role==='variant').length; if (!matches.some(d=>d.id===card.selected)) choose(card,matches[0].id); }
      if (card.select) for (const option of card.select.options) option.disabled=!entryMatches(byId.get(option.value));
      card.dirty=true;
    }
    document.getElementById('shown').textContent=`${n} / ${stats.techniques} effects shown`;
    const basicsShown=document.getElementById('basics-shown'); if (basicsShown) basicsShown.textContent=`${nb} / ${stats.basics || 0} motion basics shown`;
    document.getElementById('available').textContent=`${demoCount} ${demoCount===1?'preview matches':'previews match'} these filters${variantCount ? `, including ${variantCount} variant${variantCount===1?'':'s'} in the card selectors` : ''}.`;
    document.getElementById('showcase-count').textContent='Scene presets below ↘';
  }
  mk(document.getElementById('fKind'),'kind', [['all','All'],...Object.entries(KINDS).filter(([k])=>[...families, ...basics].some(f=>f.kind===k))]);
  mk(document.getElementById('fStack'),'stack', [['all','All'],...Object.entries(STACKS)]);
  apply();
  async function instanceFor(card,id) {
    if (card.instances.has(id)) return card.instances.get(id);
    const d=byId.get(id), stage=document.createElement('div'); stage.className='stage'; stage.style.aspectRatio='16 / 9'; stage.dataset.demo=id;
    stage.hidden=card.selected!==id; card.preview.appendChild(stage); card.placeholder.hidden=true;
    const instance={stage,frame:null,failed:false}; card.instances.set(id,instance);
    try {
      if (d.gl && !R3) throw new Error('WebGL or the pinned three.js dependency is unavailable');
      const target=FXGalleryLayout.mount(stage,d) || stage;
      let built=d.build(target); built=FXGalleryLayout.adapt(stage,d,built);
      if (built.ready) await built.ready;
      instance.frame=typeof built==='function' ? built : built.frame;
      if (typeof instance.frame!=='function') throw new Error('Missing frame(t) implementation');
    } catch(error) { failure(instance,error); }
    return instance;
  }
  function failure(instance,error) {
    instance.failed=true; const message=document.createElement('div'); message.className='oops'; message.textContent='This effect is unavailable: '+(error.message || error); instance.stage.replaceChildren(message);
  }
  function draw(card,time,hero=false) {
    card.busy=true;
    const work=card.work.then(async()=>{
      const id=card.selected, d=byId.get(id), instance=await instanceFor(card,id);
      // A card may loop only part of a long shared timeline ([start, end] in fx/manifest.json gallery.previewWindow).
      const span = PREVIEW_WINDOW[d.id], local = span ? span[0] + time % (span[1] - span[0]) : time % d.period;
      if (!instance.failed) try { await instance.frame(hero ? (PREVIEW_HERO[d.id] ?? d.hero) : local,time); } catch(error) { failure(instance,error); }
      for (const [key,value] of card.instances) value.stage.hidden=key!==card.selected;
      return instance;
    });
    card.work=work.catch(()=>{});
    work.finally(()=>{ if(card.work===tail) card.busy=false; }).catch(()=>{});
    const tail=card.work;
    return work;
  }
  const io=new IntersectionObserver(entries=>{
    for (const e of entries) { const card=cards.find(c=>c.fig===e.target); if(card) {card.visible=e.isIntersecting;card.dirty=true;} }
  },{rootMargin:'120px'});
  cards.forEach(card=>io.observe(card.fig));
  const playBtn=document.getElementById('play');
  function label(){playBtn.textContent=playing?'⏸ Pause':'▶ Play';playBtn.setAttribute('aria-pressed',String(!playing));}
  playBtn.onclick=()=>{playing=!playing;label();cards.forEach(c=>{c.dirty=true;c.manual=false;});}; label();
  const customInput=document.getElementById('customText');
  function setCustomText(value=''){
    window.FX_CUSTOM_TEXT=String(value).trim();
    if(customInput&&customInput.value!==value)customInput.value=value;
    for(const card of cards){
      card.dirty=true;card.manual=false;
      if(!playing&&card.visible&&!card.fig.hidden&&!card.busy){card.dirty=false;draw(card,clock,clock===0);}
    }
  }
  if(customInput)customInput.addEventListener('input',()=>setCustomText(customInput.value));
  function tick(now) {
    const dt=Math.min(.1,(now-last)/1000);last=now;if(playing)clock+=dt;
    if(now-lastDraw>30){lastDraw=now;for(const card of cards)if(card.visible&&!card.fig.hidden&&!card.busy&&!card.manual&&(playing||card.dirty)){card.dirty=false;draw(card,clock,!playing&&clock===0);}}
    requestAnimationFrame(tick);
  }
  window.galleryAPI={cards,stats,setCustomText,filter(kind='all',stack='all'){state.kind=kind;state.stack=stack;apply();},pause(){playing=false;label();},selectVariant(id){const card=cards.find(c=>c.family.entries.some(e=>e.id===id));if(!card)throw new Error('Unknown demo: '+id);choose(card,id);return card;},async draw(id,time){const card=this.selectVariant(id);if(card.showcase)document.getElementById('composition-presets').open=true;card.manual=true;return draw(card,time);}};
  window.galleryReady=Promise.resolve(window.galleryAPI);
  function revealLinkedDemo(){
    if(!location.hash.startsWith('#demo-'))return;
    let id=location.hash.slice(6);
    if(!byId.has(id)&&Object.hasOwn(DEMO_ALIASES,id)){id=DEMO_ALIASES[id];history.replaceState(null,'','#demo-'+id);}
    if(!byId.has(id))return;
    state.kind=state.stack='all';
    document.querySelectorAll('#fKind button, #fStack button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filterValue==='all')));
    apply();const card=galleryAPI.selectVariant(id);card.manual=false;
    if(card.showcase)document.getElementById('composition-presets').open=true;
    card.fig.scrollIntoView({block:'start'});card.fig.focus({preventScroll:true});
  }
  function revealLinkedFilm(){
    const key=location.hash.slice(1);
    const effectFilm=(Array.isArray(window.FXFilms)?window.FXFilms:[]).find(f=>f.layer==='effect-film'&&'film-'+f.id===key);
    const effect=FILM_BOOKMARKS[key]||effectFilm?.effects?.[0]?.id;
    if(effect){history.replaceState(null,'','#demo-'+effect);revealLinkedDemo();return;}

    const renamed=FILM_RENAMES[location.hash.slice(1)];
    if(renamed)history.replaceState(null,'','#'+renamed);
    const index=document.getElementById('film-index');
    if(['#material-films','#studio-studies','#new-studies','#film-index'].includes(location.hash)){index.open=true;index.scrollIntoView({block:'start'});return;}
    const target=document.getElementById(location.hash.slice(1));
    if(target && index.contains(target)){index.open=true;target.scrollIntoView({block:'start'});}
    else if(target && renamed)target.scrollIntoView({block:'start'});
  }
  window.addEventListener('hashchange',revealLinkedFilm);revealLinkedFilm();
  window.addEventListener('hashchange',revealLinkedDemo);
  document.addEventListener('click',event=>{const a=event.target.closest('a[href^="#demo-"]');if(a&&a.hash===location.hash){event.preventDefault();revealLinkedDemo();}});
  document.addEventListener('click',event=>{const a=event.target.closest('a[href="#film-index"]');if(a&&a.hash===location.hash){event.preventDefault();revealLinkedFilm();}});
  revealLinkedDemo();
  requestAnimationFrame(tick);

  // render-time bars, to scale
  const bars = [["First pipeline: 1 browser, CPU-emulated GPU", 399.6, "old", false], ["Verified benchmark: 4 browsers, every frame rendered twice", 52.9, "", true],
    ["Spot check only: 1 browser", 71.0, "", false], ["Spot check only: 4 browsers", 26.4, "", false], ["Spot check only: 6 browsers", 28.5, "", false], ["Spot check only: 8 browsers", 31.9, "", false]];
  document.getElementById("bars").innerHTML = bars.map(([l, v, c, best]) => `<div class="bar${best ? " best" : ""}"><span>${l}</span><div style="padding-right:90px"><i class="${c}" style="width:${(v / 399.6 * 100).toFixed(1)}%"><b>${v.toFixed(1)} s</b></i></div></div>`).join("");

  // stack table
  const rows = [
    ["Picture"],
    ["HTML + CSS", "Web layout", "Type and UI mock-ups", "Interface cards, character pops, highlighter, stamp, frosted glass (backdrop-filter), variable-font type, 3D card flips"],
    ["SVG", "Vector shapes and filters", "Lines and filters", "Horizontal motion blur on letters (feGaussianBlur), the self-drawing data chart, the timing graph, the polar morph"],
    ["Canvas 2D", "Pixels drawn in code", "Textures and text sampling", "Film grain, Bauhaus rhythm, ridgelines, the rigid bodies; text sampled for particles and reaction–diffusion; the ASCII glyph atlas; textures: the softboxes the chrome reflects and the poster behind the liquid glass"],
    ["Google Fonts", "Web fonts", "Chinese, wide Latin, a serif, monospace", "Noto Sans TC, Archivo, Instrument Serif, JetBrains Mono"],
    ["engine.js (ours)", "Timeline engine", "Every frame depends on t alone, so frames can be captured one by one", "30-odd animations (pop, whip, slam, type, scan…), scene wipes, the sound-cue list"],
    ["3D"],
    ["three.js r128 core", "3D engine for the browser", "Camera, lights, particles, 3D objects", "Particles, dust, particle text, the explorer robot, 200,000 GPU particles"],
    ["three.js post-processing", "Effects after the render (EffectComposer)", "Bloom", "UnrealBloomPass bloom on light, chrome and particles"],
    ["Custom GLSL", "Small GPU programs that colour each pixel", "What stock materials cannot do", "Burn dissolve, light through a stencil, the liquid glass lens, ray-marched clay, domain repetition, five post styles, GPU particles, reaction–diffusion, toon, halftone and dither character shading"],
    ["PBR + PMREM", "Physically based materials", "Chrome needs something to reflect", "The chrome monogram"],
    ["Physics"],
    ["Matter.js 0.20.0", "2D rigid-body physics", "Things that fall, collide and stack", "The rigid-body tile, stepped at a fixed 240 Hz so every frame can be recomputed"],
    ["Offline simulation"],
    ["Blender 5.2 LTS / Mantaflow", "Optional offline 3D tool", "Liquids, viscosity and volumetric gas", "Original Python scenes bake simulation and render fixed frames; viewing and browser export do not require Blender"],
    ["Additional film modules"],
    ["Flubber 0.4.2", "Outer-contour interpolation", "Morph concave paths", "Monogram → lightning → heart, sampled directly at t"],
    ["PixiJS 8.22.0", "2D scene graph and filter pipeline", "Compose texture effects", "Liquid poster with displacement, blur and colour grading"],
    ["Rapier 0.21.0", "3D WASM rigid-body physics", "Real collisions", "48 dominoes, fixed 120 Hz, rendered with three.js r180"],
    ["three.js r180 / WebGPU / TSL", "Modern 3D rendering and GPU compute", "Animated geometry and compute-driven particles", "Water transmission and shape changes, solid CJK type, Counterform skeletons, frozen orbits, low-poly flight and orbital particles"],
    ["GLTFLoader / AnimationMixer / SkeletonUtils", "Animated 3D assets", "Reuse a rig and its authored motion", "Amber and Teal share the fight choreography through separate animation clips"],
    ["fontTools (optional, offline)", "OpenType outline exporter", "Add supported CJK glyphs", "Build the bundled outline JSON; not needed for normal playback or rendering"],
    ["Sound"],
    ["Python synth (sfx.py)", "Sound effects from maths", "Timed cues for selected actions", "17 sounds: pop, whoosh, stamp, typing…"],
    ["Python synth (music.py)", "Music from maths", "A music bed", "100 BPM, Am–F–C–G, sections declared by the video page"],
    ["Rendering"],
    ["Playwright + Chromium", "A headless browser", "Seek to t, capture the frame", "Every frame of every video"],
    ["ffmpeg", "Audio and video tool", "Import, encode and mix", "RGBA frame import, chroma key, x264, audio mastering, posters, card loops and the README GIF"],
  ];
  const newRows = [
    ["ANGLE Metal (M4 GPU)", "WebGL on the real GPU", "Fast 3D", "The benchmark’s default headless browser used SwiftShader"],
    ["CDP fast capture", "Chrome's own screenshot call with optimizeForSpeed", "Lossless and quicker", "Pixel-identical to page.screenshot (8 of 8 frames)"],
    ["Parallel browsers", "Several Chromium processes share the frames", "Several times faster", "Tabs in one browser barely help"],
    ["Loudness", "alimiter + two-pass loudnorm + ebur128", "Consistent target loudness", "−14 LUFS target, true peak ≤ −1 dBTP"],
    ["Fail-closed checks", "A check at every step", "Stop on detected rendering or delivery errors", "GPU, lost WebGL context, page errors, fonts, re-render match, frame count, size, loudness"],
  ];
  document.getElementById("stackRows").innerHTML = rows.map((r) => r.length === 1
    ? `<tr class="grp"><th colspan="4">${r[0]}</th></tr>`
    : `<tr><td class="name">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("")
    + `<tr class="grp"><th colspan="4">In the render pipeline</th></tr>`
    + newRows.map((r) => `<tr class="new"><td class="name">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("");
})();
