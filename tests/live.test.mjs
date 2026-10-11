// Checks dist/live.js: the live manifest rewrites the built-in toll, and nothing else.
// Run with: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../dist/live.js',import.meta.url),'utf8');
const BUILT=JSON.parse(fs.readFileSync(new URL('../tools/toll.json',import.meta.url),'utf8'));
// Runs live.js against a manifest, with just enough of a browser for it.
async function load(manifest){
 const window={t:(fr,vars)=>vars?fr.replace(/\{(\w+)\}/g,(m,k)=>vars[k]??m):fr};
 const document={title:'GazaScale',body:{},createTreeWalker:()=>({nextNode:()=>null}),querySelectorAll:()=>[]};
 const fetch=async()=>({ok:true,json:async()=>manifest});
 new Function('window','document','fetch','NodeFilter',source)(window,document,fetch,{SHOW_TEXT:4});
 await window.liveReady;return window;
}
const newer={date:'2026-09-30',killed:BUILT.killed+110,injured:BUILT.injured+147};
const group=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');

test('a newer toll replaces the built-in figures in texts', async()=>{
 const w=await load({toll:newer});
 assert.equal(w.TOLL.killed,newer.killed);
 assert.equal(w.t('vies perdues · bilan au 23 sept. 2026'),'vies perdues · bilan au 30 sept. 2026');
 assert.equal(w.t('Bilan au 23 September 2026, {n} lives',{n:'7'}),'Bilan au 30 September 2026, 7 lives');
 assert.equal(w.t(group(BUILT.killed)+' vies perdues'),group(newer.killed)+' vies perdues');
});

test('numbers that merely contain the old toll are left alone', async()=>{
 const w=await load({toll:newer});
 // A commune of 1 73 922-like size must keep its own population.
 const bigger=group(Number('1'+BUILT.killed)),ending=group(Number('2'+BUILT.injured));
 assert.equal(w.t('{n} habitants',{n:bigger}),bigger+' habitants');
 assert.equal(w.t('{n} habitants',{n:ending}),ending+' habitants');
 // Values passed in are never rewritten, even when equal to the old toll.
 assert.equal(w.t('{n} habitants',{n:group(BUILT.killed)}),group(BUILT.killed)+' habitants');
});

