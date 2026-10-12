(() => {
 FX.demo({id:'dialogue-lipsync',name:'Speech, expression and lip sync',kind:'character',grade:'B',stacks:['three','canvas'],chips:['recorded speech + mouth cues','facial rig / authored performance'],purpose:'Nine speech mouth shapes, independently animated eyes and brows, and timed gestures. The finished dialogue also demonstrates listening reactions and camera cuts.',period:9.6,hero:2.4,aspect:'16 / 9',build(stage){
  const ready=FXDialogue.create().then(e=>{e.canvas.className='fill';Object.assign(e.canvas.style,{width:'100%',height:'100%',display:'block'});stage.append(e.canvas);return e;});
  return{ready,frame:async t=>(await ready).frame(t,{branding:false,captions:false})};
 }});
})();
