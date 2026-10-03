// Updates the reported toll everywhere on the site from a new OCHA "Reported impact snapshot".
// Usage: node tools/update-toll.mjs 2026-09-30 74100 175300
// Normally not needed: the live manifest (branch live-data) updates the site without redeploying.
// This rewrites the figures built into the site, used when the live data cannot be reached.
// Checks first that the snapshot PDF exists, then rewrites dist/ and regenerates the English page.
// It then redraws the share images (tools/og/render.mjs, needs Playwright).
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const [date,killed,injured]=process.argv.slice(2);
if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d+$/.test(killed)||!/^\d+$/.test(injured)){console.error('Usage: node tools/update-toll.mjs AAAA-MM-JJ vies_perdues blessés');process.exit(1);}
const stateFile=new URL('toll.json',import.meta.url),old=JSON.parse(fs.readFileSync(stateFile,'utf8'));
const MONTHS_FR=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const MONTHS_FR_SHORT=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const MONTHS_EN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_EN_SHORT=['Jan','Feb','Mar','Apr','May','June','July','Aug','Sept','Oct','Nov','Dec'];
const forms=(iso,n1,n2)=>{const [y,m,d]=iso.split('-').map(Number),i=m-1;return {
 dates:[`${d} ${MONTHS_FR[i]} ${y}`,`${d} ${MONTHS_FR_SHORT[i]} ${y}`,`${d} ${MONTHS_EN[i]} ${y}`,`${d} ${MONTHS_EN_SHORT[i]} ${y}`,`${d}_${MONTHS_EN[i]}_${y}`],
 numbers:[n1,n2].map(n=>{const s=String(n),g=s.replace(/\B(?=(\d{3})+(?!\d))/g,'\u0001');return [g.replaceAll('\u0001',' '),g.replaceAll('\u0001',' '),g.replaceAll('\u0001',' '),g.replaceAll('\u0001',','),s];})};};
const from=forms(old.date,old.killed,old.injured),to=forms(date,+killed,+injured);
const url=`https://www.ochaopt.org/sites/default/files/Gaza_Reported_Impact_Snapshot_${to.dates[4]}.pdf`;
try{const code=execFileSync('curl',['-s','-o','/dev/null','-w','%{http_code}','-m','30',url]).toString();if(code!=='200')throw Error(code);}catch(e){console.error('Fiche OCHA introuvable : '+url+' ('+e.message+')');process.exit(1);}
const pairs=[];from.dates.forEach((d,i)=>pairs.push([d,to.dates[i]]));
pairs.push([old.date,date]);
for(const k of [0,1])from.numbers[k].forEach((n,i)=>pairs.push([n,to.numbers[k][i]]));
const dist=new URL('../dist/',import.meta.url);let total=0;
for(const file of ['index.html','app.js','map-extras.js','en.js','tour.js','live.js']){
 let s=fs.readFileSync(new URL(file,dist),'utf8'),n=0;
 // whole numbers only, so that 73922 inside a longer number is left alone
 for(const [a,b] of pairs){const re=new RegExp('(?<![\\d.,])'+a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\d])','g');s=s.replace(re,()=>{n++;return b;});}
 fs.writeFileSync(new URL(file,dist),s);console.log(file,n,'remplacements');total+=n;
}
fs.writeFileSync(stateFile,JSON.stringify({date,killed:+killed,injured:+injured})+'\n');
execFileSync('node',[new URL('make-en.mjs',import.meta.url).pathname],{stdio:'inherit'});
try{execFileSync('node',[new URL('og/render.mjs',import.meta.url).pathname],{stdio:'inherit'});}catch{console.log('Images de partage non redessinées (Playwright absent) : lancez node tools/og/render.mjs.');}
console.log(total,'remplacements. Vérifiez les noms de communes de l’image de partage et montez le numéro de version dans index.html.');
