// Temples peeking past the hair: each look drawn twice (his hair, and shaved), and a page that compares the two row
// by row over the temples (crown to above the ears). Where the outermost drawn pixel on a row is the bare head and his
// hair starts just inside it, the head shows past the hair there. Open the page; it writes its findings to #out.
//   bash scripts/franchise2/run.sh scripts/franchise2/hair-peek.mjs <out.html> [hairs,csv]
import { writeFileSync } from 'node:fs'
import { faceSvg, buildLook, lookOf, coachLook, FACE_HAIR, FACE_HEAD } from '../../src/lib/franchise2/faces'
import { toUrl } from '../../src/lib/franchise2/faceArt'
const [out, only] = process.argv.slice(2)
const hairs = only ? only.split(',') : FACE_HAIR.map(x => x[0])
const base = { eyes: 'almond', brows: 'straight', nose: 'broad', mouth: 'full', beard: 'none', stache: 'none', gear: 'none', eb: 'none', expr: 'neutral' }
const looks = []
for (const hair of hairs) for (const [head] of FACE_HEAD) for (const [pos, k] of [['wr', -1], ['te', 0], ['ol', 1]]) for (const [skin, hc] of [['#5e3a22', '#16110e'], ['#eab996', '#5a3b24']]) for (const bone of [3, 501, 777])
  looks.push([`${hair} ${head} ${pos}${k} ${skin === '#eab996' ? 'w' : 'b'} bone${bone}`, buildLook({ pos, face: { ...base, hair, head, skin, hc, bone, wt: k, chk: k, jaw: k } })])
if (!only) {
  for (let i = 0; i < 300; i++) looks.push([`player ${i}`, lookOf(`peek-${i}`, ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db'][i % 8])])
  for (let i = 0; i < 120; i++) looks.push([`coach ${i}`, coachLook(`peek-c-${i}`, { ag: 36 + (i % 30) })])
}
const L = looks.filter(([, l]) => l.hair !== 'shaved' && l.gear !== 'durag' && !l.cap).map(([n, l]) => [n, toUrl(faceSvg(l, { color: '#0b2265' })), toUrl(faceSvg({ ...l, hair: 'shaved' }, { color: '#0b2265' }))])
const js = `
const L=${JSON.stringify(L)};
const W=463, px=u=>Math.round((u-3.2)*5);
const c=document.createElement('canvas');c.width=W;c.height=W;const x=c.getContext('2d',{willReadFrequently:true});
const load=u=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=u});
const get=async u=>{x.clearRect(0,0,W,W);const im=await load(u);if(im)x.drawImage(im,0,0,W,W);return x.getImageData(0,0,W,W).data};
(async()=>{const res=[];let q=0;for(const [n,a,b] of L){document.title=++q;const A=await get(a),B=await get(b);let worst=0,at='';
 for(let yu=19;yu<=34.4;yu+=0.4){const y=px(yu);for(const s of [-1,1]){
  let first=-1;for(let k=0;k<230;k++){const xx=s<0?k:W-1-k;const i=(y*W+xx)*4;if(A[i+3]>200){first=k;break}}
  if(first<0)continue;const fi=(y*W+(s<0?first:W-1-first))*4;const hair=i=>Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2])+Math.abs(A[i+3]-B[i+3])>40;
  if(hair(fi))continue;let h=-1;for(let k=first+1;k<first+20;k++){const xx=s<0?k:W-1-k;if(hair((y*W+xx)*4)){h=k;break}}
  if(h>0&&h-first>worst){worst=h-first;at=(s<0?'L':'R')+' y'+yu.toFixed(1)}}}
 if(worst>=2)res.push(n+' : '+worst+'px '+at)}
 document.getElementById('out').textContent=res.length+' of '+L.length+' peek'+String.fromCharCode(10)+res.join(String.fromCharCode(10))})()`
writeFileSync(out, `<!doctype html><meta charset="utf-8"><body><pre id="out">running</pre><script>${js}</script></body>`)
console.log('looks', L.length)
