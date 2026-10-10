(() => {
  const base=new URL('./signals/films.js',document.currentScript.src);
  const studies=[
    {id:'audio-relief',name:'Audio-driven solid relief',kind:'shader',period:12,hero:2.43,description:'Measured sound energy raises solid image cells; frequency bands shape their depth. A variation of image relief.'},
    {id:'motion-fragments',name:'Motion-driven fragments',kind:'motion',period:12,hero:3.3,description:'Measured image motion releases coloured fragments from fast-moving regions. Their direction follows the source movement.'},
    {id:'freeze-orbit',name:'Impact, freeze and relight',kind:'motion',period:12,hero:1.6,description:'A music attack cues a held kick or block. The camera circles real 3D geometry while lighting and surface treatment change.'},
  ];
  window.FXSignal={studies,async create(id,options){if(!studies.some(s=>s.id===id))throw new Error('Unknown signal effect: '+id);const effect=await (await import(base)).create(id,options);Object.assign(effect.canvas.style,{width:'100%',height:'100%',display:'block'});return effect;}};
})();
