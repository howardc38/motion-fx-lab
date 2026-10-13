import { PointField } from '../studio/point-field.js';
import { resolveStyle, quantizeRGBA, luminance } from './palette.js';
export class SubjectStyles {
  constructor() { this.canvas = document.createElement('canvas'); this.field = new PointField(); }
  frame(source, input = 'original') {
    const s=resolveStyle(input);if(s.mode==='original')return source;
    const w=source.width,h=source.height,c=this.canvas;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
    const g=c.getContext('2d',{willReadFrequently:true});g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);
    const rgba=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),data=rgba.data,step=s.step||5;
    if(s.mode==='dots'){
      const f=this.field.sample(data,w,h,step);g.fillStyle=s.ink||'#263651';
      for(let i=0;i<f.count;i++){const [x,y]=f.xy(i),k=(y*w+x)*4,L=luminance(data[k],data[k+1],data[k+2])/255,r=step*(.08+.88*(1-L)**1.35);g.globalAlpha=data[k+3]/255;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}
    }else if(s.mode==='ascii'){
      const chars=s.characters||'@#%*+=·';g.fillStyle=s.ink||'#224538';g.font=`bold ${step+1}px monospace`;g.textBaseline='top';
      for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const k=(y*w+x)*4;if(data[k+3]<95)continue;const L=luminance(data[k],data[k+1],data[k+2]);g.globalAlpha=data[k+3]/255;g.fillText(chars[Math.min(chars.length-1,Math.floor(L/256*chars.length))],x,y);}
    }else{
      const mapped=quantizeRGBA(data,s);
      if(s.mode==='pixel'){
        for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const X=Math.min(w-1,x+Math.floor(step/2)),Y=Math.min(h-1,y+Math.floor(step/2)),k=(Y*w+X)*4;if(mapped[k+3]<95)continue;g.globalAlpha=mapped[k+3]/255;g.fillStyle=`rgb(${mapped[k]},${mapped[k+1]},${mapped[k+2]})`;g.fillRect(x,y,step-.5,step-.5);}
      }else{
        g.putImageData(new ImageData(mapped,w,h),0,0);
        if(s.mode==='ink'||s.mode==='etch'){
          g.globalCompositeOperation='source-atop';g.strokeStyle=s.colors?.[0]||'#223749';g.lineWidth=.65;g.globalAlpha=.45;
          for(let x=-h;x<w;x+=7){g.beginPath();g.moveTo(x,0);g.lineTo(x+h,h);g.stroke();}
          if(s.mode==='etch')for(let x=0;x<w+h;x+=7){g.beginPath();g.moveTo(x,0);g.lineTo(x-h,h);g.stroke();}
        }
      }
    }
    g.globalAlpha=1;g.globalCompositeOperation='source-over';return c;
  }
}
