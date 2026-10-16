(() => {
 const purposes={
 field:'Pull and twist a regular dot grid, let it recover, or send a three-dimensional wave through its points.',
 fill:'Move stripes, an authored liquid level or a two-colour boundary inside a fixed glyph silhouette.',
 network:'Connect moving points only when they are near enough; fade the links by measured distance.',
 shadow:'Extend a flat glyph silhouette along a controllable direction and length, then rotate its graphic shadow.',
 flap:'Two clipped halves flip around each letter hinge, with shading and staggered landings.',
 reels:'Clipped reels roll through digits or words, brake and settle into readable characters.',
 bands:'Large scrolling words, opposing vertical CJK columns and crossing text ribbons share one clock.',
 spatial:'Real text-covered cylinders, layered word planes and corridor walls with depth, occlusion and a moving camera.',
 tiles:'A seeded grid fills in order, shifts rows and rotates triangles in travelling waves.',
 led:'Sample editable lettering into a scrolling matrix of lit and unlit dots.',
 echo:'Five actual source times of the same word overlap in separate colours.',
 };
 for(const s of FXGraphic.studies)FX.demo({...s,purpose:purposes[s.id.slice(8)],grade:'A',aspect:'16 / 9',chips:['editable controls','absolute frame(t)'],build(stage){
  const ready=FXGraphic.create(s.id).then(e=>{e.canvas.className='fill';Object.assign(e.canvas.style,{width:'100%',height:'100%',display:'block'});stage.append(e.canvas);return e});
  return{ready,frame:async t=>(await ready).frame(t,{labels:false})};
 }});
})();
