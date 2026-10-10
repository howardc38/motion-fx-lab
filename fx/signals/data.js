const cache = new Map();
const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
export const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
export const mix = (a,b,t) => a+(b-a)*t;
export const smooth = x => {x=clamp(x);return x*x*(3-2*x);};
export const ease = (t,a,b) => smooth((t-a)/(b-a));
export const hash = i => {const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export function finiteTime(t){if(!Number.isFinite(t))throw new Error('Frame time must be finite');return Math.max(0,t);}
const linear = Float32Array.from({length:256},(_,i)=>{const c=i/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});

export class Signals {
  static async load(url=new URL('../../assets/signals/manifest.json',import.meta.url)){
    url=new URL(url,document.baseURI).href;
    if(!cache.has(url)){
      const work=(async()=>{
        const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('Missing signal manifest');
        const spec=await response.json(),s=spec.source,a=spec.audio;
        if(spec.version!==1||s?.layout!=='rgba8-flow2-i16le'||s.stride!==8||!(s.fps>0)||!(s.period>0)||!Number.isInteger(s.count)||s.count<1||s.count>20000||!Number.isInteger(s.gridWidth)||!Number.isInteger(s.gridHeight)||s.gridWidth<1||s.gridHeight<1||s.gridWidth*s.gridHeight>100000||!(s.width>0)||!(s.height>0)||s.period>s.count/s.fps||s.flowScale!==256)throw new Error('Invalid signal frame metadata');
        const expected=s.count*s.gridWidth*s.gridHeight*8;
        if(s.decodedBytes!==expected||expected>200000000||!Array.isArray(a?.envelope)||!Array.isArray(a.rms)||!Array.isArray(a.bands)||!Array.isArray(a.onsets)||!Number.isInteger(a.count)||a.count<1||a.envelope.length!==a.count||a.rms.length!==a.count||a.bands.length!==a.count||!(a.fps>0)||!(a.duration>0)||!a.onsets.every((x,i)=>Number.isFinite(x)&&x>=0&&x<a.duration&&(!i||x>a.onsets[i-1]))||!a.envelope.every(x=>Number.isFinite(x)&&x>=0&&x<=1)||!a.rms.every(x=>Number.isFinite(x)&&x>=0)||!a.bands.every(row=>row.length===32&&row.every(x=>Number.isFinite(x)&&x>=0&&x<=1)))throw new Error('Invalid audio feature metadata');
        const sampleURL=new URL(spec.samples,url);sampleURL.searchParams.set('v',s.compressedSha256);
        const packedResponse=await fetch(sampleURL);if(!packedResponse.ok)throw new Error('Missing measured motion samples');
        const packed=await packedResponse.arrayBuffer();if(await sha(packed)!==s.compressedSha256)throw new Error('Compressed signal data hash mismatch');
        const decoded=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        if(decoded.byteLength!==expected||await sha(decoded)!==s.samplesSha256)throw new Error('Signal data is incomplete or changed');
        return new Signals(spec,decoded,url);
      })();
      cache.set(url,work);work.catch(()=>cache.delete(url));
    }
    return cache.get(url);
  }
  constructor(spec,buffer,url){this.spec=spec;this.audioSpec=spec.audio;this.source=spec.source;this.buffer=buffer;this.bytes=new Uint8Array(buffer);this.view=new DataView(buffer);this.url=url;this.cells=this.source.gridWidth*this.source.gridHeight;}
  index(t){t=finiteTime(t);return Math.min(this.source.count-1,Math.floor((t%this.source.period)*this.source.fps+1e-7));}
  audio(t){const a=this.audioSpec,x=clamp(finiteTime(t)*a.fps,0,a.count-1),i=Math.floor(x),j=Math.min(i+1,a.count-1),f=x-i;
    return{envelope:mix(a.envelope[i],a.envelope[j],f),rms:mix(a.rms[i],a.rms[j],f),bands:a.bands[i].map((v,k)=>mix(v,a.bands[j][k],f)),index:i};}
  frame(index,colors,flow,alpha){
    const base=index*this.cells*8;
    for(let i=0;i<this.cells;i++){const p=base+i*8,c=i*3;
      colors[c]=linear[this.bytes[p]];colors[c+1]=linear[this.bytes[p+1]];colors[c+2]=linear[this.bytes[p+2]];
      alpha[i]=this.bytes[p+3]/255;
      flow[i*2]=this.view.getInt16(p+4,true)/this.source.flowScale;flow[i*2+1]=this.view.getInt16(p+6,true)/this.source.flowScale;
    }
  }
  sample(index,cell){const p=(index*this.cells+cell)*8;return{alpha:this.bytes[p+3]/255,color:[linear[this.bytes[p]],linear[this.bytes[p+1]],linear[this.bytes[p+2]]],vx:this.view.getInt16(p+4,true)/256,vy:this.view.getInt16(p+6,true)/256};}
}
