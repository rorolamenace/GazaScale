// Draws the share images (dist/brand/partage.png and partage-en.png) from tools/toll.json.
// Needs Playwright and Chromium: node tools/og/render.mjs
// The map (map.jpg) shows Gaza over Chambéry; check the commune names below when the toll changes a lot.
import fs from 'node:fs';
const playwright=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(playwright);
const here=new URL('./',import.meta.url),dist=new URL('../../dist/',import.meta.url);
const toll=JSON.parse(fs.readFileSync(new URL('../toll.json',import.meta.url),'utf8'));
const [y,m,d]=toll.date.split('-').map(Number);
const MFR=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],MEN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const nfr=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' '),nen=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const texts={
 fr:{title:'Et si Gaza était près de chez vous ?',lives:`<b>${nfr(toll.killed)} vies perdues</b> : l’équivalent de Chambéry, Cognin, Bassens et d’une partie de Jacob-Bellecombette`,injured:`<b>${nfr(toll.injured)} blessés</b> : 92 communes, sous le contour puis autour`,buildings:'<b>81 % des bâtiments</b> détruits ou endommagés',date:`Bilan rapporté au ${d} ${MFR[m-1]} ${y}`,tag:'Gaza posée sur Chambéry · 365 km²'},
 en:{title:'What if Gaza were near you?',lives:`<b>${nen(toll.killed)} lives lost</b>: the equivalent of Chambéry, Cognin, Bassens and part of Jacob-Bellecombette`,injured:`<b>${nen(toll.injured)} injured</b>: 92 municipalities, under the outline and around it`,buildings:'<b>81% of buildings</b> destroyed or damaged',date:`Toll reported as of ${d} ${MEN[m-1]} ${y}`,tag:'Gaza laid over Chambéry · 365 km²'}};
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
for(const [lang,t] of Object.entries(texts)){
 const page=await browser.newPage({viewport:{width:1200,height:560}});
 const html=fs.readFileSync(new URL('template.html',here),'utf8').replace(/\{(\w+)\}/g,(s,k)=>t[k]??s);
 await page.route('http://og.local/**',r=>{const u=new URL(r.request().url()).pathname;
  if(u==='/')return r.fulfill({body:html,contentType:'text/html'});
  const f=u.startsWith('/fonts/')?new URL('.'+u,dist):new URL('.'+u,here);
  r.fulfill({body:fs.readFileSync(f),contentType:u.endsWith('.woff2')?'font/woff2':u.endsWith('.jpg')?'image/jpeg':'image/png'});});
 await page.goto('http://og.local/');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
 const out=new URL(lang==='fr'?'brand/partage.png':'brand/partage-en.png',dist);
 await page.screenshot({path:out.pathname});console.log('written',out.pathname);await page.close();
}
await browser.close();
