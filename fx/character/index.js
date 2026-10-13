export { CutoutRig, loadRig, validateRig, restPose, skinVertex } from './rig.js';
export { sampleMotion } from './motion.js';
export { solveIK, sampleTrack } from './math.js';
export { STYLE_PRESETS, resolveStyle, quantizeRGBA } from './palette.js';
export { SubjectStyles } from './styles.js';
export { CharacterScene } from './scene.js';

import { loadRig } from './rig.js';
import { sampleMotion } from './motion.js';
import { SubjectStyles } from './styles.js';
// A transparent canvas source usable by compositors and pixel effects.
// It supplies art/poses, not a storyboard or a mandatory movie structure.
export async function createCharacterSource(input, options={}){
  const rig=await loadRig(input,options),styles=new SubjectStyles();
  return {rig,styles,pose:t=>sampleMotion(rig.definition,options.motion||'idle',t,options.motionOverrides),
    frame(t,{motion=options.motion||'idle',style=options.style||'original',skeleton=false,overrides=options.motionOverrides}={}){
      return styles.frame(rig.frame(sampleMotion(rig.definition,motion,t,overrides),{skeleton}),style);
    }};
}
