# Builds official units for ID, NG, PH, ZA, AU -> <cc>.geojson (nom, code, population, populationYear, estimated?)
import json,sys,glob,collections,os,openpyxl,shapely
from shapely.geometry import shape,mapping
from shapely.strtree import STRtree
cc=sys.argv[1]
def rows(path,sheet):
    ws=openpyxl.load_workbook(path,read_only=True)[sheet];it=ws.iter_rows(values_only=True);head=next(it)
    return [dict(zip(head,r)) for r in it]
def simp(g,t):
    g=shape(g).buffer(0);return g.simplify(t,preserve_topology=True)
def save(out,note):
    json.dump({'type':'FeatureCollection','features':out},open(cc+'.geojson','w'),ensure_ascii=False)
    print(cc,len(out),'unités',sum(f['properties']['population'] for f in out),note)
def feat(g,nom,code,pop,year,est=False):
    p={'nom':nom,'code':code,'population':int(round(pop)),'populationYear':year}
    if est:p['estimated']=True
    return {'type':'Feature','geometry':mapping(g),'properties':p}

if cc=='ID':
    # BPS 2020 census by regency/city (COD-PS) on COD-AB admin2
    pop={r['ADM2_PCODE']:r['BTOTL_2020'] for r in rows('idn-ps.xlsx','idn_admpop_adm2_2020') if r['ADM2_PCODE']}
    out=[];miss=[]
    for f in json.load(open('idn/idn_admin2.geojson'))['features']:
        p=f['properties'];v=pop.get(p['adm2_pcode'])
        if v is None:miss.append(p['adm2_name']);continue
        out.append(feat(simp(f['geometry'],0.002),p['adm2_name'],p['adm2_pcode'][2:],v,2020))
    save(out,'sans pop %d %s'%(len(miss),miss[:8]))

if cc=='NG':
    # NPC 2020 LGA projections, scaled to the NPC 2022 state totals
    lga={r['ADM2_PCODE']:(r['ADM1_PCODE'],r['T_TL']) for r in rows('nga-ps2020.xlsx','nga_admpop_adm2_2020') if r.get('ADM2_PCODE')}
    st22={r['ADM1_PCODE']:r['T_TL'] for r in rows('nga-ps.xlsx','nga_admpop_adm1_2022') if r.get('ADM1_PCODE')}
    st20=collections.Counter()
    for s,v in lga.values():st20[s]+=v
    out=[];miss=[]
    for f in json.load(open('nga/nga_admin2.geojson'))['features']:
        p=f['properties'];x=lga.get(p['adm2_pcode'])
        if not x:miss.append(p['adm2_name']);continue
        s,v=x;out.append(feat(simp(f['geometry'],0.001),'%s (%s)'%(p['adm2_name'],p['adm1_name']),p['adm2_pcode'][2:],v*st22[s]/st20[s],2022,True))
    save(out,'sans pop %d %s'%(len(miss),miss[:8]))

if cc=='PH':
    # PSA mid-2025 projections by city/municipality (OCHA Philippines on HDX) on COD-AB admin3
    rs=rows('phl-p3.xlsx','PopnProj_adm3')
    def newcode(o):return 'PH'+o[2:4]+'0'+o[4:6]+o[6:8]
    pop={newcode(r['Mun_Pcode']):r['July2025'] for r in rs if r['Mun_Pcode']}
    import re
    def k(x):return re.sub(r'\s*\(.*?\)|^city of |\s+city$','',x.lower()).replace('ñ','n').strip()
    def kp(x):return k(x).replace(' del norte','').replace(' del sur','')
    byname={(kp(r['Province']),k(r['Municipality_City'])):r['July2025'] for r in rs if r['Mun_Pcode']}
    byname1=collections.defaultdict(list)
    for r in rs:
        if r['Mun_Pcode']:byname1[k(r['Municipality_City'])].append(r['July2025'])
    out=[];miss=[]
    for f in json.load(open('phl/phl_admin3.geojson'))['features']:
        p=f['properties'];v=pop.get(p['adm3_pcode']) or byname.get((kp(p['adm2_name']),k(p['adm3_name']))) or (byname1[k(p['adm3_name'])][0] if len(byname1[k(p['adm3_name'])])==1 else None) or byname.get((kp(p['adm2_name']),re.sub(r'.*\((.*)\).*',r'\1',p['adm3_name']).lower()))
        if v is None:miss.append((p['adm3_pcode'],p['adm2_name'],p['adm3_name']));continue
        out.append(feat(simp(f['geometry'],0.0008),'%s (%s)'%(p['adm3_name'],p['adm2_name']),p['adm3_pcode'][2:],v,2025,True))
    save(out,'sans pop %d %s'%(len(miss),miss[:12]))

if cc=='ZA':
    # Official MDB wards (COD-AB admin4); each municipality's Census 2022 total is shared among its wards
    # by areal interpolation of the Kontur (OpenStreetMap) ward populations, or equally where Kontur has none.
    census=json.load(open('za-census2022.json'))
    code={f['properties']['adm3_pcode']:f['properties']['adm3_name1'] for f in json.load(open('zaf/zaf_admin3.geojson'))['features']}
    kw=[f for path in glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','dist','wd','ZA-*.json')) for f in json.load(open(path))['features']]
    kg=[shape(f['geometry']).buffer(0) for f in kw];kd=[(f['properties']['population'] or 0)/max(g.area,1e-12) for f,g in zip(kw,kg)]
    tree=STRtree(kg);byM=collections.defaultdict(list)
    for f in json.load(open('zaf/zaf_admin4.geojson'))['features']:
        p=f['properties'];g=shape(f['geometry']).buffer(0)
        w=sum(kd[i]*g.intersection(kg[i]).area for i in tree.query(g,predicate='intersects'))
        byM[code[p['adm3_pcode']]].append((p,g,w))
    out=[];nom=[]
    for m,ws in byM.items():
        tot=census.get(m,[None,None])[1]
        if not tot:nom.append(m);continue
        W=sum(w for _,_,w in ws)
        for p,g,w in ws:
            share=w/W if W>0 else 1/len(ws)
            out.append(feat(g.simplify(0.0008,preserve_topology=True),'%s Ward %d'%(p['adm3_name'],int(p['adm4_name'])),p['adm4_pcode'][2:],tot*share,2022,True))
    print('municipalités sans recensement',nom,'recensement sans municipalité',[k for k in census if k not in byM])
    save(out,'')

if cc=='AU':
    # ABS estimated resident population at 30 June 2025 by SA2, ASGS 2021 boundaries
    import shapefile
    pop={}
    wb=openpyxl.load_workbook('au-ds1.xlsx',read_only=True)
    for i in range(1,10):
        for r in wb['Table %d'%i].iter_rows(values_only=True):
            if isinstance(r[6],int) and isinstance(r[9],int):pop[str(r[6])]=r[9]
    out=[];miss=[]
    sf=shapefile.Reader('au/SA2_2021_AUST_GDA2020.shp')
    for sr in sf.iterShapeRecords():
        d=sr.record.as_dict();code=d['SA2_CODE21']
        if not sr.shape.points:continue
        if code not in pop:miss.append(d['SA2_NAME21']);continue
        out.append(feat(simp(sr.shape.__geo_interface__,0.0008),d['SA2_NAME21'],code,pop[code],2025))
    save(out,'sans pop %d %s'%(len(miss),miss[:8]))
