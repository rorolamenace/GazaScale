import json,os,unicodedata,collections
W=os.environ.get('WORK','.')+'/'  # work folder holding world/, us/ and geonames/ (see README)
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','dist','wd')+'/'
wi=json.load(open(W+'world/wd_index.json'));ui=json.load(open(W+'us/us_index.json'))
keep={e['code'][3:]+'.json' for e in wi}
stale=[f for f in os.listdir(D) if f.endswith('.json') and f not in keep and f not in ('index.json','countries.json')]
for f in stale:os.remove(D+f)
full=wi+ui
for e in full:
    b=e['bbox'];e['bbox']=[round(b[0]-0.005,2),round(b[1]-0.005,2),round(b[2]+0.005,2),round(b[3]+0.005,2)];e.pop('population',None)
json.dump(full,open(D+'index.json','w'),separators=(',',':'))
best={}
for row in json.load(open(W+'world/wd_places.json'))+json.load(open(W+'us/us_places.json')):
    if row[5] not in best or row[2]>best[row[5]][2]:best[row[5]]=row
json.dump([[c,r[3],r[4],r[2]] for c,r in best.items()],open(D+'countries.json','w'),separators=(',',':'))
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s) if not unicodedata.combining(c)).lower().replace('ı','i').replace('ł','l').replace('ø','o').replace('đ','d')
sh=collections.defaultdict(list)
for row in json.load(open(W+'world/wd_places.json'))+json.load(open(W+'us/us_places.json')):
    k=norm(row[0])[:2]
    if not (len(k)==2 and k.isascii() and k.isalnum()):k='__'
    sh[k].append(row)
# GeoNames cities (15,000+ inhabitants), with their Latin-script alternate names for the larger ones,
# so that 'Tokyo', 'Kuwait City' or 'Pékin' lead somewhere even where units are wards or governorates.
import re
latin=re.compile(r"^[A-Za-zÀ-ɏ' .()-]+$")
nc=0
for line in open(W+'geonames/cities15000.txt',encoding='utf-8'):
    f=line.rstrip('\n').split('\t')
    gid,name,asc,alts,lat,lon,cc,pop=f[0],f[1],f[2],f[3],float(f[4]),float(f[5]),f[8],int(f[14] or 0)
    if cc in ('FR','CH'):continue
    if cc=='PS' and lon<34.6 and lat<31.62:cc='GZ'
    names=[name]
    if pop>=300000:
        seen={norm(name)}
        for a in alts.split(','):
            n=norm(a)
            if a and latin.match(a) and n not in seen and len(a)>2:seen.add(n);names.append(a)
            if len(names)>=(80 if pop>=1000000 else 25):break
    for nm in names:
        k=norm(nm)[:2]
        if not (len(k)==2 and k.isascii() and k.isalnum()):k='__'
        sh[k].append([nm,'city-'+gid,pop,round(lon,4),round(lat,4),cc]);nc+=1
print('city rows',nc)
os.makedirs(D+'places',exist_ok=True)
for k,rows in sh.items():json.dump(rows,open(D+'places/'+k+'.json','w'),separators=(',',':'),ensure_ascii=False)
print('stale removed',len(stale),'index',len(wi)+len(ui),'shards',len(sh),'largest',max(len(v) for v in sh.values()))
