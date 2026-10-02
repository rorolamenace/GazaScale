const $=id=>document.getElementById(id),fmt=(v,d=0)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(v);
const data=window.ATLAS_DATA,xy=GazaGeometry.prepare(data.gaza);
const swiss=window.SWISS_DATA;for(const f of swiss.cantons.features){data.departements.features.push(f);data.stats.departements[f.properties.code]={population:f.properties.population,surface:f.properties.surface};}for(const f of swiss.communes.features)f.bbox=turf.bbox(f);
// Regions and overseas territories load on demand; the metropolitan data is enough to start.
const homeBounds=turf.bbox(data.departements),overseasRegionCodes={'971':'01','972':'02','973':'03','974':'04','976':'06'};data.regions=null;
const loadScript=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('Chargement impossible : '+src));};document.head.append(script);});
function addOverseasRegions(){if(!data.regions||!window.OVERSEAS_DATA)return;for(const f of window.OVERSEAS_DATA.territories){const code=overseasRegionCodes[f.properties.code];if(!code||data.regions.features.some(r=>r.properties.code===code))continue;const r=JSON.parse(JSON.stringify(f));r.properties.code=code;r.bbox=turf.bbox(r);data.regions.features.push(r);data.stats.regions[code]={population:f.properties.population,surface:f.properties.surface};}}
let overseasLoading=null,regionsLoading=null,dataState='ready',dataToken=0;
function loadOverseas(){return overseasLoading??=loadScript('overseas.js').then(()=>{for(const f of window.OVERSEAS_DATA.territories){f.bbox=turf.bbox(f);data.departements.features.push(f);data.stats.departements[f.properties.code]={population:f.properties.population,surface:f.properties.surface};}Object.assign(communeCache,window.OVERSEAS_DATA.seeds);addOverseasRegions();if(level!=='regions')boundaryLayer.addData({type:'FeatureCollection',features:window.OVERSEAS_DATA.territories});}).catch(error=>{overseasLoading=null;throw error;});}
function loadRegions(){return regionsLoading??=fetch('regions.json').then(response=>{if(!response.ok)throw Error('Régions indisponibles');return response.json();}).then(regions=>{for(const f of regions.features)f.bbox=turf.bbox(f);data.regions=regions;addOverseasRegions();if(level==='regions')boundaryLayer.clearLayers().addData(data.regions);}).catch(error=>{regionsLoading=null;throw error;});}
const damageData={destroyed:{ratio:123464/198273*.81,count:123464,title:'Bâtiments détruits'},affected:{ratio:.81,count:198273,title:'Détruits ou endommagés'}};
let showLives=true,showInjuries=true;
let representation='contour',showDamage=true,damageKind='affected';
let center=[6.108,46.035],angle=0,level='communes',selected=null,currentFeature,hits=[],population=2130000;
const map=L.map('map',{zoomControl:false,doubleClickZoom:false,tapHold:false,minZoom:2,maxZoom:17}).setView([45.905,6.108],9);
// Bottom-right controls stack upwards in the order they are added: credits, scale, zoom, then the position button.
L.control.scale({imperial:false,position:'bottomright',maxWidth:window.matchMedia('(max-width:650px)').matches?50:100}).addTo(map);L.control.zoom({position:'bottomright'}).addTo(map);
installBasemap(map);
map.createPane('boundaries');map.getPane('boundaries').style.zIndex=490;map.getPane('boundaries').style.pointerEvents='none';
map.createPane('human-impact');map.getPane('human-impact').style.pointerEvents='none';
map.getPane('human-impact').style.zIndex='450';
let boundaryLayer=L.geoJSON(data.departements,{pane:'boundaries',style:{color:'#596f7e',weight:1.5,opacity:.85,fillOpacity:0},interactive:false}).addTo(map);
let highlighted=L.geoJSON(null,{pane:'human-impact',style:{color:'#426779',weight:2,fillColor:'#93b7c9',fillOpacity:.13},interactive:false}).addTo(map);
const injuredLayer=L.geoJSON(null,{pane:'human-impact',interactive:false}).addTo(map);
const shape=L.geoJSON(null,{style:{color:'#0072b2',weight:3.5,fillColor:'#56b4e9',fillOpacity:.08,className:'gaza-shape'}}).addTo(map);
const damageShape=L.geoJSON(null,{style:{color:'#454b54',weight:3,opacity:.65,dashArray:'8 5',fillColor:'#7b818a',fillOpacity:.32},interactive:false}).addTo(map);
const toolsControl=L.control({position:'topright'});toolsControl.onAdd=()=>{const node=$('map-tools');L.DomEvent.disableClickPropagation(node);L.DomEvent.disableScrollPropagation(node);return node;};toolsControl.addTo(map);
function setMapPanel(which){if(which){$('overseas-menu').hidden=true;$('toggle-overseas').setAttribute('aria-expanded','false');}for(const [id,button] of [['map-filters','toggle-filters'],['color-key','toggle-legend']]){const open=id===which;$(id).hidden=!open;$(button).setAttribute('aria-expanded',String(open));}}
$('toggle-filters').onclick=()=>setMapPanel($('map-filters').hidden?'map-filters':null);
for(const [id,button] of [['map-filters','toggle-filters'],['color-key','toggle-legend']])$(id).addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();setMapPanel(null);$(button).focus();}});
const injuries=174995;let nearbyCommunes=[],injurySelection=null;
let fatalities=73922,hypothesis=false,injuriesBeforeHypothesis=true;
const communeCache={...(window.DEPARTMENT_COMMUNE_SEEDS||{})};let communes=[],communeState='loading',communeTimer=null,communeAbort=null,communeSequence=0;
function bboxOverlap(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
// A vertex inside the shape proves the intersection cheaply; only border cases need the full test.
function firstVertex(f){f._vertex??=turf.point(turf.coordAll(f)[0]);return f._vertex;}
function touches(f,shape){return turf.booleanPointInPolygon(firstVertex(f),shape)||turf.booleanIntersects(f,shape);}
function communeGroup(shape,departments){const bounds=turf.bbox(shape),unique=new Map();for(const code of departments)for(const f of communeCache[code]||[]){f.bbox??=turf.bbox(f);if(bboxOverlap(f.bbox,bounds)&&touches(f,shape))unique.set(f.properties.code,f);}for(const f of swiss.communes.features)if(bboxOverlap(f.bbox,bounds)&&touches(f,shape))unique.set(f.properties.code,f);return [...unique.values()].sort((a,b)=>a.properties.nom.localeCompare(b.properties.nom,'fr'));}
// Each department is cached as soon as it arrives, so a partial failure keeps the successful downloads.
async function fetchDepartment(code,signal){const query=new URLSearchParams({fields:'nom,code,population,surface',format:'geojson',geometry:'contour'});const response=await fetch('https://geo.api.gouv.fr/departements/'+encodeURIComponent(code)+'/communes?'+query,{signal});if(!response.ok)throw Error('API indisponible');const payload=await response.json();if(!Array.isArray(payload.features))throw Error('Réponse invalide');communeCache[code]=payload.features;}
function touchedDepartments(shape){const bounds=turf.bbox(shape);return data.departements.features.filter(f=>f.properties.country!=='CH'&&bboxOverlap(f.bbox,bounds)&&turf.booleanIntersects(f,shape)).map(f=>f.properties.code);}
let injuryState='ready';
// Lives only need the communes under the shape; the 40 km ring for injuries may finish later or fail on its own.
function requestCommune(){
 if(hypothesis){requestExpandedMortality();return;}
 expandedMortality=null;clearTimeout(communeTimer);communeAbort?.abort();
 const request=++communeSequence,shapeAtRequest=currentFeature,searchShape=showInjuries?turf.buffer(shapeAtRequest,40,{units:'kilometers'}):null;
 const departments=touchedDepartments(shapeAtRequest),nearbyDepartments=searchShape?touchedDepartments(searchShape):[];
 communes=[];nearbyCommunes=[];injurySelection=null;injuredLayer.clearLayers();
 const missing=departments.filter(code=>!communeCache[code]),missingNearby=nearbyDepartments.filter(code=>!communeCache[code]&&!missing.includes(code));
 const current=()=>request===communeSequence&&level==='communes'&&!hypothesis;
 const settleLives=()=>{communes=communeGroup(shapeAtRequest,departments);communeState=communes.length?'ready':'outside';};
 const settleNearby=()=>{nearbyCommunes=searchShape?communeGroup(searchShape,nearbyDepartments):[];injurySelection=null;injuryState='ready';};
 injuryState=missingNearby.length?'loading':'ready';
 if(missing.length)communeState='loading';else{settleLives();if(!missingNearby.length)settleNearby();}
 if(!missing.length&&!missingNearby.length)return;
 communeTimer=setTimeout(async()=>{
  const controller=new AbortController();communeAbort=controller;const timeout=setTimeout(()=>controller.abort(),25000);
  const load=codes=>Promise.allSettled(codes.map(code=>fetchDepartment(code,controller.signal))).then(results=>results.every(r=>r.status==='fulfilled'));
  const lives=load(missing),nearby=load(missingNearby);
  try{
   if(missing.length){const ok=await lives;if(!current())return;if(!ok){communeState='error';renderComparison();return;}settleLives();if(!missingNearby.length)settleNearby();renderComparison();}
   if(missingNearby.length){const ok=await nearby;if(!current())return;if(ok)settleNearby();else injuryState='error';renderComparison();}
  }finally{clearTimeout(timeout);}
 },250);
}
let expandedMortality=null;
function requestExpandedMortality(){
 clearTimeout(communeTimer);communeAbort?.abort();const request=++communeSequence,footprint=currentFeature,origin=[...center],target=fatalities;
 expandedMortality=null;communes=[];nearbyCommunes=[];injurySelection=null;injuredLayer.clearLayers();highlighted.clearLayers();communeState='loading';
 const current=()=>request===communeSequence&&hypothesis&&level==='communes';
 communeTimer=setTimeout(async()=>{
  const controller=new AbortController();communeAbort=controller;
  try{
   for(const radius of [0,10,25,50,100,200,400,800,1600]){
    if(!current())return;
    const search=radius?turf.buffer(footprint,radius,{units:'kilometers'}):footprint,bounds=turf.bbox(search);
    const departments=data.departements.features.filter(f=>f.properties.country!=='CH'&&bboxOverlap(f.bbox,bounds)&&turf.booleanIntersects(f,search)).map(f=>f.properties.code);
    const missing=departments.filter(code=>!communeCache[code]);
    // Limit concurrent downloads; never display an incomplete successful result.
    for(let i=0;i<missing.length;i+=4){
     if(!current())return;
     await Promise.all(missing.slice(i,i+4).map(async code=>{
      const timeout=setTimeout(()=>controller.abort(),25000);
      try{await fetchDepartment(code,controller.signal);}finally{clearTimeout(timeout);}
     }));
    }
    if(!current())return;
    const covered=communeGroup(footprint,departments);
    if(radius===0&&!covered.length){communeState='outside';renderComparison();return;}
    const candidates=communeGroup(search,departments),selection=GazaSelection.selectCommunes(candidates,origin,target,turf);
    if(selection.remaining===0||radius===1600){
     communes=covered;expandedMortality={...selection,radius,candidateCount:candidates.length};communeState='ready';
     renderComparison();
     if(selection.selected.length){const extent=L.geoJSON({type:'FeatureCollection',features:selection.selected.map(r=>r.feature)}).getBounds();map.fitBounds(extent,{paddingTopLeft:[24,48],paddingBottomRight:[24,Math.min(220,map.getSize().y*.32)],maxZoom:map.getZoom(),animate:false});}
     return;
    }
   }
  }catch(error){if(current()){expandedMortality=null;communeState='error';renderComparison();}}
 },250);
}
function hatchPartialLives(rows){
 const partial=new Set(rows.filter(row=>row.fraction<1).map(row=>row.feature.properties.code));
 highlighted.eachLayer(layer=>{
  if(!partial.has(layer.feature.properties.code))return;
  const path=layer.getElement(),svg=path?.ownerSVGElement;if(!svg)return;
  const ns='http://www.w3.org/2000/svg',id='partial-lives-hatch';
  if(!svg.querySelector('#'+id)){
   let defs=svg.querySelector('defs');if(!defs){defs=document.createElementNS(ns,'defs');svg.prepend(defs);}
   const pattern=document.createElementNS(ns,'pattern');pattern.id=id;
   for(const [name,value] of Object.entries({patternUnits:'userSpaceOnUse',width:10,height:10,patternTransform:'rotate(35)'}))pattern.setAttribute(name,value);
   const stripe=document.createElementNS(ns,'rect');stripe.setAttribute('width','3');stripe.setAttribute('height','10');stripe.setAttribute('fill','#dc3655');pattern.append(stripe);defs.append(pattern);
  }
  layer.setStyle({fillColor:'url(#'+id+')',fillOpacity:.198,dashArray:null});
 });
}
function renderCommune(){injuredLayer.clearLayers();highlighted.clearLayers();$('territory-tabs').replaceChildren();$('territory-detail').hidden=true;$('comparison-foot').textContent='Communes françaises et suisses touchées, même en partie · populations des communes entières';if(communeState!=='ready'||!communes.length){$('territory-name').textContent=communeState==='loading'?'Recherche des communes…':communeState==='outside'?'Hors de France et de Suisse':'Communes non chargées';$('comparison-body').replaceChildren();const p=document.createElement('p');p.className='micro';p.textContent=communeState==='loading'?'Chargement des communes touchées et de leurs populations.':communeState==='outside'?'Placez Gaza sur la France ou la Suisse pour comparer les communes.':'Les données complètes n’ont pas pu être chargées. Aucun total partiel n’est affiché.';$('comparison-body').append(p);return;}
if(!showLives){$('territory-name').textContent=fmt(communes.length)+' communes touchées';$('comparison-foot').textContent='France et Suisse · communes touchées, même en partie · populations des communes entières';const total=communes.reduce((sum,f)=>sum+(Number.isFinite(f.properties.population)?f.properties.population:0),0),missing=communes.some(f=>!Number.isFinite(f.properties.population));const grid=victimsGrid(),info=document.createElement('div');info.className='vcard-plain';info.innerHTML='<div class="group-population"><strong>'+fmt(total)+'</strong><span>habitants dans les communes touchées'+(missing?' · total incomplet':'')+'</span></div><p class="group-note">Ce total additionne les populations des communes entières, pas les habitants situés à l’intérieur du cercle. Activez « Montrer les vies perdues » pour afficher l’équivalence des pertes humaines.</p>';$('comparison-body').replaceChildren(grid);grid.append(info);renderInjuries();return;}
const selection=hypothesis&&expandedMortality?expandedMortality:GazaSelection.selectCommunes(communes,center,fatalities,turf),chosen=selection.selected;highlighted.addData({type:'FeatureCollection',features:chosen.map(row=>row.feature)}).setStyle(f=>{const row=chosen.find(r=>r.feature.properties.code===f.properties.code);return {color:'#b21836',weight:1.2,opacity:.27,fillColor:'#dc3655',fillOpacity:row.fraction<1?.066:.198,dashArray:row.fraction<1?'5 4':null};});hatchPartialLives(chosen);
 $('comparison-foot').textContent='Équivalences en habitants : le bleu, le rouge et le jaune ne localisent ni les habitants de Gaza, ni les vies perdues, ni les blessés.';
 const body=$('comparison-body');body.replaceChildren();const grid=victimsGrid();body.append(grid);
 const complete=chosen.filter(row=>row.fraction===1).length,last=chosen.at(-1);let message;if(selection.remaining>0){message='Plus que les '+fmt(selection.total)+' habitants de ces '+fmt(chosen.length)+' communes';}else if(last&&last.fraction<1){message=(complete?fmt(complete)+' commune'+(complete>1?'s':'')+' entière'+(complete>1?'s':'')+' + ':'')+fmt(last.fraction*100,1)+' % de '+last.feature.properties.nom;}else{message='L’équivalent de toute la population de ces '+fmt(chosen.length)+' communes';}
 const lives=victimCard('lives','Vies perdues',fmt(fatalities),hypothesis?'vies perdues · hypothèse non confirmée':'vies perdues · bilan au 23 sept. 2026');
 cardText(lives.body,'vcard-sub',message);
 if(selection.remaining>0)cardText(lives.body,'victim-gap','Il manque encore l’équivalent de '+fmt(selection.remaining)+' habitants.');
 if(selection.missing)cardText(lives.body,'victim-gap',fmt(selection.missing)+(selection.missing>1?' communes sans population connue exclues.':' commune sans population connue exclue.'));
 if(hypothesis){cardText(lives.body,'vcard-note','F. Albanese · 15 septembre 2025 · estimation citée, non vérifiée');const source=document.createElement('a');source.href='https://www.un.org/unispal/document/press-briefing-francesca-albanese-16sep25/';source.target='_blank';source.rel='noreferrer';source.className='vcard-link';source.textContent='Source et limites de cette hypothèse';lives.body.append(source);}
 lives.body.append(victimList(chosen,'lives'));grid.append(lives.card);
 victimTitle(chosen,[]);renderInjuries(chosen);}
function cardText(parent,cls,text){const p=document.createElement('p');p.className=cls;p.textContent=text;parent.append(p);return p;}
// Cards fold one by one; each visitor's choice is remembered (open on a computer, folded on a phone by default).
const cardKey='gazascale-cards';let cardState=null;
function cardOpen(kind){if(!cardState){try{cardState=JSON.parse(localStorage.getItem(cardKey))||{};}catch{cardState={};}}return cardState[kind]??!window.matchMedia('(max-width:950px)').matches;}
function victimCard(kind,label,figure,what){
 const card=document.createElement('section');card.className='vcard vcard-'+kind;
 const top=document.createElement('button'),id='vcard-'+kind+'-body';top.type='button';top.className='vcard-top';top.setAttribute('aria-controls',id);
 const lab=document.createElement('span'),mini=document.createElement('span'),chevron=document.createElement('i');lab.className='vcard-label';lab.textContent=label;mini.className='vcard-mini';mini.textContent=figure;chevron.className='vcard-chev';chevron.setAttribute('aria-hidden','true');top.append(lab,mini,chevron);
 const body=document.createElement('div'),big=document.createElement('strong');body.className='vcard-body';body.id=id;big.className='vcard-big';big.textContent=figure;body.append(big);cardText(body,'vcard-what',what);
 const set=open=>{top.setAttribute('aria-expanded',String(open));body.hidden=!open;card.classList.toggle('is-folded',!open);};set(cardOpen(kind));
 top.onclick=()=>{const open=body.hidden;set(open);cardState[kind]=open;try{localStorage.setItem(cardKey,JSON.stringify(cardState));}catch{}window.zstats?.((open?'Ouvre':'Replie')+' : '+label);};
 card.append(top,body);return {card,body};
}
function victimsGrid(){const grid=document.createElement('div');grid.className='victims-grid';if(showPopulation)grid.append(populationCard());return grid;}
// Gaza's whole population, gathered from the nearest communes: the space it would take at local density.
function populationCard(){
 const recent=population!==2226544,card=victimCard('population','Population de Gaza',(recent?'≈ ':'')+fmt(population),'habitants · '+(recent?'estimation fin 2025':'avant le 7 octobre 2023'));
 card.card.querySelector('.vcard-mini').textContent=(recent?'≈ ':'')+fmt(population/1e6,2)+' M';
 const sub=cardText(card.body,'vcard-sub','');
 if(popState==='loading')sub.textContent='Recherche des communes qui réunissent cette population…';
 else if(popState==='outside')sub.textContent='Placez Gaza sur la France ou la Suisse pour voir l’espace qu’occupe sa population.';
 else if(popState==='error'){sub.textContent='Les communes alentour n’ont pas pu être chargées.';const retry=document.createElement('button');retry.type='button';retry.className='vcard-retry';retry.textContent='Réessayer';retry.onclick=()=>{popKey='';requestPopulationZone();};card.body.append(retry);}
 else if(popZone){const ratio=popZone.area/365,compare=ratio>=1.1?[['',' Gaza tient sur 365 km² : '],['b',fmt(ratio,ratio<10?1:0)+' fois moins'],['','.']]:ratio<=1/1.1?[['',' Ici, la densité dépasse celle de Gaza, qui s’étend sur 365 km².']]:[['',' C’est presque la surface de Gaza, 365 km².']];const parts=[['b',fmt(popZone.count)+(popZone.count>1?' communes':' commune')],['',' sur '],['b',fmt(popZone.area)+' km²'],['',', jusqu’à '+fmt(popZone.far)+' km du centre.'],...compare];sub.replaceChildren(...parts.map(([tag,text])=>{if(!tag)return text;const b=document.createElement('b');b.textContent=text;return b;}));if(popZone.remaining>0)cardText(card.body,'victim-gap','Les communes disponibles ne réunissent que '+fmt(population-popZone.remaining)+' habitants : il en manque '+fmt(popZone.remaining)+'.');}
 const link=document.createElement('a');link.className='vcard-link';link.href='#source-population-zone';link.dataset.source='source-population-zone';link.textContent='Méthode de la zone bleue';card.body.append(link);
 return card.card;
}
function refreshPopulationCard(){const old=$('comparison-body').querySelector('.vcard-population');if(old)old.replaceWith(populationCard());window.refreshMapExtras?.();}
let showPopulation=true,popZone=null,popState='idle',popSequence=0,popKey='',popFitPending=true;
map.createPane('population');map.getPane('population').style.zIndex=390;map.getPane('population').style.pointerEvents='none';
const populationLayer=L.geoJSON(null,{pane:'population',interactive:false}).addTo(map);
function populationPadding(){const panel=$('comparison-panel'),compactView=window.matchMedia('(max-width:950px)').matches,open=!panel.hidden;return compactView?{paddingTopLeft:[12,70],paddingBottomRight:[60,Math.min(Math.max(open?panel.offsetHeight:0,map.getSize().y*.4),map.getSize().y*.6)+12]}:{paddingTopLeft:[Math.min(open?panel.offsetWidth+32:24,map.getSize().x*.45),70],paddingBottomRight:[Math.min(150,map.getSize().x*.15),30]};}
function fitPopulation(){if(!popZone?.count)return;const bounds=populationLayer.getBounds();if(bounds.isValid())map.fitBounds(bounds,{...populationPadding(),maxZoom:12});}
// Same rule as for lives lost: nearest communes first, cumulated until the population is reached.
async function requestPopulationZone(){
 const key=[center,angle,representation,population,showPopulation].join('|');if(key===popKey)return;popKey=key;
 const request=++popSequence,current=()=>request===popSequence;popZone=null;populationLayer.clearLayers();
 if(!showPopulation){popState='idle';refreshPopulationCard();return;}
 popState='loading';refreshPopulationCard();
 const footprint=currentFeature,origin=[...center],target=population;
 try{
  for(const radius of [0,20,40,60,90,130,180,250]){
   if(!current())return;
   const search=radius?turf.buffer(footprint,radius,{units:'kilometers'}):footprint,bounds=turf.bbox(search);
   const departments=data.departements.features.filter(f=>f.properties.country!=='CH'&&bboxOverlap(f.bbox,bounds)&&turf.booleanIntersects(f,search)).map(f=>f.properties.code);
   const missing=departments.filter(code=>!communeCache[code]);
   for(let i=0;i<missing.length;i+=4){if(!current())return;await Promise.all(missing.slice(i,i+4).map(code=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);return fetchDepartment(code,controller.signal).finally(()=>clearTimeout(timer));}));}
   if(!current())return;
   const selection=GazaSelection.selectCommunes(communeGroup(search,departments),origin,target,turf);
   if(!radius&&!selection.selected.length){popState='outside';refreshPopulationCard();return;}
   if(selection.remaining===0||radius===250){
    const features=selection.selected.map(row=>row.feature),partial=new Set(selection.selected.filter(row=>row.fraction<1).map(row=>row.feature.properties.code));
    popZone={features,count:features.length,remaining:selection.remaining,area:features.reduce((sum,f)=>sum+(f._area??=turf.area(f)/1e6),0),far:Math.max(0,...features.map(f=>turf.distance(turf.point(origin),f._comparisonPoint)))};
    populationLayer.addData({type:'FeatureCollection',features}).setStyle(f=>({color:'#2b3f9e',weight:.7,opacity:.35,fillColor:'#3b5bdb',fillOpacity:partial.has(f.properties.code)?.08:.17,dashArray:partial.has(f.properties.code)?'5 4':null}));
    popState='ready';refreshPopulationCard();
    if(popFitPending){popFitPending=false;fitPopulation();}
    return;
   }
  }
 }catch(error){if(current()){popState='error';refreshPopulationCard();}}
}
// One accordion per block: the communes behind each equivalence, largest share first.
function victimList(rows,kind){
 const details=document.createElement('details');details.className='victim-list';const summary=document.createElement('summary');summary.textContent=(rows.length>1?'Les '+fmt(rows.length)+' communes':'La commune')+(kind==='lives'?' des vies perdues':' des blessés');details.append(summary);
 const list=document.createElement('ul');
 for(const row of [...rows].sort((a,b)=>b.represented-a.represented||a.feature.properties.nom.localeCompare(b.feature.properties.nom,'fr'))){const item=document.createElement('li'),name=document.createElement('button'),value=document.createElement('span');name.type='button';name.textContent=row.feature.properties.nom+(row.shared?' (population restante)':'');name.onclick=()=>{const point=turf.pointOnFeature(row.feature).geometry.coordinates;window.communePopup?.(row.feature,[point[1],point[0]]);};value.textContent=fmt(row.represented)+' · '+(row.fraction<1?fmt(row.fraction*100,1):'100')+' %';item.append(name,value);list.append(item);}
 details.append(list);return details;
}
// Every commune counts once, whether it carries lives lost, injuries or both.
function victimTitle(lives,injured){
 const codes=new Set([...lives,...injured].map(row=>row.feature.properties.code)),full=lives.filter(row=>row.fraction===1).length;
 $('territory-name').textContent=fmt(codes.size)+(codes.size>1?' communes concernées':' commune concernée');
 $('territory-detail').textContent=full?'dont '+fmt(full)+' dont la totalité de la population est représentée parmi les vies perdues dans cette projection.':'Aucune commune dont la totalité de la population est représentée parmi les vies perdues dans cette projection.';$('territory-detail').hidden=false;
}

