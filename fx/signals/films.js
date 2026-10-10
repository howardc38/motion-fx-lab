import {createField} from './field.js';
import {createOrbit} from './orbit.js';
export const FILMS={
  'audio-relief':{title:'Pulse / Form',duration:12,poster:2.43,gif:[[1.4,2.8],[3.2,4.5],[6.3,8.1]],effect:'audio-relief'},
  'motion-fragments':{title:'Motion / Release',duration:12,poster:3.25,gif:[[.35,1.4],[2.7,3.7],[6.1,7.5],[8.7,9.6]],effect:'motion-fragments'},
  'impact-orbit':{title:'Impact / Orbit',duration:12,poster:1.6,gif:[[1.3,2.6],[3.0,4.2],[6.2,7.7],[8.2,9.3]],effect:'freeze-orbit'},
};
export async function create(id,options={}){
  if(id==='freeze-orbit')return createOrbit(options);
  return createField(id,options);
}
