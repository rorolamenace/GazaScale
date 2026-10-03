// Reads the latest OCHA "Reported impact snapshot | Gaza Strip" and updates the toll in the live manifest.
// Usage: node tools/live/fetch-toll.mjs path/to/manifest.json
// Needs pdftotext (poppler-utils). Writes "changed=true|false" to $GITHUB_OUTPUT when set.
// Fails (exit 1) with a message when the snapshot cannot be read safely: the site then keeps the previous toll.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const file=process.argv[2];if(!file)throw Error('manifest path missing');
const manifest=JSON.parse(fs.readFileSync(file,'utf8')),old=manifest.toll;
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const iso=(d,m,y)=>`${y}-${String(MONTHS.indexOf(m.toLowerCase())+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const output=(k,v)=>{if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`${k}=${v}\n`);console.log(`${k}=${v}`);};
const get=async(url,type='text')=>{const r=await fetch(url,{headers:{'user-agent':'GazaScale live data (https://gazascale.org)'}});if(!r.ok)throw Error(`${url}: HTTP ${r.status}`);return type==='buffer'?Buffer.from(await r.arrayBuffer()):r.text();};

const list=await get('https://www.ochaopt.org/publications');
const found=[...list.matchAll(/\/content\/reported-impact-snapshot-gaza-strip-(\d{1,2})-([a-z]+)-(\d{4})/g)].map(m=>({path:m[0],date:iso(m[1],m[2],m[3])})).filter(s=>!s.date.includes('-00-'));
if(!found.length)throw Error('No Gaza snapshot found on https://www.ochaopt.org/publications');
const latest=found.sort((a,b)=>b.date.localeCompare(a.date))[0];
console.log('latest snapshot',latest.date,'current',old.date);
if(latest.date<=old.date){output('changed','false');process.exit(0);}

// The PDF link is on the snapshot page; fall back to the usual file name.
const page=await get('https://www.ochaopt.org'+latest.path);
const [y,m,d]=latest.date.split('-').map(Number),Month=MONTHS[m-1][0].toUpperCase()+MONTHS[m-1].slice(1);
const link=(page.match(/href="([^"]*Gaza_Reported_Impact_Snapshot[^"]*\.pdf)"/i)||[])[1];
const pdfUrl=link?new URL(link,'https://www.ochaopt.org').href:`https://www.ochaopt.org/sites/default/files/Gaza_Reported_Impact_Snapshot_${d}_${Month}_${y}.pdf`;
fs.writeFileSync('/tmp/snapshot.pdf',await get(pdfUrl,'buffer'));
const lines=execFileSync('pdftotext',['/tmp/snapshot.pdf','-']).toString().split('\n').map(s=>s.trim());
const num=s=>/^\d{1,3}(,\d{3})+$/.test(s)?Number(s.replace(/,/g,'')):null;

// Reported date of the casualty figures.
const dateLine=lines.find(l=>/REPORTED CASUALTIES \(Cumulative\) as of/i.test(l));
const dm=dateLine?.match(/as of (\d{1,2}) ([A-Za-z]+) (\d{4})/);
if(!dm)throw Error('Casualty date not found in '+pdfUrl);
const date=iso(dm[1],dm[2],dm[3]);
// Lives lost: the figure printed just before "Reported fatalities include".
const fi=lines.findIndex(l=>/^Reported fatalities include/i.test(l));
let killed=null;for(let i=fi-1;i>=0&&i>fi-6;i--){if(num(lines[i])!==null){killed=num(lines[i]);break;}}
// Injured: the only standalone figure close above the previous one.
const injuredCandidates=[...new Set(lines.map(num).filter(v=>v!==null&&v>=old.injured&&v<=old.injured*1.05))];
const injured=injuredCandidates.length===1?injuredCandidates[0]:null;
const problems=[];
if(killed===null||killed<old.killed||killed>old.killed*1.05)problems.push(`lives lost not found or implausible (${killed}, previous ${old.killed})`);
if(injured===null)problems.push(`injured not found or ambiguous (${injuredCandidates.join(', ')||'none'}, previous ${old.injured})`);
if(date<=old.date)problems.push(`date ${date} not after ${old.date}`);
if(problems.length)throw Error('Snapshot '+pdfUrl+' not applied: '+problems.join('; '));
manifest.toll={date,killed,injured,source:pdfUrl};
fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
output('changed','true');output('date',date);
console.log('toll updated',manifest.toll);
