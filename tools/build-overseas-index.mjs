// Builds dist/overseas-index.js: the small subset of dist/overseas.js needed before it loads
// (menu icons and search entries). Run with: node tools/build-overseas-index.mjs
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
globalThis.window=globalThis;
const turf=require('../dist/turf.min.js');
require('../dist/overseas.js');
const data=window.OVERSEAS_DATA;
const round=v=>Math.round(v*10)/10;
function iconPath(feature){
 const p=feature.properties,parts=turf.flatten(feature).features,largest=Math.max(...parts.map(f=>turf.area(f)));
 const shown=parts.filter(f=>turf.area(f)>largest*.005&&turf.distance(turf.point([p.lng,p.lat]),turf.pointOnFeature(f))<600);
 let shapes=shown.length?shown:parts;
 if(['986','987'].includes(p.code)){const main=parts.reduce((a,b)=>turf.area(a)>turf.area(b)?a:b),origin=turf.pointOnFeature(main);shapes=parts.filter(f=>turf.area(f)>largest*.005&&turf.distance(origin,turf.pointOnFeature(f))<65);}
 const bounds=turf.bbox(turf.featureCollection(shapes)),cos=Math.cos(p.lat*Math.PI/180),w=(bounds[2]-bounds[0])*cos,h=bounds[3]-bounds[1],scale=48/Math.max(w,h);
 return shapes.map(f=>f.geometry.coordinates.map(ring=>{
  const points=[];for(const c of ring){const q=[round(32+(c[0]-(bounds[0]+bounds[2])/2)*cos*scale),round(32-(c[1]-(bounds[1]+bounds[3])/2)*scale)];const last=points.at(-1);if(!last||last[0]!==q[0]||last[1]!==q[1])points.push(q);}
  if(points.length<4)return '';
  const simple=turf.simplify(turf.lineString(points),{tolerance:.35,highQuality:true}).geometry.coordinates;
  return simple.length<3?'':simple.map((q,i)=>(i?'L':'M')+q[0]+','+q[1]).join('')+'Z';
 }).join('')).join('');
}
const territories=data.territories.map(f=>{const {code,nom,lat,lng,zoom}=f.properties;return {code,nom,lat,lng,zoom,path:iconPath(f)};});
const places=Object.values(data.seeds).flat().map(f=>{const c=turf.pointOnFeature(f).geometry.coordinates;return {nom:f.properties.nom,code:f.properties.code,population:f.properties.population,centre:{type:'Point',coordinates:[+c[0].toFixed(5),+c[1].toFixed(5)]}};});
writeFileSync(new URL('../dist/overseas-index.js',import.meta.url),'window.OVERSEAS_INDEX='+JSON.stringify({territories,places})+';\n');
console.log(territories.length,'territories,',places.length,'places');
