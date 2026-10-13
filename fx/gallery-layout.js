// Recompose legacy portrait studies for the gallery; preserve film embeds.
// 2D effects and Motion basics in fx/demos.js and fx/pack-2d.js are authored for 16:9 and need no special case.
(() => {
  function svgLayout(stage,id) {
    const svg=stage.querySelector('svg:not(.defs)');
    if (!svg || !svg.viewBox.baseVal.height) return;
    // Widen a portrait viewBox to 16:9 around its centre; an already 16:9 viewBox is unchanged.
    const v=svg.viewBox.baseVal, w=v.height*16/9;
    if (Math.abs(w-v.width)<0.5) return;
    svg.setAttribute('viewBox',`${v.x-(w-v.width)/2} ${v.y} ${w} ${v.height}`);
    // Labels use the new safe area, while circles and characters stay round.
    if(id==='morph') [...svg.querySelectorAll('text')].forEach(n=>n.setAttribute('x',n.getAttribute('text-anchor')==='end'?'590':'-190'));
  }
  function mount(stage,d) {
    stage.classList.add('landscape'); stage.dataset.demo=d.id;
    stage.style.aspectRatio='16 / 9'; return stage;
  }
  function adapt(stage,d,built) {
    if(!d.aspect && !d.gl) svgLayout(stage,d.id);
    const frame=typeof built==='function'?built:built.frame;
    return {ready:typeof built==='function'?null:built.ready,frame:async(t,abs=t)=>{ await frame(t,abs); }};
  }
  window.FXGalleryLayout={mount,adapt};
})();
