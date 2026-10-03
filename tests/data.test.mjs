// Checks the commune data outside France and Switzerland, and the English page.
// Run with: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dist=new URL('../dist/',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,dist),'utf8');
const json=path=>JSON.parse(read(path));
const load=file=>{globalThis.window={};new Function('window',read(file))(globalThis.window);return globalThis.window;};

test('every world and United States index entry has its file', ()=>{
 const index=json('wd/index.json');
 assert.ok(index.length>3000);
 for(const e of index){const dir={'WD-':'wd/','US-':'us/'}[e.code.slice(0,3)];assert.ok(dir,e.code);assert.ok(fs.existsSync(new URL(dir+e.code.slice(3)+'.json',dist)),e.code);}
});

test('the Gaza Strip adds up to the PCBS late-2025 estimate', ()=>{
 const gaza=json('wd/GZ-17_15.json').features;
 assert.equal(gaza.length,5);
 const total=gaza.reduce((s,f)=>s+f.properties.population,0);
 assert.ok(Math.abs(total-2130000)<10,String(total));
});

test('every European and Italian region has its file of communes', ()=>{
 const w=load('europe.js'),it=load('italy.js');
 for(const f of w.EUROPE_DATA.features)assert.ok(fs.existsSync(new URL('eu/'+f.properties.code.slice(3)+'.json',dist)),f.properties.code);
 for(const f of it.ITALY_DATA.provinces.features)assert.ok(fs.existsSync(new URL('it/'+f.properties.code.slice(3)+'.json',dist)),f.properties.code);
});

test('every Swiss canton and Israel / West Bank region has its file', ()=>{
 for(const f of load('swiss.js').SWISS_DATA.cantons.features)assert.ok(fs.existsSync(new URL('ch/'+f.properties.code.slice(3)+'.json',dist)),f.properties.code);
 for(const f of load('middle-east.js').MIDDLE_EAST_DATA.regions.features)assert.ok(fs.existsSync(new URL('me/'+f.properties.code.slice(3)+'.json',dist)),f.properties.code);
});

test('every text shown by the scripts has an English version', ()=>{
 const en=load('en.js').EN_STRINGS;
 for(const file of ['app.js','map-extras.js','tour.js']){
  for(const m of read(file).matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)){
   const key=m[1];if(key.length<8||/^[.#\[]|[{}](?!\w*})/.test(key)&&!/\{\w+\}/.test(key))continue;
   assert.ok(en[key]!==undefined,`${file}: ${key}`);
  }
 }
});

test('the English page differs from the French one only in its head', ()=>{
 const body=html=>html.replace(/<head>[\s\S]*<\/head>/,'').replace('<html lang="fr">','').replace('<html lang="en">','');
 assert.equal(body(read('index.en.html')),body(read('index.html')),'run node tools/make-en.mjs');
});
