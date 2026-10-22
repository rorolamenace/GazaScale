import json,csv,glob,os,shapely
from shapely.geometry import shape,Point
from pyproj import Geod
geod=Geod(ellps='WGS84')
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','dist')+'/'
pop={r['GEOGRAPHY_CODE']:int(r['OBS_VALUE']) for r in csv.DictReader(open('ward_pop.csv'))}
year={k:2021 for k in pop}
for k,v in json.load(open('scot_pop.json')).items():pop[k]=v;year[k]=2024
for k,v in json.load(open('ni_pop.json')).items():pop[k]=v;year[k]=2021
wards=json.load(open('wards_s.geojson'))['features']
nuts=[(f['properties']['NUTS_ID'],shape(f['geometry'])) for f in json.load(open('../lau/eu/nuts_uk.geojson'))['features']]
tree=shapely.STRtree([g for _,g in nuts])
# The census publishes the City of London and the Isles of Scilly as wholes: keep those two districts.
KEEP={'EU-UK_E09000001','EU-UK_E06000053'}
files={}
for f in sorted(glob.glob(D+'eu/UK*.json')):
    d=json.load(open(f));files[os.path.basename(f)[:-5]]=[x for x in d['features'] if not ((x['properties']['code'].startswith('EU-UK_')) and x['properties']['code'] not in KEEP)]
miss=0;placed=0;total=0
for w in wards:
    c=w['properties']['WD22CD']
    if c not in pop:miss+=1;continue
    g=shape(w['geometry']);pt=g.representative_point()
    idx=tree.query(pt,predicate='within')
    if len(idx)==0:
        idx=[int(tree.nearest(pt))]
    nid=nuts[idx[0]][0]
    files.setdefault(nid,[]).append({'type':'Feature','geometry':w['geometry'],'properties':{'nom':w['properties']['WD22NM'],'code':'EU-UKW_'+c,'country':'UK','population':pop[c],'surface':round(abs(geod.geometry_area_perimeter(g)[0])/1e6,2),'populationYear':year[c]}})
    placed+=1;total+=pop[c]
print('wards placed',placed,'missing pop',miss,'pop',total)
bb={}
for nid,fs in files.items():
    json.dump({'type':'FeatureCollection','features':fs},open(D+'eu/'+nid+'.json','w'),separators=(',',':'),ensure_ascii=False)
    b=shapely.total_bounds([shape(x['geometry']) for x in fs]);bb[nid]=[round(v,4) for v in b]
# update europe.js boxes for UK regions
src=open(D+'europe.js').read();a=src.index('/*rows*/')+8;b=src.index('/*end*/');rows=json.loads(src[a:b])
for r in rows:
    nid=r[0][3:]
    if nid in bb:
        r[5:9]=bb[nid];r[3]=sum(x['properties']['population'] or 0 for x in files[nid])
open(D+'europe.js','w').write(src[:a]+json.dumps(rows,separators=(',',':'),ensure_ascii=False)+src[b:])
# search list
pl=[r for r in json.load(open(D+'eu/places.json')) if not ((r[1].startswith('EU-UK_')) and r[1] not in KEEP)]
for nid,fs in files.items():
    for x in fs:
        if x['properties']['code'].startswith('EU-UKW_'):
            p=shape(x['geometry']).representative_point();pl.append([x['properties']['nom'],x['properties']['code'],x['properties']['population'],round(p.x,4),round(p.y,4),'UK'])
json.dump(pl,open(D+'eu/places.json','w'),separators=(',',':'),ensure_ascii=False)