function renderInjuries(lives=[]){
 if(!showInjuries||communeState!=='ready')return;
 const grid=$('comparison-body').querySelector('.victims-grid');if(!grid)return;
 const card=victimCard('injuries','Blessés',fmt(injuries),'blessés · bilan au 23 sept. 2026'),section=card.body;grid.append(card.card);
 if(injuryState!=='ready'){const p=cardText(section,'vcard-sub',injuryState==='loading'?'Chargement des communes voisines…':'Les communes voisines n’ont pas pu être chargées.');if(injuryState==='error'){const retry=document.createElement('button');retry.type='button';retry.className='vcard-retry';retry.textContent='Réessayer';retry.onclick=()=>{comparisonWanted=true;compare();};section.append(retry);}return;}
 if(!injurySelection){const reserved=GazaSelection.selectCommunes(communes,center,fatalities,turf).selected;injurySelection=GazaSelection.selectNeighbors(nearbyCommunes,currentFeature,center,injuries,reserved,turf,communes);}
 document.querySelectorAll('#map pattern[id^="shared-population-"]').forEach(node=>node.remove());
 const rows=injurySelection.selected,byCode=new Map(rows.map(r=>[r.feature.properties.code,r]));
 injuredLayer.addData({type:'FeatureCollection',features:rows.map(r=>r.feature)}).setStyle(f=>({color:'#9b7300',weight:1.2,opacity:.32,fillColor:'#f2cc32',fillOpacity:byCode.get(f.properties.code).fraction<1?.13:.36,dashArray:byCode.get(f.properties.code).fraction<1?'5 4':null}));
 // Shared communes use proportional stripes, not a geographic split of residents.
 injuredLayer.eachLayer(layer=>{const row=byCode.get(layer.feature.properties.code);if(!row.shared)return;
  const path=layer.getElement(),svg=path?.ownerSVGElement;if(!svg)return;
  const ns='http://www.w3.org/2000/svg',id='shared-population-'+row.feature.properties.code;
  svg.querySelector('[id="'+id+'"]')?.remove();
  const pattern=document.createElementNS(ns,'pattern');pattern.id=id;pattern.setAttribute('patternUnits','userSpaceOnUse');pattern.setAttribute('width','24');pattern.setAttribute('height','24');pattern.setAttribute('patternTransform','rotate(35)');
  const red=24*row.livesRepresented/row.population,yellow=24*row.represented/row.population;
  for(const [x,width,color,opacity] of [[0,red,'#dc3655',showLives?.198:0],[red,yellow,'#f2cc32',.36]]){const rect=document.createElementNS(ns,'rect');rect.setAttribute('x',x);rect.setAttribute('width',width);rect.setAttribute('height','24');rect.setAttribute('fill',color);rect.setAttribute('fill-opacity',opacity);pattern.append(rect);}
  let defs=svg.querySelector('defs');if(!defs){defs=document.createElementNS(ns,'defs');svg.prepend(defs);}defs.append(pattern);
  layer.setStyle({fillColor:'url(#'+id+')',fillOpacity:1});
  highlighted.eachLayer(redLayer=>{if(redLayer.feature.properties.code===row.feature.properties.code)redLayer.setStyle({fillOpacity:0});});
 });
 const full=rows.filter(r=>r.fraction===1).length,parts=[];if(full)parts.push(fmt(full)+' commune'+(full>1?'s':'')+' entière'+(full>1?'s':''));for(const row of rows.filter(r=>r.fraction<1))parts.push(fmt(row.fraction*100,1)+' % de '+row.feature.properties.nom+(row.shared?' (population restante)':''));cardText(section,'vcard-sub',parts.join(' + '));
 if(injurySelection.remaining){const gap=document.createElement('p');gap.className='victim-gap';gap.textContent=fmt(injurySelection.remaining)+' personnes non représentées dans le voisinage disponible.';section.append(gap);}
 section.append(victimList(rows,'injuries'));
 victimTitle(lives,rows);
}

