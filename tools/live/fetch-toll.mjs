// Reads the latest OCHA "Reported impact snapshot | Gaza Strip" and updates the toll in the live manifest.
// Usage: node tools/live/fetch-toll.mjs path/to/manifest.json
// Needs pdftotext (poppler-utils). Writes "changed=true|false" to $GITHUB_OUTPUT when set.
// Fails (exit 1) with a message when the snapshot cannot be read safely: the site then keeps the previous toll.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MONTHS,latestSnapshot,parseSnapshot} from './parse-toll.mjs';
const file=process.argv[2];if(!file)throw Error('manifest path missing');
const manifest=JSON.parse(fs.readFileSync(file,'utf8')),old=manifest.toll;
const output=(k,v)=>{if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`${k}=${v}\n`);console.log(`${k}=${v}`);};
const get=async(url,type='text')=>{const r=await fetch(url,{headers:{'user-agent':'GazaScale live data (https://gazascale.org)'}});if(!r.ok)throw Error(`${url}: HTTP ${r.status}`);return type==='buffer'?Buffer.from(await r.arrayBuffer()):r.text();};

const latest=latestSnapshot(await get('https://www.ochaopt.org/publications'));
if(!latest)throw Error('No Gaza snapshot found on https://www.ochaopt.org/publications');
console.log('latest snapshot',latest.date,'current',old.date);
if(latest.date<=old.date){output('changed','false');process.exit(0);}

// The PDF link is on the snapshot page; fall back to the usual file name.
const page=await get('https://www.ochaopt.org'+latest.path);
const [y,m,d]=latest.date.split('-').map(Number),Month=MONTHS[m-1][0].toUpperCase()+MONTHS[m-1].slice(1);
const link=(page.match(/href="([^"]*Gaza_Reported_Impact_Snapshot[^"]*\.pdf)"/i)||[])[1];
const pdfUrl=link?new URL(link,'https://www.ochaopt.org').href:`https://www.ochaopt.org/sites/default/files/Gaza_Reported_Impact_Snapshot_${d}_${Month}_${y}.pdf`;
fs.writeFileSync('/tmp/snapshot.pdf',await get(pdfUrl,'buffer'));
let toll;
try{toll=parseSnapshot(execFileSync('pdftotext',['/tmp/snapshot.pdf','-']).toString(),old);}
catch(e){throw Error('Snapshot '+pdfUrl+' not applied: '+e.message);}
const {date,killed,injured}=toll;
manifest.toll={date,killed,injured,source:pdfUrl};
fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
output('changed','true');output('date',date);
console.log('toll updated',manifest.toll);
