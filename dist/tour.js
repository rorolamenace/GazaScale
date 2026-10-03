/* Guided tour: first visit shows every step, later visits only the first tip.
   Any click or tap outside the bubble, the × button or Escape ends it. */
(function(){
 const $=id=>document.getElementById(id),doneKey='gazascale-tour-done';
 const touch=window.matchMedia('(pointer: coarse)').matches,compact=()=>window.matchMedia('(max-width:650px)').matches;
 const move=t(touch?'Maintenez le doigt appuyé sur la carte : la surface de Gaza, les vies perdues et les blessés se replacent sur ce lieu, partout dans le monde.':'Double-cliquez sur la carte : la surface de Gaza, les vies perdues et les blessés se replacent sur ce lieu, partout dans le monde.');
 const steps=[
  {title:'Déplacez Gaza où vous voulez',text:move},
  {target:()=>$('explanation-panel').hidden?(compact()?$('welcome-bar'):$('toggle-sidebar')):$('explanation-panel'),title:'Les chiffres clés',text:'Bombardements, superficie, population, vies perdues, blessés et bâtiments détruits, chacun avec sa source et sa date.'},
  {target:()=>$('toggle-filters'),title:'Affichage',text:'Choisissez ce que montre la carte : bâtiments détruits et endommagés, vies perdues, blessés et population de Gaza. L’hypothèse de 680 000 vies perdues, non confirmée, s’active ici.'},
  {target:()=>$('toggle-shape'),title:'Contour ou cercle',text:'Gaza s’affiche avec son contour réel. Ce bouton la remplace par un cercle de même surface, 365 km², et inversement.'},
  {target:()=>$('toggle-overseas'),title:'Outre-mer',text:'Placez Gaza en Guadeloupe, à La Réunion, en Nouvelle-Calédonie et dans les autres territoires.'},
  {target:()=>$('toggle-comparison'),title:'Victimes',text:'Ouvre le détail : la population de Gaza, puis les vies perdues et les blessés transposés chez vous, commune par commune.'},
  {target:()=>$('search-city'),title:'Rechercher une ville',text:'Tapez le nom d’une ville, n’importe où dans le monde, ou un code postal français pour y placer Gaza.'},
  {target:()=>$('comparison-panel'),title:'Population et victimes',text:'La population de Gaza, les vies perdues et les blessés, chacun traduit en communes. Touchez une vignette pour la replier ou l’ouvrir. Le bleu, le rouge et le jaune ne situent personne.'},
  {target:()=>$('locate-me'),title:'Ma position',text:'Place Gaza là où vous êtes, si votre navigateur l’autorise.'},
  {target:()=>$('toggle-legend'),title:'Légende',text:'Ce que signifient les couleurs et les traits de la carte : Gaza, bâtiments, vies perdues, blessés.'},
  {target:()=>$('sources-button'),title:'Sources & méthode',text:'D’où viennent les chiffres, leurs dates et leurs limites. Chaque section a un lien à partager.'},
  {target:()=>$('help-tour'),title:'Revoir la visite',text:'Ce bouton « ? » relance cette visite à tout moment.'},
 ];
 const visible=el=>el&&!el.hidden&&el.getClientRects().length>0&&el.getBoundingClientRect().width>0;
 let bubble=null,index=0,active=[],highlighted=null;

 function build(){
  bubble=document.createElement('div');bubble.id='tour';bubble.className='tour';bubble.setAttribute('role','dialog');bubble.setAttribute('aria-labelledby','tour-title');bubble.setAttribute('aria-describedby','tour-text');
  bubble.innerHTML='<button type="button" class="tour-close" aria-label="Fermer la visite">×</button><strong id="tour-title"></strong><p id="tour-text"></p><div class="tour-actions"><span class="tour-count"></span><button type="button" class="tour-skip">Passer</button><button type="button" class="tour-next">Suivant</button></div>';
  document.body.append(bubble);window.translatePage?.(bubble);
  bubble.querySelector('.tour-close').onclick=end;bubble.querySelector('.tour-skip').onclick=end;
  bubble.querySelector('.tour-next').onclick=()=>show(index+1);
 }
 function place(){
  if(!bubble||bubble.hidden)return;
  const step=active[index],el=step.target?.(),vw=innerWidth,vh=innerHeight,gap=14,margin=12;
  const bw=bubble.offsetWidth,bh=bubble.offsetHeight;let left,top;
  if(!el){const map=$('map').getBoundingClientRect();left=map.left+map.width/2-bw/2;top=map.top+(compact()?64:76);}
  else{
   const r=el.getBoundingClientRect();
   if(r.height>vh*.5){left=r.right+gap;top=r.top+40;if(left+bw>vw-margin){left=r.left+margin;top=r.top+margin;}}
   else if(r.left>vw*.62&&r.left-gap-bw>margin){left=r.left-gap-bw;top=r.top+r.height/2-bh/2;}
   else{left=r.left+r.width/2-bw/2;top=r.bottom+gap;if(top+bh>vh-margin)top=r.top-gap-bh;}
  }
  bubble.style.left=Math.round(Math.max(margin,Math.min(left,vw-bw-margin)))+'px';
  bubble.style.top=Math.round(Math.max(margin,Math.min(top,vh-bh-margin)))+'px';
 }
 function show(i){
  highlighted?.classList.remove('tour-target');highlighted=null;
  if(i>=active.length){end();return;}
  index=i;const step=active[i],el=step.target?.();
  if(step.target&&!visible(el)){active.splice(i,1);show(i);return;}
  bubble.querySelector('#tour-title').textContent=t(step.title);bubble.querySelector('#tour-text').textContent=t(step.text);
  const many=active.length>1;bubble.querySelector('.tour-count').textContent=many?(i+1)+' / '+active.length:'';
  bubble.querySelector('.tour-skip').hidden=!many||i===active.length-1;
  const next=bubble.querySelector('.tour-next');next.hidden=!many;next.textContent=i===active.length-1?t('Terminer'):t('Suivant');
  if(el){highlighted=el;el.classList.add('tour-target');}
  bubble.hidden=false;place();(many?next:bubble.querySelector('.tour-close')).focus({preventScroll:true});
 }
 function outside(e){if(bubble&&!bubble.contains(e.target))end();}
 function key(e){if(e.key==='Escape'&&bubble&&!bubble.hidden){e.stopPropagation();end();}}
 function end(){
  if(!bubble||bubble.hidden)return;
  bubble.hidden=true;highlighted?.classList.remove('tour-target');highlighted=null;
  try{localStorage.setItem(doneKey,'1');}catch{}
  document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);
  document.dispatchEvent(new Event('gazatour:end'));
 }
 function start(full){
  if(!bubble)build();
  active=full?steps.slice():steps.slice(0,1);
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);
  show(0);
 }
 window.addEventListener('resize',place);
 let seen=false;try{seen=localStorage.getItem(doneKey)==='1';}catch{}
 if(!window.gazaRestored)start(!seen);
 $('help-tour')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setTimeout(()=>start(true),0);});
 window.gazaTour={start};
})();
