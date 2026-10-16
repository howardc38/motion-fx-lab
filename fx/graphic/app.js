export const STUDIES=[
 {id:'graphic-field',module:'fields',mode:'field',name:'Force-field dot deformation',kind:'motion',period:9.6,hero:2.4,purpose:'An authored attractor pulls and twists a regular dot grid, which recovers to its rest positions. A second setting sends a three-dimensional wave through the grid.'},
 {id:'graphic-fill',module:'type',mode:'fill',name:'Animated glyph interiors',kind:'type',period:9.6,hero:4.9,purpose:'Keep the glyph silhouette while moving stripes, a two-dimensional liquid level or a two-colour boundary inside it. The liquid is an authored mask, not a fluid simulation.'},
 {id:'graphic-network',module:'fields',mode:'network',name:'Proximity particle connections',kind:'backdrop',period:9.6,hero:2.4,purpose:'Moving particles connect only below a chosen distance. Links fade with distance and pulses travel along the surviving edges.'},
 {id:'graphic-shadow',module:'type',mode:'shadow',name:'Graphic long-shadow type',kind:'type',period:9.6,hero:1.6,purpose:'Extrude a flat glyph silhouette along a controllable two-dimensional direction and length. A rotating graphic shadow changes the weight of the same word.'},
 {id:'graphic-flap',module:'type',mode:'flap',name:'Split-flap lettering',kind:'ui',period:4.8,hero:1.62,purpose:'Top and bottom halves exchange in order around the hinge, with clipped glyphs, shading and staggered landings.'},
 {id:'graphic-reels',module:'type',mode:'reels',name:'Rolling numbers and word reels',kind:'type',period:9.6,hero:2.4,purpose:'Clipped digit reels carry into the next column. The word setting spins, brakes and lands on readable letters.'},
 {id:'graphic-bands',module:'type',mode:'bands',name:'Counter-moving text bands',kind:'type',period:9.6,hero:7.7,purpose:'Compare large horizontal scrolling, counter-moving vertical CJK columns and crossing diagonal text ribbons.'},
 {id:'graphic-spatial',module:'spatial',name:'Cylinder, tunnel and corridor type',kind:'type',period:9.6,hero:1.6,purpose:'Counter-rotate text around a real cylinder, travel through layered word planes, then fly between walls of lettering. Perspective, depth and occlusion come from three-dimensional geometry.'},
 {id:'graphic-tiles',module:'tiles',name:'Fill, shift and turn a grid',kind:'backdrop',period:9.6,hero:1.2,purpose:'A seeded grid fills in order, shifts its rows and turns triangular tiles in travelling waves.'},
 {id:'graphic-led',module:'type',mode:'led',name:'LED matrix lettering',kind:'light',period:9.6,hero:2.4,purpose:'Sample editable glyph silhouettes into a scrolling dot matrix. Lit cells and a visible unlit grid retain the structure of a display.'},
 {id:'graphic-echo',module:'type',mode:'echo',name:'Temporal lettering echoes',kind:'motion',period:9.6,hero:2.4,purpose:'Render the same moving word at five actual source times, with separate colours. No accumulated frame buffer is required.'},
];
export async function create(id,options={}){
 const spec=STUDIES.find(s=>s.id===id);if(!spec)throw Error('Unknown graphic study '+id);
 const mod=await import('./'+spec.module+'.js');
 return spec.module==='type'||spec.module==='fields'?mod.create(spec.mode,options):mod.create(options);
}
export const EXTENSIONS=[
 {id:'graphic-flap',at:[0,4.8],offset:0},
 {id:'graphic-reels',at:[4.8,9.6],offset:3.2},
 {id:'graphic-bands',at:[9.6,14.4],offset:0},
 {id:'graphic-spatial',at:[14.4,21.6],offset:0},
 {id:'graphic-tiles',at:[21.6,26.4],offset:0},
 {id:'graphic-led',at:[26.4,30],offset:0},
 {id:'graphic-echo',at:[30,33.6],offset:0},
];
