export const STYLE_PRESETS = Object.freeze([
  { id: 'original', name: '原畫', mode: 'original', background: '#f1eee7' },
  { id: 'poster', name: '四色版畫', mode: 'poster', colors: ['#223749','#bc5946','#daa86a','#f2ddaf'], background: '#eee0c4' },
  { id: 'ink', name: '墨線排線', mode: 'ink', colors: ['#1e302e','#3b4a40','#7d8878','#ede8d5'], background: '#ede8d5' },
  { id: 'pixel', name: '像素方塊', mode: 'pixel', step: 5, colors: ['#223b56','#526f83','#d6a566','#efddae'], background: '#e3e4d9' },
  { id: 'dots', name: '明暗點陣', mode: 'dots', step: 5, ink: '#263651', background: '#f4ecd6' },
  { id: 'ascii', name: '文字畫法', mode: 'ascii', step: 7, ink: '#224538', background: '#ebefd9' },
  { id: 'etch', name: '交叉刻線', mode: 'etch', colors: ['#303336','#6e6960','#b2a38d','#e4d9c6'], background: '#e4d9c6' },
  { id: 'duotone', name: '雙色版畫', mode: 'poster', colors: ['#263b51','#263b51','#e78367','#f2c887'], background: '#ead6bc' },
]);
export function resolveStyle(input = 'original') {
  const s = typeof input === 'string' ? STYLE_PRESETS.find(s => s.id === input) : input;
  if (!s || !['original','poster','ink','pixel','dots','ascii','etch'].includes(s.mode)) throw new Error(`Unknown style: ${typeof input === 'string' ? input : input?.mode}`);
  if (s.colors && (s.colors.length !== 4 || s.colors.some(c => !/^#[0-9a-f]{6}$/i.test(c)))) throw new Error('Style colors require four #RRGGBB values');
  if (s.step != null && (!Number.isInteger(s.step) || s.step < 1)) throw new Error('Style step must be a positive integer');
  return s;
}
export const luminance = (r,g,b) => .2126*r + .7152*g + .0722*b;
export function quantizeRGBA(data, style) {
  const s = resolveStyle(style), out = new Uint8ClampedArray(data.length);
  if (data.length % 4) throw new Error('RGBA buffer length must be divisible by four');
  const colors = (s.colors || ['#223749','#bc5946','#daa86a','#f2ddaf']).map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
  for(let i=0;i<data.length;i+=4){const L=luminance(data[i],data[i+1],data[i+2]);const c=colors[L<105?0:L<180?1:L<228?2:3];out[i]=c[0];out[i+1]=c[1];out[i+2]=c[2];out[i+3]=data[i+3];}
  return out;
}
