(() => {
 // The tile plays "Say it. Mean it." with enlarged word captions and the mouth-cue strip, so the
 // silent preview still shows which word and which of the nine mouth shapes are live.
 FX.demo({id:'dialogue-lipsync',name:'Speech, expression and lip sync',kind:'character',grade:'B',stacks:['three','glsl','canvas'],chips:['recorded speech → 9 mouth cues','word-timed captions','plush puppet mouth / robot screen face'],purpose:'One recording drives nine analysed mouth shapes on a plush bear: lips, felt teeth, tongue and a dropping jaw. Three named expressions, word-by-word captions, then the same cues on a robot face.',period:11.6,hero:2.56,aspect:'16 / 9',build(stage){
  const ready=FXDialogue.create('character-lipsync',{width:960,height:540,mode:'tile'}).then(e=>{e.canvas.className='fill';Object.assign(e.canvas.style,{width:'100%',height:'100%',display:'block'});stage.append(e.canvas);return e;});
  return{ready,frame:async t=>(await ready).frame(t,{branding:false,captions:true})};
 }});
})();
