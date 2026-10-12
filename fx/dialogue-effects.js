(() => {
 const base=new URL('./dialogue/scene.js',document.currentScript.src);
 window.FXDialogue={create:name=>import(base.href).then(m=>m.createFilm(name||'character-lipsync'))};
})();
