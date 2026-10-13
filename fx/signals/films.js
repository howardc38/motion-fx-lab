import {createOrbit} from './orbit.js';
import {createFragments} from './fragments.js';
import {createRelief} from './relief.js';
export const FILMS={
  // Posters are hero frames: the leap at its slowed apex; the relief while the drop is still loud
  // (a sustained frame, because delivery's poster seek can land a frame or two early).
  'audio-relief':{title:'Pulse / Form',duration:12,poster:6.1333,gif:[[.6,2.2],[5.6,7.4],[9.3,10.6]],effect:'audio-relief'},
  'motion-fragments':{title:'Motion / Release',duration:12,poster:3.5,gif:[[1.3,2.3],[2.45,4],[4.5,5.3],[6.6,7.4]],effect:'motion-fragments'},
  'impact-orbit':{title:'Impact / Orbit',duration:12,poster:1.6,gif:[[1.3,2.6],[3.0,4.2],[6.2,7.7],[8.2,9.3]],effect:'freeze-orbit'},
};
export async function create(id,options={}){
  if(id==='freeze-orbit')return createOrbit(options);
  if(id==='motion-fragments')return createFragments(options);
  if(id==='audio-relief')return createRelief(options);
  throw new Error('Unknown signal effect: '+id);
}
