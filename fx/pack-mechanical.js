(() => {
 for(const s of FXMechanical.studies)FX.demo({...s,stacks:['three','canvas','glsl'],grade:'B',aspect:'16 / 9',build(stage){
  const ready=FXMechanical.create(s.id).then(e=>{e.canvas.className='fill';Object.assign(e.canvas.style,{width:'100%',height:'100%',display:'block'});stage.append(e.canvas);return e});
  return{ready,frame:async t=>(await ready).frame(t,{labels:false})};
 }});
})();
