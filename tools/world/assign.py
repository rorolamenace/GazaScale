import sqlite3,shapely,numpy as np,json,time
from shapely import wkb
from shapely.strtree import STRtree
db=sqlite3.connect('kb.gpkg')
def geom(blob):
    env=(blob[3]>>1)&7;n={0:0,1:32,2:48,3:48,4:64}[env];return wkb.loads(bytes(blob[8+n:]))
t=time.time()
cs=[(r[0],r[1],r[2],geom(r[3])) for r in db.execute("select fid,hasc,population,geom from boundaries where admin_level=2")]
print('countries',len(cs),time.time()-t)
tree=STRtree([c[3] for c in cs])
out=open('feat.tsv','w')
cur=db.execute("select fid,admin_level,population,name,name_en,geom from boundaries where admin_level>2")
n=0
while True:
    rows=cur.fetchmany(20000)
    if not rows:break
    gs=[geom(r[5]) for r in rows]
    pts=shapely.point_on_surface(gs)
    idx=tree.query(pts,predicate='within')
    cc=['']*len(rows)
    for i,j in zip(*idx):cc[i]=cs[j][1] or ''
    for r,g,c,p in zip(rows,gs,cc,pts):
        out.write('\t'.join(map(str,[r[0],r[1],r[2] or 0,c,(r[4] or r[3] or '').replace('\t',' '),round(p.x,4),round(p.y,4)]))+'\n')
    n+=len(rows);print(n,round(time.time()-t),flush=True)
json.dump([[c[0],c[1],c[2]] for c in cs],open('countries.json','w'))
