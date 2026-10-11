import json,subprocess,urllib.parse
from concurrent.futures import ThreadPoolExecutor
B="https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer/9/query"
def get(q):
    r=subprocess.run(['curl','-s','-m','180',B+'?'+urllib.parse.urlencode(q)],capture_output=True,text=True).stdout
    return json.loads(r)['features']
def fetch(ids,tol=0.0005):
    q={'objectIds':','.join(map(str,ids)),'outFields':'CSDUID,CSDNAME,PRUID','outSR':4326,'f':'geojson','maxAllowableOffset':tol,'geometryPrecision':5}
    for _ in range(2):
        try:return get(q)
        except Exception:pass
    if len(ids)>1:return [f for i in ids for f in fetch([i],tol)]
    if tol<0.05:return fetch(ids,tol*4)
    print('lost',ids,flush=True);return []
ids=json.loads(subprocess.run(['curl','-s','-m','180',B+'?where=1%3D1&returnIdsOnly=true&f=json'],capture_output=True,text=True).stdout)['objectIds']
chunks=[ids[i:i+20] for i in range(0,len(ids),20)];feats=[]
with ThreadPoolExecutor(6) as ex:
    for n,fs in enumerate(ex.map(fetch,chunks)):
        feats+=fs;print(n,len(feats),flush=True)
json.dump({'type':'FeatureCollection','features':feats},open('csd_all.geojson','w'))
print('done',len(feats),len(ids))
