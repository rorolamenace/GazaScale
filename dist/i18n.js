/* Language: French is written in the page; English replaces it at load time.
   Choice order: ?lang=, then the visitor's last choice, then the browser language. */
(function(){
 const q=new URLSearchParams(location.search).get('lang');let stored=null;try{stored=localStorage.getItem('gazascale-lang');}catch{}
 const lang=q==='en'||q==='fr'?q:stored==='en'||stored==='fr'?stored:/^fr\b/i.test(navigator.language||'fr')?'fr':'en';
 if(q==='en'||q==='fr'){try{localStorage.setItem('gazascale-lang',q);}catch{}}
 window.LANG=lang;document.documentElement.lang=lang;
 const norm=s=>s.replace(/\s+/g,' ').trim();
 // t('texte français', {n:…}) returns the English text when the page is in English; {n} placeholders are filled either way.
 window.t=(fr,vars)=>{let s=lang==='en'&&window.EN_STRINGS?.[fr]!==undefined?window.EN_STRINGS[fr]:fr;if(vars)s=s.replace(/\{(\w+)\}/g,(m,k)=>vars[k]??m);return s;};
 window.translatePage=root=>{
  if(lang!=='en'||!window.EN_STRINGS)return;const dict=window.EN_STRINGS,blocks=window.EN_BLOCKS||{};
  const INLINE=/^(B|A|I|BR|EM|STRONG|SMALL|SPAN|SUP|ABBR)$/;
  const walk=el=>{
   if(/^(SCRIPT|STYLE|svg)$/i.test(el.tagName))return;
   const kids=[...el.childNodes];
   if(kids.some(n=>n.nodeType===3&&norm(n.textContent))&&kids.some(n=>n.nodeType===1&&INLINE.test(n.tagName))){const key=norm(el.innerHTML);if(blocks[key]!==undefined){el.innerHTML=blocks[key];return;}}
   for(const n of kids){if(n.nodeType===3){const key=norm(n.textContent);if(key&&dict[key]!==undefined){const lead=n.textContent.match(/^\s*/)[0],trail=n.textContent.match(/\s*$/)[0];n.textContent=lead+dict[key]+trail;}}else if(n.nodeType===1)walk(n);}
  };
  walk(root);
  root.querySelectorAll('[title],[aria-label],[placeholder],[alt],option').forEach(e=>{for(const a of ['title','aria-label','placeholder','alt']){const v=e.getAttribute(a);if(v&&dict[norm(v)]!==undefined)e.setAttribute(a,dict[norm(v)]);}});
 };
 const apply=()=>{
  if(lang==='en'){document.title=t(document.title);window.translatePage(document.body);}
  const button=document.getElementById('lang-toggle');
  if(button){button.textContent=lang==='en'?'FR':'EN';button.setAttribute('aria-label',lang==='en'?'Afficher le site en français':'Show the site in English');button.lang=lang==='en'?'fr':'en';
   button.onclick=()=>{const next=lang==='en'?'fr':'en';try{localStorage.setItem('gazascale-lang',next);sessionStorage.setItem('gazascale-restore',JSON.stringify(window.gazaSnapshot?.()??null));}catch{}const url=new URL(location.href);url.searchParams.set('lang',next);location.replace(url);};}
 };
 // Loaded at the end of <body>, so the page is already there: translate it before the other scripts read it.
 apply();
})();
