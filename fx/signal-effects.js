(() => {
  const base=new URL('./signals/films.js',document.currentScript.src);
  const studies=[
    {id:'audio-relief',name:'Audio-driven solid relief',kind:'shader',period:12,hero:6.1333,description:'Measured loudness pushes a portrait out into solid pins; silence leaves it flat. The camera swings to a grazing angle to show the depth.'},
    {id:'motion-fragments',name:'Motion shatter and reassemble',kind:'motion',period:12,hero:3.5,description:'Measured optical flow decides where the subject breaks. Still or slow parts stay whole; fast parts shatter, trail the movement and fly back once it settles.'},
    {id:'freeze-orbit',name:'Impact, freeze and relight',kind:'motion',period:12,hero:1.6,description:'A music attack cues a held kick or block. The camera circles real 3D geometry while lighting and surface treatment change.'},
  ];
  window.FXSignal={studies,async create(id,options){if(!studies.some(s=>s.id===id))throw new Error('Unknown signal effect: '+id);const effect=await (await import(base)).create(id,options);Object.assign(effect.canvas.style,{width:'100%',height:'100%',display:'block'});return effect;}};
})();
