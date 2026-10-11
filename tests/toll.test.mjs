// Checks the reading of OCHA snapshots (tools/live/parse-toll.mjs), which publishes the toll without review.
// Run with: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {latestSnapshot,parseSnapshot} from '../tools/live/parse-toll.mjs';
// Text of the 30 September 2026 snapshot as pdftotext prints it.
const text=fs.readFileSync(new URL('fixtures/ocha-snapshot-2026-09-30.txt',import.meta.url),'utf8');
const previous={date:'2026-09-23',killed:73922,injured:174995};

test('reads the toll of a real snapshot', ()=>{
 assert.deepEqual(parseSnapshot(text,previous),{date:'2026-09-30',killed:74032,injured:175142});
});

test('refuses a snapshot that is not newer than the published toll', ()=>{
 assert.throws(()=>parseSnapshot(text,{date:'2026-09-30',killed:73922,injured:174995}),/not after/);
});

test('refuses implausible figures', ()=>{
 // Fewer lives lost than already published, or a jump of more than 5 %, means the layout was misread.
 assert.throws(()=>parseSnapshot(text,{...previous,killed:74100}),/lives lost/);
 assert.throws(()=>parseSnapshot(text,{...previous,killed:60000}),/lives lost/);
 assert.throws(()=>parseSnapshot(text.replace('175,142','175,142\n175,500'),previous),/injured not found or ambiguous/);
});

test('refuses a changed layout', ()=>{
 assert.throws(()=>parseSnapshot(text.replace('REPORTED CASUALTIES (Cumulative) as of','REPORTED CASUALTIES'),previous),/date not found/);
 assert.throws(()=>parseSnapshot(text.replace('Reported fatalities include','Fatalities'),previous),/lives lost/);
 assert.throws(()=>parseSnapshot(text.replace('(Cumulative) as of 30 September 2026','(Cumulative) as of 30 Septembre 2026'),previous),/date not found/);
});

test('finds the latest snapshot on the publications page', ()=>{
 const html='<a href="/content/reported-impact-snapshot-gaza-strip-23-september-2026">a</a><a href="/content/reported-impact-snapshot-gaza-strip-7-october-2026">b</a><a href="/content/reported-impact-snapshot-gaza-strip-30-september-2026">c</a>';
 assert.deepEqual(latestSnapshot(html),{path:'/content/reported-impact-snapshot-gaza-strip-7-october-2026',date:'2026-10-07'});
 assert.equal(latestSnapshot('<p>nothing</p>'),null);
});
