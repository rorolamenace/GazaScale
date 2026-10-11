# Japan: MLIT N03 (2025-01-01) dissolved by municipality code + soumu population at 2026-01-01.
import json,glob,collections,re,os,shapely
from shapely.geometry import shape,mapping
from shapely.strtree import STRtree
import pykakasi
kk=pykakasi.kakasi()
pop=json.load(open('pop.json'))
parts=collections.defaultdict(list);meta={}
for f in json.load(open('N03-20250101.geojson'))['features']:
    p=f['properties'];c=p['N03_007']
    if not c or c not in pop:continue
    parts[c].append(shape(f['geometry']));meta[c]=p
print('codes',len(parts),'missing pop',len([c for c in pop if c not in parts]))
# Kontur names (romaji) by point in polygon
kf=[f for path in glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','dist','wd','JP-*.json')) for f in json.load(open(path))['features']]
kg=[shape(f['geometry']) for f in kf];tree=STRtree(kg)
def romaji(s):
    s=''.join(x['hepburn'] for x in kk.convert(s))
    s=s.replace('ou','o').replace('uu','u')
    return s[:1].upper()+s[1:]
def kontur(pt):
    for i in tree.query(pt,predicate='within'):return kf[i]['properties']['nom']
out=[]
for c,gs in parts.items():
    g=shapely.union_all(gs).simplify(0.0008,preserve_topology=True)
    if g.is_empty:continue
    p=meta[c];pt=g.representative_point();ward=p['N03_005'] and p['N03_004'] and p['N03_004'].endswith('市') and p['N03_005'].endswith('区')
    k=kontur(pt)
    if ward:
        city=k or romaji(p['N03_004'][:-1])
        nom='%s (%s)'%(city,romaji(p['N03_005'][:-1]))
    else:
        nom=k or romaji(re.sub('[市町村区]$','',p['N03_004'] or p['N03_003'] or ''))
    out.append({'type':'Feature','geometry':mapping(g),'properties':{'nom':nom,'code':c,'population':pop[c][2],'populationYear':2026}})
# Kontur names can repeat when two units share one Kontur polygon: fall back to romaji for the repeats
cnt=collections.Counter(f['properties']['nom'] for f in out)
for f in out:
    if cnt[f['properties']['nom']]>1 and '(' not in f['properties']['nom']:
        p=meta[f['properties']['code']];f['properties']['nom']=romaji(re.sub('[市町村区]$','',p['N03_004'] or ''))
json.dump({'type':'FeatureCollection','features':out},open('jp.geojson','w'),ensure_ascii=False)
print(len(out),sum(f['properties']['population'] for f in out))
for f in out[:3]+[x for x in out if x['properties']['code'] in('13101','13113','27127','01101','14101')]:print(f['properties'])
