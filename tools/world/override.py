# Replaces a country's Kontur units by official ones. Usage: python3 override.py CC units.geojson
# Each feature needs properties nom, code, population, populationYear (and optionally estimated).
import json,math,os,sys,collections,shapely
from shapely.geometry import shape,mapping
from pyproj import Geod
cc,src=sys.argv[1],sys.argv[2];geod=Geod(ellps='WGS84')
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','dist','wd')+'/'
index=[e for e in json.load(open('wd_index.json')) if e['country']!=cc]
places=[r for r in json.load(open('wd_places.json')) if r[5]!=cc]
for f in os.listdir(D):
    if f.startswith(cc+'-') and f.endswith('.json'):os.remove(D+f)
def rnd(c):return [round(c[0],5),round(c[1],5)] if isinstance(c[0],(int,float)) else [rnd(v) for v in c]
groups=collections.defaultdict(list)
for f in json.load(open(src))['features']:
    g=shape(f['geometry']);p=f['properties'];pt=g.representative_point()
    key='%s-%d_%d'%(cc,math.floor(pt.x/2),math.floor(pt.y/2))
    pr={'nom':p['nom'],'code':'WD-%s-%s'%(cc,p['code']),'country':cc,'population':p['population'],'surface':round(abs(geod.geometry_area_perimeter(g)[0])/1e6,2),'populationYear':p['populationYear']}
    if p.get('estimated'):pr['estimated']=True
    groups[key].append({'type':'Feature','geometry':{'type':f['geometry']['type'],'coordinates':rnd(f['geometry']['coordinates'])},'properties':pr})
    places.append([p['nom'],pr['code'],p['population'] or 0,round(pt.x,4),round(pt.y,4),cc])
for k,fs in groups.items():
    json.dump({'type':'FeatureCollection','features':fs},open(D+k+'.json','w'),separators=(',',':'),ensure_ascii=False)
    b=shapely.total_bounds([shape(x['geometry']) for x in fs])
    index.append({'code':'WD-'+k,'bbox':[round(v,3) for v in b],'country':cc,'population':sum(x['properties']['population'] or 0 for x in fs)})
json.dump(index,open('wd_index.json','w'));json.dump(places,open('wd_places.json','w'),ensure_ascii=False)
print(cc,sum(len(v) for v in groups.values()),'unités',len(groups),'fichiers')
