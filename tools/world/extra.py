# Fills the gaps left by the main sources: US island territories, northern Cyprus (Kontur), Golan Heights (CBS localities).
import sqlite3,json,math,os,collections,shapely,openpyxl
from shapely import wkb
from shapely.geometry import mapping,Point,MultiPoint
from shapely.ops import voronoi_diagram,transform,unary_union
from pyproj import Geod,Transformer
db=sqlite3.connect('kb.gpkg');geod=Geod(ellps='WGS84')
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','dist','wd')+'/'
def geom(blob):
    env=(blob[3]>>1)&7;n={0:0,1:32,2:48,3:48,4:64}[env];return wkb.loads(bytes(blob[8+n:]))
def rnd(c):return [round(c[0],4),round(c[1],4)] if isinstance(c[0],(int,float)) else [rnd(v) for v in c]
NEW=('GU','AS','MP','VI','NCY','GO')
index=[e for e in json.load(open('wd_index.json')) if e['country'] not in NEW]
places=[r for r in json.load(open('wd_places.json')) if r[5] not in NEW]
groups=collections.defaultdict(list)
def emit(cc,code,name,pop,g,year,extra):
    a=math.sqrt(max(g.area,1e-9));s=g.simplify(max(0.0005,a/300),preserve_topology=True)
    pt=s.representative_point();key='%s-%d_%d'%(cc,math.floor(pt.x/2),math.floor(pt.y/2))
    pr={'nom':name,'code':code,'country':cc,'population':round(pop) if pop else None,'surface':round(abs(geod.geometry_area_perimeter(g)[0])/1e6,1),'populationYear':year,**extra}
    groups[key].append({'type':'Feature','geometry':{'type':mapping(s)['type'],'coordinates':rnd(json.loads(json.dumps(mapping(s)['coordinates'])))},'properties':pr})
    places.append([name,code,round(pop or 0),round(pt.x,4),round(pt.y,4),cc])
feats=[l.rstrip('\n').split('\t') for l in open('feat.tsv')]
def children(parent,cc_in):
    poly=geom(db.execute(f"select geom from boundaries where fid={parent}").fetchone()[0]);P=db.execute(f"select population from boundaries where fid={parent}").fetchone()[0] or 0
    by=collections.defaultdict(list)
    for fid,lvl,pop,c,name,x,y in feats:
        if c==cc_in and int(lvl)>int(db.execute(f"select admin_level from boundaries where fid={parent}").fetchone()[0]) and poly.contains(Point(float(x),float(y))):by[int(lvl)].append((int(fid),float(pop)))
    good=[l for l,v in by.items() if sum(p for _,p in v)>=0.9*P and len(v)>=2]
    return by[max(good)] if good else [(parent,P)]
# US island territories and northern Cyprus, from Kontur
for name,cc,cc_in in [('Guam','GU','US'),('American Samoa','AS','US'),('Northern Mariana Islands','MP','US'),('United States Virgin Islands','VI','US'),('Northern Cyprus','NCY','CY')]:
    parent=db.execute("select fid from boundaries where name_en=? order by admin_level limit 1",(name,)).fetchone()[0]
    units=children(parent,cc_in)
    for fid,pop in units:
        r=db.execute(f"select name_en,name,population,geom from boundaries where fid={fid}").fetchone()
        emit(cc,'WD-%s-%d'%(cc,fid),r[0] or r[1],r[2],geom(r[3]),2023,{'modelled':True})
    print(cc,len(units))
# Golan Heights: CBS 2024 localities, each point of the plateau attached to the nearest locality
to_m=Transformer.from_crs(4326,2039,always_xy=True).transform;to_ll=Transformer.from_crs(2039,4326,always_xy=True).transform
il=sqlite3.connect('../me/IL.gpkg')
golan=geom(il.execute("select geom from boundaries where name_en='Golan Heights Subdistrict'").fetchone()[0])
gm=transform(to_m,golan).buffer(0)
rows=list(openpyxl.load_workbook('../me/bycode2024.xlsx',read_only=True).worksheets[0].iter_rows(values_only=True));I={k:i for i,k in enumerate(rows[0])}
pts=[]
for r in rows[1:]:
    pop=r[I['סך הכל אוכלוסייה 2024']]
    if not pop or r[I['שם נפה']]!='גולן':continue
    c=str(r[I['קואורדינטות']]);x,y=int(c[:6]),int(c[6:])
    pts.append((x,y,(r[I['שם יישוב באנגלית']] or r[I['שם יישוב']]).strip(),int(pop),r[I['סמל יישוב']]))
vor=voronoi_diagram(MultiPoint([(p[0],p[1]) for p in pts]),envelope=gm.envelope.buffer(20000))
for cell in vor.geoms:
    for x,y,name,pop,code in pts:
        if cell.contains(Point(x,y)):
            g=cell.intersection(gm)
            if not g.is_empty:emit('GO','WD-GO-%d'%code,name,pop,transform(to_ll,g.simplify(20)),2024,{'approx':True})
print('GO',len(pts))
for k,fs in groups.items():
    json.dump({'type':'FeatureCollection','features':fs},open(D+k+'.json','w'),separators=(',',':'),ensure_ascii=False)
    b=shapely.total_bounds([shapely.geometry.shape(f['geometry']) for f in fs])
    index.append({'code':'WD-'+k,'bbox':[round(v,3) for v in b],'country':k.split('-')[0],'population':sum(f['properties']['population'] or 0 for f in fs)})
json.dump(index,open('wd_index.json','w'));json.dump(places,open('wd_places.json','w'),ensure_ascii=False)
print('chunks',len(groups))
