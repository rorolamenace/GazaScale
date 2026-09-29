/* Map interactions share the same allocations as the coloured polygons. */
let impactRows=[];
function impactSummary(){
 const lives=showLives?(hypothesis&&expandedMortality?expandedMortality:GazaSelection.selectCommunes(communes,center,fatalities,turf)).selected:[];
 const injuriesRows=showInjuries?injurySelection?.selected||[]:[];
 const merged=new Map();
 for(const [kind,rows] of [['lives',lives],['injured',injuriesRows]])for(const row of rows){const code=row.feature.properties.code,item=merged.get(code)||{feature:row.feature,population:row.population,lives:0,injured:0};item[kind]=row.represented;merged.set(code,item);}
 return [...merged.values()].sort((a,b)=>(b.lives+b.injured)-(a.lives+a.injured)||b.lives-a.lives||a.feature.properties.nom.localeCompare(b.feature.properties.nom,'fr'));
}
function communePopup(feature,latlng){
 const row=impactRows.find(r=>r.feature.properties.code===feature.properties.code),content=document.createElement('div');content.className='commune-popup';
 const title=document.createElement('strong');title.textContent=feature.properties.nom;content.append(title);
 const p=document.createElement('p');p.textContent=Number.isFinite(feature.properties.population)?fmt(feature.properties.population)+' habitants':'Population indisponible';content.append(p);
 for(const [label,key,visible] of [['Vies perdues','lives',showLives],['Blessés','injured',showInjuries]]){const line=document.createElement('p');line.className=key==='lives'?'text-lives':'text-injuries';const count=row?.[key]||0;line.textContent=label+' : '+(visible?fmt(count)+' personnes représentées'+(feature.properties.population?' · '+fmt(count/feature.properties.population*100,1)+' %':''):'couche masquée');content.append(line);}
 const note=document.createElement('small');note.textContent='Équivalence démographique avec Gaza, pas un bilan local.';if(hypothesis)note.textContent+=' Hypothèse de 680 000 non confirmée.';content.append(note);
 L.popup({maxWidth:window.matchMedia('(max-width:650px)').matches?200:290,autoPan:true}).setLatLng(latlng).setContent(content).openOn(map);
}
window.refreshMapExtras=()=>{
 $('color-key').querySelector('.key-red').parentElement.hidden=!showLives||level!=='communes';$('color-key').querySelector('.key-yellow').parentElement.hidden=!showInjuries||level!=='communes';$('color-key').querySelector('.key-grey').parentElement.hidden=!showDamage||representation!=='circle';
 impactRows=[];if(level!=='communes'||communeState!=='ready')return;
 impactRows=impactSummary();
 // Replace overlapping lists with one sortable-by-size, non-duplicated table.
 $('comparison-body').querySelectorAll('.communes-details').forEach(n=>n.remove());
 if(!impactRows.length)return;
 const section=document.createElement('details');section.className='combined-communes';section.open=false;
 const summary=document.createElement('summary');summary.textContent='Toutes les communes · '+fmt(impactRows.length)+' · du plus grand au plus petit effectif représenté';section.append(summary);
 const scroll=document.createElement('div');scroll.className='table-scroll';const table=document.createElement('table');table.innerHTML='<thead><tr><th>Commune</th><th>Habitants</th><th class="text-lives">Vies perdues</th><th class="text-injuries">Blessés</th></tr></thead>';const tbody=document.createElement('tbody');
 for(const row of impactRows){const tr=document.createElement('tr'),name=document.createElement('td'),button=document.createElement('button');button.textContent=row.feature.properties.nom;button.onclick=()=>{const point=turf.pointOnFeature(row.feature).geometry.coordinates;communePopup(row.feature,[point[1],point[0]]);};name.append(button);tr.append(name);for(const key of ['population','lives','injured']){const td=document.createElement('td');td.textContent=fmt(row[key]);if(key!=='population'){td.className=key==='lives'?'text-lives':'text-injuries';const small=document.createElement('small');small.textContent=fmt(row[key]/row.population*100,1)+' %';td.append(small);}tr.append(td);}tbody.append(tr);}
 table.append(tbody);scroll.append(table);section.append(scroll);const note=document.createElement('p');note.className='group-note';note.textContent='Tri selon les personnes attribuées dans cette simulation (rouge + jaune). Une ligne par commune ; 100 % indique une population entièrement utilisée. Ce classement ne constitue pas une addition des bilans réels des décès et des blessés.';section.append(note);$('comparison-body').append(section);
};
let mapClickTimer,placedAt=0;
const nativePlace=placeAtPointer;
placeAtPointer=function(event){placedAt=Date.now();clearTimeout(mapClickTimer);nativePlace(event);};
// Single tap opens a commune; double click and long press remain placement gestures.
map.on('click',event=>{clearTimeout(mapClickTimer);if(Date.now()-placedAt<850)return;mapClickTimer=setTimeout(()=>{comparisonWanted=false;setComparisonOpen(false);map.closePopup();if(level!=='communes'||communeState!=='ready')return;const candidates=new Map([...communes,...nearbyCommunes,...impactRows.map(r=>r.feature)].map(f=>[f.properties.code,f]));const point=turf.point([event.latlng.lng,event.latlng.lat]);const feature=[...candidates.values()].find(f=>turf.booleanPointInPolygon(point,f));if(feature)communePopup(feature,event.latlng);},280);});
map.on('dblclick',()=>clearTimeout(mapClickTimer));
$('toggle-shape').onclick=()=>{representation=representation==='circle'?'contour':'circle';updateRepresentation();};
$('toggle-overseas').onclick=()=>{const open=$('overseas-menu').hidden;$('overseas-menu').hidden=!open;$('toggle-overseas').setAttribute('aria-expanded',String(open));if(open)setMapPanel(null);};
function placeCity(lat,lng,zoom=10){moved();center=[lng,lat];draw();map.setView([lat,lng],zoom,{animate:false});placed();}
for(const feature of window.OVERSEAS_DATA.territories){const p=feature.properties,button=document.createElement('button');button.textContent=p.nom;button.onclick=()=>{$('overseas-menu').hidden=true;$('toggle-overseas').setAttribute('aria-expanded','false');placeCity(p.lat,p.lng,p.zoom);};$('overseas-options').append(button);}
$('overseas-menu').addEventListener('keydown',e=>{if(e.key==='Escape'){$('overseas-menu').hidden=true;$('toggle-overseas').setAttribute('aria-expanded','false');$('toggle-overseas').focus();}});
let searchTimer,searchAbort,searchSequence=0;
const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
$('search-city').addEventListener('input',()=>{clearTimeout(searchTimer);searchAbort?.abort();const request=++searchSequence,q=$('search-city').value.trim();$('city-results').replaceChildren();$('city-results').hidden=true;$('search-feedback').textContent='';if(q.length<2)return;searchTimer=setTimeout(async()=>{searchAbort=new AbortController();$('search-feedback').textContent='Recherche…';let french=[],failed=false;try{const params=new URLSearchParams({nom:q,fields:'nom,code,population,centre',boost:'population',limit:8});const response=await fetch('https://geo.api.gouv.fr/communes?'+params,{signal:searchAbort.signal});if(!response.ok)throw Error();french=await response.json();}catch(e){if(e.name==='AbortError')return;failed=true;}if(request!==searchSequence)return;const local=[...swiss.communes.features,...Object.values(window.OVERSEAS_DATA.seeds).flat()].filter(f=>normalize(f.properties.nom).includes(normalize(q))).sort((a,b)=>(b.properties.population||0)-(a.properties.population||0)).slice(0,8).map(f=>({...f.properties,centre:turf.pointOnFeature(f).geometry}));const choices=[...new Map([...french,...local].filter(p=>p.centre?.coordinates).map(p=>[p.code,p])).values()].sort((a,b)=>(b.population||0)-(a.population||0)).slice(0,10);$('search-feedback').textContent=failed?'Recherche France indisponible ; résultats locaux uniquement.':choices.length?'':'Aucune commune trouvée.';for(const p of choices){const button=document.createElement('button');button.textContent=p.nom+' · '+p.code;button.onclick=()=>{++searchSequence;searchAbort?.abort();$('search-city').value=p.nom;$('city-results').hidden=true;$('search-feedback').textContent='';placeCity(p.centre.coordinates[1],p.centre.coordinates[0]);};$('city-results').append(button);}$('city-results').hidden=!choices.length;},300);});
$('search-city').addEventListener('keydown',e=>{if(e.key==='Escape'){$('city-results').hidden=true;++searchSequence;searchAbort?.abort();}if(e.key==='ArrowDown'){e.preventDefault();$('city-results').querySelector('button')?.focus();}if(e.key==='Enter'){e.preventDefault();$('city-results').querySelector('button')?.click();}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#city-search'))$('city-results').hidden=true;});
window.refreshMapExtras();