let placementPaintTimer=null;
let comparisonOpen=false,comparisonWanted=true,resultsReady=false,lastMoveCompare=0;
function setComparisonOpen(open,focusButton=false){comparisonOpen=Boolean(open&&resultsReady);$('comparison-panel').hidden=!comparisonOpen;$('toggle-comparison').disabled=!resultsReady;$('toggle-comparison').setAttribute('aria-expanded',String(comparisonOpen));if(focusButton&&resultsReady)$('toggle-comparison').focus({preventScroll:true});}
function requestComparisonOpen(){comparisonWanted=true;setComparisonOpen(true);}
function closeComparison(){comparisonWanted=false;setComparisonOpen(false,true);}
function settleComparison(){
 resultsReady=level==='communes'?communeState==='ready'&&communes.length>0:Boolean(hits.length&&data.stats[level][selected]?.surface);
 const badge=$('comparison-state'),busy=dataState==='loading'||level==='communes'&&communeState==='loading',failed=dataState==='error'||level==='communes'&&communeState==='error';badge.classList.toggle('is-loading',busy);$('map').setAttribute('aria-busy',String(busy));badge.hidden=resultsReady||document.body.classList.contains('gaza-dragging');$('comparison-retry').hidden=!failed;badge.querySelector('span').textContent=busy?(level==='communes'?'Calcul des communes…':'Chargement des territoires…'):failed?'Impossible de charger les données. Vérifiez la connexion.':'Aucun résultat ici : placez Gaza en France ou en Suisse.';
 setComparisonOpen(comparisonWanted&&resultsReady);
}
function moved(){clearTimeout(placementPaintTimer);map.closePopup();popSequence++;popKey='';populationLayer.clearLayers();comparisonWanted=false;resultsReady=false;clearTimeout(communeTimer);communeAbort?.abort();communeSequence++;setComparisonOpen(false);$('comparison-state').hidden=true;document.body.classList.add('gaza-dragging');}
function placed(){document.body.classList.remove('gaza-dragging');comparisonWanted=true;const badge=$('comparison-state');badge.hidden=false;badge.classList.add('is-loading');badge.querySelector('span').textContent='Calcul des communes…';$('comparison-retry').hidden=true;$('map').setAttribute('aria-busy','true');const sequence=communeSequence;clearTimeout(placementPaintTimer);placementPaintTimer=setTimeout(()=>{if(sequence===communeSequence)compare();},50);}
$('comparison-close').onclick=closeComparison;$('toggle-comparison').onclick=()=>{if(comparisonOpen)closeComparison();else{requestComparisonOpen();if(comparisonOpen)$('comparison-close').focus({preventScroll:true});}};$('comparison-retry').onclick=()=>{comparisonWanted=true;compare();};$('comparison-panel').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeComparison();}});
const icon=(cls,text,size)=>L.divIcon({className:cls,html:text,iconSize:[size,size],iconAnchor:[size/2,size/2]});
const anchor=L.marker([center[1],center[0]],{icon:icon('center-handle','<span class="grab-dot"></span>',36),interactive:false,title:'Gaza : flèches du clavier pour déplacer',zIndexOffset:1000}).addTo(map);
const rotation=L.marker([center[1],center[0]],{icon:icon('rotate-handle','<svg viewBox="0.2 -1 24 24" width="62%" height="62%" aria-hidden="true"><path d="M19 12A7 7 0 1 1 12 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M11.5 1.6L16 5l-4.5 3.4z" fill="currentColor"/></svg>',27),draggable:true,title:'Faire pivoter Gaza',zIndexOffset:1000}).addTo(map);
const arm=L.polyline([],{color:'#20333b',weight:1.5,dashArray:'4 5',interactive:false}).addTo(map);
const label=L.marker([center[1],center[0]],{icon:L.divIcon({className:'gaza-label',html:'GAZA · 365 km²',iconSize:[120,20],iconAnchor:[-20,10]}),interactive:false,keyboard:false}).addTo(map);
for(const f of data.departements.features)f.bbox??=turf.bbox(f);
// Fill a proportion of the projected outline: a statistical diagram, not damage locations.
const damageOutlines={};
function damageOutline(ratio){
 if(damageOutlines[ratio])return damageOutlines[ratio];
 const f={type:'Feature',properties:{},geometry:{type:'MultiPolygon',coordinates:xy}},box=turf.bbox(f);
 const area=polygons=>polygons.reduce((s,p)=>s+GazaGeometry.ringArea(p[0])-p.slice(1).reduce((n,r)=>n+GazaGeometry.ringArea(r),0),0);
 const target=area(xy)*ratio;let low=box[1],high=box[3],clipped;
 for(let i=0;i<42;i++){const mid=(low+high)/2;clipped=turf.bboxClip(f,[box[0]-1,box[1]-1,box[2]+1,mid]);const polygons=clipped.geometry.type==='Polygon'?[clipped.geometry.coordinates]:clipped.geometry.coordinates;if(area(polygons)<target)low=mid;else high=mid;}
 const polygons=clipped.geometry.type==='Polygon'?[clipped.geometry.coordinates]:clipped.geometry.coordinates;
 return damageOutlines[ratio]=polygons;
}
function draw(){map.closePopup();currentFeature=representation==='circle'?GazaGeometry.circle(center):GazaGeometry.place(xy,center,angle);shape.clearLayers().addData(currentFeature);anchor.setLatLng([center[1],center[0]]);label.setLatLng([center[1],center[0]]);const a=angle*Math.PI/180,p=GazaGeometry.inverse([25000*Math.sin(a),25000*Math.cos(a)],center);rotation.setLatLng([p[1],p[0]]);arm.setLatLngs([[center[1],center[0]],[p[1],p[0]]]);if(representation==='circle'){map.removeLayer(rotation);map.removeLayer(arm);}else{if(!map.hasLayer(rotation))rotation.addTo(map);if(!map.hasLayer(arm))arm.addTo(map);}damageShape.clearLayers();if(showDamage){const ratio=damageData[damageKind].ratio;damageShape.addData(representation==='circle'?GazaGeometry.circle(center,365*ratio):turf.intersect(turf.featureCollection([currentFeature,GazaGeometry.place(damageOutline(ratio),center,angle)])));}}
// Placement gestures do not consume normal map panning or pinch zoom.
function installMapPlacement(element,place){
 let pending=null,lastTouch=-Infinity;const touches=new Set();
 const excluded=target=>target.closest('.leaflet-control,.rotate-handle,button,a,input,select');
 const cancel=()=>{if(pending)clearTimeout(pending.timer);pending=null;};
 element.addEventListener('dblclick',event=>{
  if(excluded(event.target)||Date.now()-lastTouch<1000)return;
  event.preventDefault();event.stopPropagation();place(event);
 },true);
 element.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='touch')return;
  lastTouch=Date.now();touches.add(event.pointerId);cancel();
  if(touches.size!==1||excluded(event.target))return;
  const point={clientX:event.clientX,clientY:event.clientY};
  pending={id:event.pointerId,...point,timer:setTimeout(()=>{pending=null;place(point);},600)};
 },true);
 document.addEventListener('pointermove',event=>{
  if(pending&&event.pointerId===pending.id&&Math.hypot(event.clientX-pending.clientX,event.clientY-pending.clientY)>10)cancel();
 },{passive:true});
 const finish=event=>{if(event.pointerType==='touch')lastTouch=Date.now();touches.delete(event.pointerId);if(pending?.id===event.pointerId)cancel();};
 document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);
 window.addEventListener('blur',()=>{cancel();touches.clear();});
 element.addEventListener('contextmenu',event=>{if(!excluded(event.target)&&Date.now()-lastTouch<1500)event.preventDefault();});
}
function placeAtPointer(event){
 window.zstats?.('Gaza placée sur la carte');const point=map.mouseEventToLatLng(event);moved();
 center=[point.lng,Math.max(-80,Math.min(80,point.lat))];
 draw();map.setView([center[1],center[0]],map.getZoom(),{animate:false});placed();
}
installMapPlacement(map.getContainer(),event=>placeAtPointer(event));
function compare(){resultsReady=false;setComparisonOpen(false);const pending=!window.OVERSEAS_DATA&&!bboxOverlap(turf.bbox(currentFeature),homeBounds)?loadOverseas():level==='regions'&&!data.regions?loadRegions():null;if(pending){const token=++dataToken;dataState='loading';hits=[];communes=[];communeState='loading';highlighted.clearLayers();renderComparison();pending.then(()=>{if(token===dataToken){dataState='ready';compare();}},()=>{if(token===dataToken){dataState='error';communeState='error';renderComparison();}});return;}dataToken++;dataState='ready';requestPopulationZone();if(level==='communes'){requestCommune();renderComparison();return;}const b=turf.bbox(currentFeature);hits=data[level].features.filter(f=>{const a=f.bbox;return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1]&&turf.booleanIntersects(f,currentFeature);});hits.sort((a,b)=>a.properties.nom.localeCompare(b.properties.nom,'fr'));if(!hits.some(f=>f.properties.code===selected))selected=(hits.find(f=>turf.booleanPointInPolygon(turf.point(center),f))??hits[0])?.properties.code;renderComparison();}
function renderComparison(){renderComparisonContents();settleComparison();if(window.refreshMapExtras)window.refreshMapExtras();}
function renderComparisonContents(){injuredLayer.clearLayers();$('comparison-eyebrow').textContent=level==='communes'?'VICTIMES':'TERRITOIRES TOUCHÉS';$('territory-detail').hidden=true;if(level==='communes'){renderCommune();return;}$('comparison-foot').textContent='Territoires touchés par la forme · chiffres du territoire entier';highlighted.setStyle({color:'#426779',weight:2,fillColor:'#93b7c9',fillOpacity:.13});const f=hits.find(f=>f.properties.code===selected);$('territory-tabs').replaceChildren();highlighted.clearLayers();if(dataState!=='ready'){$('territory-name').textContent=dataState==='loading'?'Chargement des territoires…':'Territoires non chargés';$('comparison-body').innerHTML='<p class="micro">'+(dataState==='loading'?'Chargement des contours et des populations.':'Les données n’ont pas pu être chargées.')+'</p>';return;}if(!f){$('territory-name').textContent='Hors des territoires couverts';$('comparison-body').innerHTML='<p class="micro">Placez Gaza sur la France ou la Suisse. En Suisse, choisissez « Département / canton » pour comparer les cantons.</p>';return;}highlighted.addData(f);$('territory-name').textContent=f.properties.nom+(f.properties.country==='CH'?' · canton suisse':'');if(f.properties.country==='CH')$('comparison-foot').textContent='Population au 31 décembre 2024 · limites au 1er janvier 2026 · OFS / swisstopo';if(hits.length>1)for(const f of hits){const b=document.createElement('button');b.textContent=f.properties.nom;b.className=f.properties.code===selected?'active':'';b.onclick=()=>{selected=f.properties.code;renderComparison();};$('territory-tabs').append(b);}const s=data.stats[level][selected];if(!s||!s.surface){$('comparison-body').innerHTML='<p>Données non disponibles pour ce territoire.</p>';return;}const ratio=s.surface/365,density=s.population/s.surface;
$('comparison-body').innerHTML=`<div class="metrics"><div class="metric"><strong>${fmt(s.surface)} <span>km²</span></strong><span>${fmt(s.surface*100)} hectares</span></div><div class="metric"><strong>${fmt(s.population)}</strong><span>habitants</span></div><div class="metric"><strong>${fmt(density)}</strong><span>habitants / km²</span></div></div><div class="ratio"><span class="ratio-track"><i style="width:${Math.min(100,365/s.surface*100)}%"></i></span><span>${ratio>=1?`Ce territoire est <b>${fmt(ratio,1)} fois plus étendu</b> que Gaza.`:`Gaza est <b>${fmt(1/ratio,1)} fois plus étendue</b> que ce territoire.`}${density>0?` Densité de Gaza : <b>${fmt(population/365/density,1)} fois</b> celle du territoire.`:''}</span></div>`;}
rotation.on('drag',()=>{const p=rotation.getLatLng(),v=GazaGeometry.forward([p.lng,p.lat],center);angle=(Math.atan2(v[0],v[1])*180/Math.PI+360)%360;draw();moved();});rotation.on('dragend',placed);


