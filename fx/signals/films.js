import {createOrbit} from './orbit.js';
import {createFragments} from './fragments.js';
import {createRelief} from './relief.js';
export const FILMS={
  // Posters are hero frames: the leap at its slowed apex; the relief while the drop is still loud.
  'audio-relief':{title:'Pulse / Form',duration:12,poster:6.1333,effect:'audio-relief'},
  'motion-fragments':{title:'Motion / Release',duration:12,poster:3.5,effect:'motion-fragments'},
  'impact-orbit':{title:'Impact / Orbit',duration:12,poster:1.6,effect:'freeze-orbit'},
};
export async function create(id,options={}){
  if(id==='freeze-orbit')return createOrbit(options);
  if(id==='motion-fragments')return createFragments(options);
  if(id==='audio-relief')return createRelief(options);
  throw new Error('Unknown signal effect: '+id);
}
