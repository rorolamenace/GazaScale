/* Live figures: the reported toll is published apart from the site (branch live-data of the repository,
   served by nginx under /live/) and read at each visit, so a new OCHA snapshot needs no redeploy.
   The figures written in the page are the fallback; every text showing them is rewritten here. */
(function(){
 const BUILT_IN={date:'2026-09-23',killed:73922,injured:174995};
 const MONTHS={fr:['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],
  frShort:['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'],
  en:['January','February','March','April','May','June','July','August','September','October','November','December'],
  enShort:['Jan','Feb','Mar','Apr','May','June','July','Aug','Sept','Oct','Nov','Dec']};
 // Every way a date or a number of the toll is written on the site, in the same order for the old and the new toll.
 const forms=t=>{const [y,m,d]=t.date.split('-').map(Number),i=m-1,num=n=>{const g=String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'\u0001');return [' ',' ',' ',','].map(sep=>g.replaceAll('\u0001',sep)).concat(String(n));};
  return [[`${d} ${MONTHS.fr[i]} ${y}`,`${d} ${MONTHS.frShort[i]} ${y}`,`${d} ${MONTHS.en[i]} ${y}`,`${d} ${MONTHS.enShort[i]} ${y}`],num(t.killed),num(t.injured)];};
 let pairs=[];
 const valid=t=>t&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&Number.isInteger(t.killed)&&Number.isInteger(t.injured)&&t.killed>=BUILT_IN.killed&&t.injured>=BUILT_IN.injured&&t.killed<10000000&&t.injured<10000000&&t.date>=BUILT_IN.date;
 // One pass, and only whole figures: 173 922 inhabitants must not become 174 032 when 73 922 changes.
 let pattern=null,swap=null;
 const fix=s=>{if(!pattern||typeof s!=='string')return s;return s.replace(pattern,m=>swap.get(m));};
 window.TOLL={...BUILT_IN};
 // Commune files updated since the release (yearly populations): manifest.datasets[dir].files, or every file of dir.
 const DIRS=['eu','it','ch','me','wd','us'];window.LIVE_DATASETS={};
 window.dataUrl=path=>{const [dir,...rest]=path.split('/'),set=window.LIVE_DATASETS[dir];return set&&(!set.files||set.files.has(rest.join('/')))?'live/'+path:path;};
 window.tollFix=fix;
 // Only the sentence is corrected; the values filled in (populations, counts) are computed and stay as they are.
 const t0=window.t;if(t0)window.t=(fr,vars)=>{const s=fix(t0(fr));return vars?s.replace(/\{(\w+)\}/g,(m,k)=>vars[k]??m):s;};
 const rewrite=root=>{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const v=fix(n.textContent);if(v!==n.textContent)n.textContent=v;}
  for(const e of root.querySelectorAll('[title],[aria-label],[alt]'))for(const a of ['title','aria-label','alt']){const v=e.getAttribute(a);if(v){const f=fix(v);if(f!==v)e.setAttribute(a,f);}}};
 window.liveReady=new Promise(resolve=>{
  const timer=setTimeout(()=>resolve(null),3000);
  fetch('live/manifest.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(m=>{
   clearTimeout(timer);
   if(m&&m.datasets&&typeof m.datasets==='object')for(const dir of DIRS){const d=m.datasets[dir];if(d&&Number.isInteger(d.year))window.LIVE_DATASETS[dir]={year:d.year,files:Array.isArray(d.files)?new Set(d.files.filter(f=>typeof f==='string'&&/^[\w./-]+\.json$/.test(f)&&!f.includes('..'))):null};}
   if(m&&valid(m.toll)&&(m.toll.date!==BUILT_IN.date||m.toll.killed!==BUILT_IN.killed||m.toll.injured!==BUILT_IN.injured)){
    const a=forms(BUILT_IN),b=forms(m.toll);pairs=a.flatMap((list,k)=>list.map((v,j)=>[v,b[k][j]])).filter(([x,y])=>x!==y).sort((x,y)=>y[0].length-x[0].length);
    if(pairs.length){swap=new Map(pairs);const esc=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');pattern=new RegExp('(?<!\\d)(?<!\\d[ ,.\u00a0\u202f])(?:'+pairs.map(([x])=>esc(x)).join('|')+')(?!\\d)(?![ ,.\u00a0\u202f]\\d)','g');}
    window.TOLL={date:m.toll.date,killed:m.toll.killed,injured:m.toll.injured,source:typeof m.toll.source==='string'&&/^https:\/\/www\.ochaopt\.org\//.test(m.toll.source)?m.toll.source:null};
    rewrite(document.body);document.title=fix(document.title);
    if(window.TOLL.source)for(const a of document.querySelectorAll('a[href*="Gaza_Reported_Impact_Snapshot"]'))a.href=window.TOLL.source;
   }
   resolve(m||null);
  }).catch(()=>{clearTimeout(timer);resolve(null);});
 });
})();
