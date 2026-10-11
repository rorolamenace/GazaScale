import sqlite3,json,math,os,collections,shapely
from shapely import wkb
from shapely.geometry import mapping
db=sqlite3.connect('kb.gpkg')
def geom(blob):
    env=(blob[3]>>1)&7;n={0:0,1:32,2:48,3:48,4:64}[env];return wkb.loads(bytes(blob[8+n:]))
choice=json.load(open('choice.json'))
countries={c[1]:c[0] for c in json.load(open('countries.json')) if c[1]}
countries['XK']=62
kos=geom(db.execute("select geom from boundaries where fid=62").fetchone()[0])
# features per country at chosen level
want=collections.defaultdict(list)
for line in open('feat.tsv'):
    fid,lvl,pop,c,name,x,y=line.rstrip('\n').split('\t')
    if not c and kos.bounds[0]<=float(x)<=kos.bounds[2] and kos.bounds[1]<=float(y)<=kos.bounds[3] and kos.contains(shapely.Point(float(x),float(y))):c='XK'
    want[(c,int(lvl))].append(int(fid))
choice['XK']=None
for l in range(3,12):
    pass
# pick for Kosovo
lv=collections.Counter()
for (c,l),f in want.items():
    if c=='XK':lv[l]=len(f)
print('XK levels',lv)
choice['XK']=max([l for l in lv if 20<=lv[l]<=100],default=None)
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','dist','wd')+'/';os.makedirs(D,exist_ok=True)
groups=collections.defaultdict(list);places=[];stats={}
def rnd(c,p):
    return [round(c[0],p),round(c[1],p)] if isinstance(c[0],(int,float)) else [rnd(v,p) for v in c]
def emit(cc,fid,name,pop,g,year=2023,extra=None):
    if g.is_empty:return
    a=math.sqrt(max(g.area,1e-9));tol=max(0.001,a/300)
    s=g.simplify(tol,preserve_topology=True)
    if s.is_empty:s=g
    pt=s.representative_point()
    key='%s-%d_%d'%(cc,math.floor(pt.x/2),math.floor(pt.y/2))
    gj=mapping(s);gj={'type':gj['type'],'coordinates':rnd(json.loads(json.dumps(gj['coordinates'])),4)}
    code='WD-%s-%d'%(cc,fid)
    pr={'nom':name,'code':code,'country':cc,'population':round(pop) if pop else None,'surface':None,'populationYear':year,'modelled':True}
    if extra:pr.update(extra)
    groups[key].append({'type':'Feature','geometry':gj,'properties':pr})
    places.append([name,code,round(pop or 0),round(pt.x,4),round(pt.y,4),cc])
from pyproj import Geod
geod=Geod(ellps='WGS84')
def area_km2(g):
    try:return round(abs(geod.geometry_area_perimeter(g)[0])/1e6,1)
    except Exception:return None
for cc,lvl in sorted(choice.items()):
    fids=want[(cc,lvl)] if lvl else [countries[cc]]
    n=0
    for i in range(0,len(fids),500):
        q=','.join(map(str,fids[i:i+500]))
        for fid,name,name_en,pop,blob in db.execute(f"select fid,name,name_en,population,geom from boundaries where fid in ({q})"):
            g=geom(blob)
            emit(cc,fid,name_en or name or '?',pop,g)
            groups_last=None;n+=1
    stats[cc]=(lvl,n)
# Gaza Strip: the 5 governorates, PCBS late-2025 total spread by their pre-war shares
ps=sqlite3.connect('../me/PS.gpkg')
gov=[(r[0],r[1] or r[2],r[3],geom(r[4])) for r in ps.execute("select fid,name_en,name,population,geom from boundaries where admin_level=9")]
tot=sum(r[2] for r in gov)
for fid,name,pop,g in gov:emit('GZ',fid,name,pop*2130000/tot,g,2025,{'modelled':False,'estimated':True})
# areas
for fs in groups.values():
    for f in fs:f['properties']['surface']=area_km2(shapely.geometry.shape(f['geometry']))
index=[];total=0
for k,fs in groups.items():
    json.dump({'type':'FeatureCollection','features':fs},open(D+k+'.json','w'),separators=(',',':'),ensure_ascii=False)
    b=shapely.total_bounds([shapely.geometry.shape(f['geometry']) for f in fs])
    index.append({'code':'WD-'+k,'bbox':[round(v,3) for v in b],'country':k.split('-')[0],'population':sum(f['properties']['population'] or 0 for f in fs)})
    total+=os.path.getsize(D+k+'.json')
json.dump(index,open('wd_index.json','w'));json.dump(places,open('wd_places.json','w'),ensure_ascii=False)
print('countries',len(stats),'chunks',len(groups),'units',len(places),'MB',round(total/1e6,1))
json.dump(stats,open('stats.json','w'))
