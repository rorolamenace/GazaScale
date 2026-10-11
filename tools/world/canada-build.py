# Canada: StatCan 2021 census subdivisions (cartographic) + table 17-10-0155 estimates (July 1, latest year).
import json,csv,shapely
from shapely.geometry import shape,mapping
rows=list(csv.DictReader(open('17100155.csv',encoding='utf-8-sig')))
year=max(int(r['REF_DATE']) for r in rows)
pop={r['DGUID'][9:]:int(r['VALUE']) for r in rows if r['REF_DATE']==str(year) and r['DGUID'].startswith('2021A0005') and r['VALUE'].isdigit()}
src=json.load(open('csd_all.geojson'))['features'];out=[];seen=set();miss=0
for f in src:
    p=f['properties'];c=p['CSDUID']
    if c in seen or not f['geometry']:continue
    seen.add(c)
    if c not in pop:miss+=1
    g=shape(f['geometry']).buffer(0);a=g.area;g=g.simplify(0.02 if a>5 else 0.004 if a>0.5 else 0.0015,preserve_topology=True)
    if a>5 and g.geom_type=='MultiPolygon':g=shapely.MultiPolygon([q for q in g.geoms if q.area>0.003] or [max(g.geoms,key=lambda q:q.area)])
    out.append({'type':'Feature','geometry':mapping(g),'properties':{'nom':p['CSDNAME'],'code':c,'population':pop.get(c,0),'populationYear':year}})
json.dump({'type':'FeatureCollection','features':out},open('ca.geojson','w'),ensure_ascii=False)
print(year,len(out),'sans pop',miss,sum(f['properties']['population'] for f in out),'attendu',sum(pop.values()))
print([f['properties'] for f in out if f['properties']['nom'] in('Toronto','Montréal','Vancouver')])
