(() => {
 const base=new URL('./design/',document.currentScript.src);
 const studies=[
  {id:'type-orbit',name:'Type in three-dimensional space',kind:'type',module:'orbit',period:8,hero:3.2,stacks:['three','canvas','glsl'],description:'Letters wrap into a rotating ring with real depth and perspective, then return to a line.'},
  {id:'soft-shadow',name:'Source size and soft shadows',kind:'shader',module:'lighting',period:6,hero:2.4,stacks:['three','glsl'],description:'Widen a light source or raise a sphere to change the softness and spread of its shadow.'},
  {id:'surface-ink',name:'Light-responsive surface hatching',kind:'shader',module:'ink',period:8,hero:2.6,stacks:['three','glsl'],description:'Hatching is anchored in object coordinates. Camera movement preserves the marks, while changing light changes ink density.'},
  {id:'letter-flow',name:'Curve-guided letter reflow',kind:'type',module:'flat',mode:'letters',period:4.8,hero:1.15,stacks:['canvas'],description:'Individual letters travel along curved paths and settle into a readable word.'},
  {id:'spring-response',name:'Spring motion and its response curve',kind:'motion',module:'flat',mode:'spring',period:4.8,hero:1.1,stacks:['canvas'],description:'The dot and plotted trace sample the same closed-form damped spring. Damping changes the overshoot and settling.'},
  {id:'dot-reveal',name:'Radial halftone reveal',kind:'motion',module:'flat',mode:'reveal',period:4.8,hero:2.1,stacks:['canvas'],description:'A growing field of dots reveals a second image from the centre outward.'},
 ];
 window.FXDesign={studies,async create(id){const s=studies.find(x=>x.id===id);if(!s)throw new Error('Unknown design study: '+id);const m=await import(new URL(s.module+'.js',base));return m.create(s.mode);}};
})();
