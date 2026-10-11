import csv,json,glob,collections,math,os
county={};mcd={}
for r in csv.DictReader(open('sub2024.csv',encoding='latin-1')):
    if r['SUMLEV']=='050':county[r['STATE']+r['COUNTY']]=(int(r['POPESTIMATE2024']),int(r['ESTIMATESBASE2020']) or 1)
    if r['SUMLEV']=='061':mcd[r['STATE']+r['COUNTY']+r['COUSUB']]=int(r['POPESTIMATE2024'])
pl={}
for f in glob.glob('pl/*.csv'):
    for line in open(f):
        g,p=line.strip().split(',');pl[g]=int(p)
feats=json.load(open('cs_s.geojson'))['features'];pops={};est={}
for f in feats:
    p=f['properties'];g=p['GEOID']
    if g in mcd:pops[g]=mcd[g];est[g]=False
    elif g in pl and g[:5] in county:a,b=county[g[:5]];pops[g]=round(pl[g]*a/b);est[g]=True
    elif g in pl:pops[g]=pl[g];est[g]=False
by=collections.defaultdict(list)
for f in feats:by[f['properties']['GEOID'][:5]].append(f)
for c,fs in by.items():
    miss=[f for f in fs if f['properties']['GEOID'] not in pops]
    if not miss or c not in county:continue
    rest=max(0,county[c][0]-sum(pops.get(f['properties']['GEOID'],0) for f in fs))
    land=sum(f['properties']['ALAND'] for f in miss) or 1
    for f in miss:pops[f['properties']['GEOID']]=round(rest*f['properties']['ALAND']/land);est[f['properties']['GEOID']]=True
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','dist','us')+'/';os.makedirs(D,exist_ok=True)
groups=collections.defaultdict(list);places=[]
def bbox(g):
    xs=[];ys=[]
    def w(c):
        if isinstance(c[0],(int,float)):xs.append(c[0]);ys.append(c[1])
        else:[w(x) for x in c]
    w(g['coordinates']);return [min(xs),min(ys),max(xs),max(ys)]
for f in feats:
    p=f['properties'];g=p['GEOID']
    if g not in pops:continue
    b=bbox(f['geometry']);nom=p['NAME']+', '+p['STUSPS']
    cx,cy=(b[0]+b[2])/2,(b[1]+b[3])/2
    if cx>0:cx-=360
    key='%d_%d'%(math.floor(cx/2),math.floor(cy/2))
    pr={'nom':nom,'code':'US-'+g,'country':'US','population':pops[g] or None,'surface':round(p['ALAND']/1e6,2),'populationYear':2024 if p['STUSPS']!='PR' else 2020}
    if est[g]:pr['estimated']=True
    groups[key].append({'type':'Feature','geometry':f['geometry'],'properties':pr})
    places.append([nom,'US-'+g,pops[g],round(cx if cx>-180 else cx+360,4),round(cy,4),'US'])
index=[]
for k,fs in groups.items():
    json.dump({'type':'FeatureCollection','features':fs},open(D+k+'.json','w'),separators=(',',':'),ensure_ascii=False)
    bs=[bbox(f['geometry']) for f in fs]
    index.append({'code':'US-'+k,'bbox':[round(min(b[0] for b in bs),3),round(min(b[1] for b in bs),3),round(max(b[2] for b in bs),3),round(max(b[3] for b in bs),3)],'country':'US','population':sum(f['properties']['population'] or 0 for f in fs)})
json.dump(index,open('us_index.json','w'));json.dump(places,open('us_places.json','w'),ensure_ascii=False)
print('chunks',len(groups),'total',sum(pops.values()))
