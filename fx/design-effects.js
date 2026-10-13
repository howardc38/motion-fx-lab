(() => {
 const base=new URL('./design/',document.currentScript.src);
 const studies=[
  {id:'type-orbit',name:'Type in three-dimensional space',kind:'type',module:'orbit',period:8,hero:2.4,stacks:['three','canvas','glsl'],description:'Letters wrap into a rotating ring with a rim light and a hazy far side, and the camera flies through its centre.'},
  {id:'soft-shadow',name:'Source size and soft shadows',kind:'shader',module:'lighting',period:6,hero:2.7,stacks:['three','glsl'],description:'A floating ball under a light that grows from a bare spotlight into a large window: the shadow edge goes from sharp to soft.'},
  {id:'surface-ink',name:'Light-responsive surface hatching',kind:'shader',module:'ink',period:8,hero:1.4,stacks:['three','glsl'],description:'Hatching is anchored to a turned vase. A visible lamp circles it and the ink gathers on the side away from the light.'},
  {id:'letter-flow',name:'Curve-guided letter reflow',kind:'type',module:'flat',mode:'letters',period:4.8,hero:1.3,stacks:['canvas'],description:'Individual letters travel along curved paths, settle into a readable word, then lift away in turn.'},
  {id:'dot-reveal',name:'Radial halftone reveal',kind:'motion',module:'flat',mode:'reveal',period:4.8,hero:1.35,stacks:['canvas'],description:'A growing field of dots turns night into day from the centre, then day back into night from the sun.'},
 ];
 // create(id, options): options reach the module's own create(), e.g. {message} for type-orbit.
 window.FXDesign={studies,async create(id,options={}){const s=studies.find(x=>x.id===id);if(!s)throw new Error('Unknown design study: '+id);const m=await import(new URL(s.module+'.js',base));return s.mode?m.create(s.mode,options):m.create(options);}};
})();
