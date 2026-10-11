import json,collections
cs={c[1]:(c[0],c[2]) for c in json.load(open('countries.json'))}
COVERED=set('FR CH IT IL PS US AL AT BE BG CY CZ DE DK EE GR ES FI HR HU IE LI LT LU LV MK MT NL NO PL PT RO RS SE SI SK GB GP MQ GF RE YT PM BL MF WF PF NC'.split())
agg=collections.defaultdict(lambda:collections.defaultdict(lambda:[0,0]))
for line in open('feat.tsv'):
    fid,lvl,pop,c,name,x,y=line.rstrip('\n').split('\t')
    if not c:continue
    a=agg[c][int(lvl)];a[0]+=1;a[1]+=float(pop)
choice={}
for c,(fid,P) in sorted(cs.items(),key=lambda kv:-(kv[1][1] or 0)):
    if not c or c in COVERED:continue
    P=P or 1;levels=sorted(agg[c].items())
    good=[(l,n,s) for l,(n,s) in levels if s>=0.9*P and n<=40000]
    pick=max(good,key=lambda t:t[0]) if good else None
    choice[c]=pick[0] if pick else None
    print(c,int(P),'->',pick and (pick[0],pick[1],round(pick[2]/P,2)),'|',[(l,n,round(s/P,2)) for l,(n,s) in levels][:8])
json.dump(choice,open('choice.json','w'))
