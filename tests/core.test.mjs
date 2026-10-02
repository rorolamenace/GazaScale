// Run with: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
globalThis.window=globalThis;
const turf=globalThis.turf=require('../dist/turf.min.js');
for(const file of ['data','communes','swiss','geometry','selection','neighbors'])require(`../dist/${file}.js`);
const {GazaGeometry,GazaSelection}=globalThis,data=window.ATLAS_DATA;
const km2=f=>turf.area(f)/1e6,geneva=[6.108,46.035];
// Swiss communes are split by canton in dist/ch/, loaded on demand by the site.
const fs=require('node:fs'),chDir=new URL('../dist/ch/',import.meta.url);
const swissCommunes=fs.readdirSync(chDir).flatMap(file=>JSON.parse(fs.readFileSync(new URL(file,chDir))).features);

test('le cercle et le contour gardent 365 km² partout', ()=>{
 const xy=GazaGeometry.prepare(data.gaza);
 for(const center of [geneva,[2.35,48.86],[-61.55,16.2],[166.45,-22.27]]){
  assert.ok(Math.abs(km2(GazaGeometry.circle(center))-365)<1,'cercle '+center);
  for(const angle of [0,37,90])assert.ok(Math.abs(km2(GazaGeometry.place(xy,center,angle))-365)<2,'contour '+center+' '+angle);
 }
});

test('la sélection atteint exactement le bilan sans dépasser', ()=>{
 const shape=GazaGeometry.circle(geneva),candidates=[...window.DEPARTMENT_COMMUNE_SEEDS['74'],...swissCommunes].filter(f=>turf.booleanIntersects(f,shape));
 const selection=GazaSelection.selectCommunes(candidates,geneva,73922,turf);
 assert.equal(selection.remaining,0);
 assert.equal(selection.selected.reduce((s,r)=>s+r.represented,0),73922);
 assert.ok(selection.selected.slice(0,-1).every(r=>r.fraction===1),'seule la dernière commune est partielle');
});

test('les blessés ne reprennent pas une commune entièrement réservée aux vies perdues', ()=>{
 const shape=GazaGeometry.circle(geneva),ring=turf.buffer(shape,40,{units:'kilometers'}),pool=[...window.DEPARTMENT_COMMUNE_SEEDS['74'],...swissCommunes];
 const lives=GazaSelection.selectCommunes(pool.filter(f=>turf.booleanIntersects(f,shape)),geneva,73922,turf);
 const injuries=GazaSelection.selectNeighbors(pool.filter(f=>turf.booleanIntersects(f,ring)),shape,geneva,174995,lives.selected,turf);
 const full=new Set(lives.selected.filter(r=>r.fraction===1).map(r=>r.feature.properties.code));
 assert.ok(injuries.selected.every(r=>!full.has(r.feature.properties.code)));
 assert.equal(injuries.selected.reduce((s,r)=>s+r.represented,0)+injuries.remaining,174995);
});

test('le raccourci par sommet donne les mêmes communes que le test complet', ()=>{
 const pool=[...window.DEPARTMENT_COMMUNE_SEEDS['74'],...swissCommunes];
 const fast=(f,s)=>turf.booleanPointInPolygon(turf.point(turf.coordAll(f)[0]),s)||turf.booleanIntersects(f,s);
 for(const center of [geneva,[6.6323,46.5197]]){
  const shape=turf.buffer(GazaGeometry.circle(center),40,{units:'kilometers'}),box=turf.bbox(shape);
  const near=pool.filter(f=>{const b=turf.bbox(f);return b[0]<=box[2]&&b[2]>=box[0]&&b[1]<=box[3]&&b[3]>=box[1];});
  assert.deepEqual(near.filter(f=>fast(f,shape)).map(f=>f.properties.code),near.filter(f=>turf.booleanIntersects(f,shape)).map(f=>f.properties.code));
 }
});

test('regions.json et l’index outre-mer sont cohérents avec les données', ()=>{
 const regions=require('../dist/regions.json');
 assert.equal(regions.features.length,13);
 for(const f of regions.features)assert.ok(data.stats.regions[f.properties.code],'stats '+f.properties.code);
 require('../dist/overseas-index.js');require('../dist/overseas.js');
 assert.deepEqual(window.OVERSEAS_INDEX.territories.map(t=>t.code),window.OVERSEAS_DATA.territories.map(f=>f.properties.code));
 assert.equal(window.OVERSEAS_INDEX.places.length,Object.values(window.OVERSEAS_DATA.seeds).flat().length);
});