function syncHypothesis(enabled){
 if(enabled&&!hypothesis)injuriesBeforeHypothesis=showInjuries;
 if(!enabled&&hypothesis)showInjuries=injuriesBeforeHypothesis;
 hypothesis=enabled;fatalities=enabled?680000:73922;if(enabled)showInjuries=false;
 injurySelection=null;injuredLayer.clearLayers();
 $('hypothesis-toggle').checked=enabled;$('show-injuries').disabled=enabled||!showLives;$('show-injuries').checked=showInjuries;
 $('scenario-injuries-note').hidden=!enabled;$('injuries-insert').hidden=enabled;$('scenario-badge').hidden=!enabled;
 $('lives-count').textContent=fmt(fatalities);
 $('lives-description').textContent=enabled?'Hypothèse de vies perdues à Gaza · non confirmée':'vies palestiniennes perdues à Gaza · bilan rapporté au 23 septembre 2026';
 $('lives-source-note').textContent=enabled?'F. Albanese, 15 septembre 2025 : estimation citée de certains chercheurs, difficile à vérifier. Elle évoque aussi 380 000 enfants de moins de cinq ans si ce chiffre était confirmé. Cette source ne chiffre pas les blessés.':'Depuis le 7 octobre 2023 · ministère de la Santé de Gaza, repris par OCHA. Bilan rapporté, pas une estimation de toute la mortalité indirecte.';
 $('lives-source').href=enabled?'#source-hypothese':'#source-vies';
 $('lives-source').textContent=enabled?'Source de l’hypothèse · 15 septembre 2025':'Source et date du bilan';
}
$('hypothesis-toggle').onchange=e=>{syncHypothesis(e.target.checked);showLives=true;$('show-lives').checked=true;$('show-injuries').disabled=hypothesis;comparisonWanted=true;setLevel('communes');};
$('show-injuries').onchange=e=>{showInjuries=e.target.checked;if(level!=='communes'&&showInjuries)setLevel('communes');else compare();};
// Injuries start from the lives-lost communes: without lives, the injuries layer is off and its box disabled.
let injuriesBeforeLivesOff=true;
$('show-lives').onchange=e=>{showLives=e.target.checked;if(!showLives){injuriesBeforeLivesOff=showInjuries;showInjuries=false;}else if(!hypothesis)showInjuries=injuriesBeforeLivesOff;$('show-injuries').checked=showInjuries;$('show-injuries').disabled=hypothesis||!showLives;if(showLives)setLevel('communes');else renderComparison();};

