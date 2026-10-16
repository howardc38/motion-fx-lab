(() => {
 const base=new URL('./mechanical/',document.currentScript.src);
 const studies=[
  {id:'mechanical-assembly',name:'Exploded assembly and reassembly',kind:'motion',period:14.4,hero:7.8,purpose:'A detailed turbofan separates into seven service assemblies. Split nacelle and core shells leave radially before the fan withdraws; reverse the same path to reassemble.',chips:['named assemblies','clearance-aware order','absolute time']},
  {id:'mechanical-cutaway',name:'Solid longitudinal cutaway',kind:'space',period:14.4,hero:7.2,purpose:'Sweep a section through closed revolved housings while the detailed core continues moving. Actual section geometry preserves wall thickness and exposes the internal stages.',chips:['profile-derived section faces','moving section plane','closed housings']},
  {id:'mechanical-linkage',name:'Geared slider-crank mechanism',kind:'sim',period:14.4,hero:6.6,purpose:'A 20-tooth gear drives a 40-tooth gear, crank, connecting rod and piston. Their positions and the tachometer come from one analytic mechanism model.',chips:['20:40 gear reduction','constant-length connecting rod','one model for geometry and readings']},
 ];
 window.FXMechanical={studies,async create(id,o={}){const m=await import(new URL('app.js',base));return m.create(id,o)}};
})();
