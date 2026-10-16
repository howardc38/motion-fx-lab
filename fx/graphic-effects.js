(() => {
 const base=new URL('./graphic/',document.currentScript.src);
 const studies=[
 ['field','Force-field dot deformation','motion',2.4],
 ['fill','Animated glyph interiors','type',4.9],
 ['network','Proximity particle connections','backdrop',2.4],
 ['shadow','Graphic long-shadow type','type',1.6],
 ['flap','Split-flap lettering','ui',1.62],
 ['reels','Rolling numbers and word reels','type',2.4],
 ['bands','Counter-moving text bands','type',7.7],
 ['spatial','Cylinder, tunnel and corridor type','type',1.6],
 ['tiles','Fill, shift and turn a grid','backdrop',1.2],
 ['led','LED matrix lettering','light',2.4],
 ['echo','Temporal lettering echoes','motion',2.4],
 ].map(([key,name,kind,hero])=>({id:'graphic-'+key,name,kind,hero,period:key==='flap'?4.8:9.6,stacks:key==='spatial'?['three','canvas']:['canvas']}));
 window.FXGraphic={studies,async create(id,o={}){return(await import(new URL('app.js',base))).create(id,o)}};
})();