function setLevel(value){level=value;selected=null;clearTimeout(communeTimer);communeAbort?.abort();communeSequence++;$('commune').setAttribute('aria-pressed',level==='communes');$('dept').setAttribute('aria-pressed',level==='departements');$('region').setAttribute('aria-pressed',level==='regions');boundaryLayer.clearLayers();const boundaries=level==='communes'?data.departements:data[level];if(boundaries)boundaryLayer.addData(boundaries);compare();}
$('commune').onclick=()=>setLevel('communes');$('dept').onclick=()=>setLevel('departements');$('region').onclick=()=>setLevel('regions');
function setPeriod(){population=$('period').value==='2023'?2226544:2130000;requestPopulationZone();$('gaza-pop').textContent=($('period').value==='2025'?'≈ ':'')+fmt(population);$('gaza-density').textContent=fmt(population/365);$('period-note').textContent=$('period').value==='2023'?'PCBS · estimation de mi-2023, la dernière avant le 7 octobre 2023.':'PCBS · estimation arrondie de fin 2025, la plus récente retenue ici. Ce n’est pas un bilan définitif.';renderComparison();}
function updateRepresentation(){const isCircle=representation==='circle';$('toggle-shape').querySelector('.icon-gaza').toggleAttribute('hidden',!isCircle);$('toggle-shape').querySelector('.icon-circle').toggleAttribute('hidden',isCircle);$('toggle-shape').querySelector('.tool-label').textContent=isCircle?'Contour':'Cercle';$('toggle-shape').title=isCircle?'Afficher le contour de Gaza':'Afficher le cercle équivalent';$('show-damage').checked=showDamage;$('show-damaged').checked=damageKind==='affected';$('show-damaged').disabled=!showDamage;$('damage-panel').hidden=!showDamage;$('damaged-card').classList.toggle('is-off',damageKind!=='affected');draw();compare();}
// Destroyed buildings, plus damaged ones when that box is ticked (UNOSAT 'affected' share).
$('show-damaged').onchange=e=>{damageKind=e.target.checked?'affected':'destroyed';updateRepresentation();};$('show-damage').onchange=e=>{showDamage=e.target.checked;updateRepresentation();};
$('show-population').onchange=e=>{showPopulation=e.target.checked;popFitPending=showPopulation;popKey='';requestPopulationZone();renderComparison();window.zstats?.('Filtre : population de Gaza '+(showPopulation?'affichée':'masquée'));};
$('period').onchange=()=>{setPeriod();window.zstats?.('Population de référence : '+$('period').value);};$('close-sources').onclick=()=>$('sources').close();$('sources').onclick=e=>{if(e.target===$('sources')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
$('map').addEventListener('keydown',e=>{if(e.target!==$('map')&&e.target!==anchor.getElement())return;const changes={ArrowLeft:[-1000,0],ArrowRight:[1000,0],ArrowUp:[0,1000],ArrowDown:[0,-1000]};if(changes[e.key]){e.preventDefault();e.stopPropagation();center=GazaGeometry.inverse(changes[e.key],center);draw();comparisonWanted=true;compare();}},true);
syncHypothesis(false);updateRepresentation();setPeriod();new ResizeObserver(()=>map.invalidateSize()).observe($('map'));
window.atlas={place:(lat,lng,rotationAngle=0)=>{if(!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(rotationAngle)||lat<-80||lat>80||lng<-180||lng>180)throw new Error('Coordonnées invalides');center=[lng,lat];angle=(rotationAngle%360+360)%360;draw();comparisonWanted=true;compare();return {latitude:lat,longitude:lng,angle,areaKm2:turf.area(currentFeature)/1e6,territories:level==='communes'?communes.map(f=>f.properties.nom):hits.map(f=>f.properties.nom)};},read:()=>({center,angle,level,comparisonOpen,representation,showDamage,showLives,showInjuries,hypothesis,fatalities,damageKind,communeState,communeCount:communes.length,coveredPopulation:communes.every(f=>Number.isFinite(f.properties.population))?communes.reduce((s,f)=>s+f.properties.population,0):null,areaKm2:turf.area(currentFeature)/1e6,territories:level==='communes'?communes.map(f=>f.properties.nom):hits.map(f=>f.properties.nom)})};
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'place_gaza',title:'Placer Gaza sur la carte',description:'Déplace le contour de Gaza et règle sa rotation, puis retourne les territoires français et suisses touchés.',inputSchema:{type:'object',properties:{latitude:{type:'number',minimum:-80,maximum:80},longitude:{type:'number',minimum:-180,maximum:180},rotation:{type:'number'}},required:['latitude','longitude'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>window.atlas.place(input.latitude,input.longitude,input.rotation??0)})).catch(()=>{});}catch{}}


window.atlas.setRepresentation=(mode,destruction='none')=>{if(!['contour','circle'].includes(mode)||!['none','destroyed','affected'].includes(destruction))throw new Error('Représentation invalide');representation=mode;showDamage=destruction!=='none';if(showDamage)damageKind=destruction;updateRepresentation();return window.atlas.read();};
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'set_gaza_representation',title:'Choisir le contour ou les cercles',description:'Affiche le contour géographique ou un cercle de 365 km², avec une proportion de bâtiments détruits ou endommagés représentée en gris. Cette proportion ne représente pas une surface de terrain détruit.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['contour','circle']},destruction:{type:'string',enum:['none','destroyed','affected']}},required:['mode'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>window.atlas.setRepresentation(input.mode,input.destruction??'none')})).catch(()=>{});}catch{}}


