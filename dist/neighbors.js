/* Yellow equivalence grows through neighboring municipalities around the footprint. */
(function(root){
function within(feature,footprint,turf){const parts=turf.flatten(feature).features,containers=turf.flatten(footprint).features;return parts.every(part=>containers.some(container=>turf.booleanWithin(part,container)));}
function selectNeighbors(features,footprint,origin,target,excluded,turf){
 const excludedCodes=new Set(excluded.map(f=>f.properties.code));
 const pool=[...new Map(features.map(f=>[f.properties.code,f])).values()].filter(f=>!excludedCodes.has(f.properties.code)&&Number.isFinite(f.properties.population)&&f.properties.population>0&&!within(f,footprint,turf));
 const point=turf.point(origin),overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
 const ranked=pool.map(f=>{f.bbox??=turf.bbox(f);f._comparisonPoint??=turf.pointOnFeature(f);return {feature:f,distance:turf.distance(point,f._comparisonPoint),available:false};}).sort((a,b)=>a.distance-b.distance||a.feature.properties.code.localeCompare(b.feature.properties.code));
 // A narrow tolerance accommodates independently simplified shared borders.
 function connect(feature){const expanded=turf.buffer(feature,.03,{units:'kilometers',steps:2});if(!expanded)return;const bounds=turf.bbox(expanded);for(const row of ranked)if(!row.available&&!row.used&&overlap(row.feature.bbox,bounds)&&turf.booleanIntersects(row.feature,expanded))row.available=true;}
 connect(footprint);for(const f of excluded)connect(f);
 let remaining=target;const selected=[];
 while(remaining>0){const next=ranked.find(row=>row.available&&!row.used);if(!next)break;next.used=true;const population=next.feature.properties.population,represented=Math.min(remaining,population);selected.push({feature:next.feature,population,represented,fraction:represented/population});remaining-=represented;if(remaining>0)connect(next.feature);}
 return {selected,remaining,total:selected.reduce((sum,row)=>sum+row.population,0)};
}
root.GazaSelection.within=within;root.GazaSelection.selectNeighbors=selectNeighbors;
})(typeof window==='undefined'?globalThis:window);
