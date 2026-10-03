// Recompose legacy portrait studies for the gallery; preserve film embeds.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  function group(svg, nodes, transform) {
    const g=document.createElementNS(NS,'g'); g.setAttribute('transform',transform);
    svg.append(g); nodes.forEach(n=>g.append(n)); return g;
  }
  function svgLayout(stage,id) {
    const svg=stage.querySelector('svg:not(.defs)');
    if (!svg || !svg.viewBox.baseVal.height) return;
    if (id==='timing') {
      svg.setAttribute('viewBox','0 0 800 450');
      const nodes=[...svg.children].filter(n=>n.tagName!=='defs');
      const split=nodes.findIndex(n=>n.tagName==='rect');
      group(svg,nodes.slice(0,split),'translate(0 85)');
      group(svg,nodes.slice(split,-1),'translate(400 -130)');
      nodes.at(-1).setAttribute('x','400'); nodes.at(-1).setAttribute('y','407');
    } else if (id==='drawflow') {
      svg.setAttribute('viewBox','0 0 800 450');
      const old=[[110,92],[290,196],[110,300],[290,404]];
      [...svg.querySelectorAll('.nd')].forEach((g,i)=>{
        const x=100+i*200,y=200;
        group(svg,[g],`translate(${x-old[i][0]} ${y-old[i][1]})`);
        const l=g.querySelector('.lb');l.setAttribute('x',old[i][0]);l.setAttribute('y',old[i][1]+85);l.setAttribute('text-anchor','middle');
      });
      [...svg.querySelectorAll('.cn')].forEach((p,i)=>p.setAttribute('d',`M${142+i*200} 200 L${258+i*200} 200`));
    } else if (id==='datachart') {
      // This source has a native wide layout; no canvas or SVG stretching.
    } else if (id==='blueprint') {
      svg.setAttribute('viewBox','-30 30 780 438.75');
      const card=[...svg.children].filter(n=>n.classList.contains('dr'));
      group(svg,card,'translate(80 0)');
      [...svg.querySelectorAll('.ld')].forEach(g=>{
        const c=g.querySelector('circle'),p=g.querySelector('path'),t=g.querySelector('text');
        const y=+c.getAttribute('cy'),ty=+t.getAttribute('y')-5;
        c.setAttribute('cx','276');p.setAttribute('d',`M276 ${y} L360 ${ty} L390 ${ty}`);t.setAttribute('x','400');
      });
    } else {
      const v=svg.viewBox.baseVal, w=v.height*16/9;
      svg.setAttribute('viewBox',`${v.x-(w-v.width)/2} ${v.y} ${w} ${v.height}`);
      // Labels use the new safe area, while circles and characters stay round.
      if(id==='morph') [...svg.querySelectorAll('text')].forEach(n=>n.setAttribute('x',n.getAttribute('text-anchor')==='end'?'590':'-190'));
    }
  }
  function mount(stage,d) {
    stage.classList.add('landscape'); stage.dataset.demo=d.id;
    stage.style.aspectRatio='16 / 9'; return stage;
  }
  function adapt(stage,d,built) {
    if(!d.aspect && !d.gl) svgLayout(stage,d.id);
    const frame=typeof built==='function'?built:built.frame;
    return {ready:typeof built==='function'?null:built.ready,frame:async(t,abs=t)=>{
      await frame(t,abs);
      if(d.id==='scan') {const bar=stage.querySelector('.scanbar');bar.style.top=`${7+Math.max(0,Math.min(1,(t-.3)/1.5))*23}cqw`;}
    }};
  }
  window.FXGalleryLayout={mount,adapt};
})();
