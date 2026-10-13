(() => {
 // createFilm(name, {width, height, mode}); the films default to 1280 x 720.
 const base=new URL('./dialogue/scene.js',document.currentScript.src);
 window.FXDialogue={create:(name,options)=>import(base.href).then(m=>m.createFilm(name||'character-lipsync',options))};
})();
