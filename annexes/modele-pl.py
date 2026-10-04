import math
S = {
 'prudent':  dict(terr=[(1,1.0),(25,0.6)], base=5, slope=1.2, cap=28, churn=0.075, hours=12, rate=22, take=0.14, dia_share=0.10, dia_arpu=50, dia_churn=0.05,
                  cac=150, cac_d=230, b2b=[(10,100),(24,800),(36,1800)], b2g=[30000,70000,110000], comp=2.0, dev_start=13, app=50000),
 'central':  dict(terr=[(1,1.0),(13,0.7),(19,0.6)], base=6, slope=2.0, cap=45, churn=0.06, hours=14, rate=22, take=0.15, dia_share=0.15, dia_arpu=55, dia_churn=0.04,
                  cac=110, cac_d=200, b2b=[(7,0),(12,250),(24,1500),(36,4000)], b2g=[40000,120000,200000], comp=3.0, dev_start=10, app=60000),
 'ambitieux':dict(terr=[(1,1.0),(10,0.8),(13,0.7),(25,0.9)], base=8, slope=3.0, cap=65, churn=0.05, hours=16, rate=23, take=0.16, dia_share=0.22, dia_arpu=60, dia_churn=0.035,
                  cac=90, cac_d=170, b2b=[(6,0),(12,500),(24,3000),(36,8000)], b2g=[60000,180000,300000], comp=4.0, dev_start=8, app=80000),
}
def interp(pts,m):
    if m<pts[0][0]: return 0
    for (a,va),(b,vb) in zip(pts,pts[1:]):
        if a<=m<=b: return va+(vb-va)*(m-a)/(b-a)
    return pts[-1][1]
def run(name,p,verbose=False):
    L=D=0.0; cum=0; minc=0; be=None; rows=[]; acc_ann={}
    for m in range(1,37):
        newL=0
        for (start,f) in p['terr']:
            if m>=start:
                k=m-start
                newL+=f*min(p['cap'], p['base']+p['slope']*k)
        newD=newL*p['dia_share']
        L=L*(1-p['churn'])+newL; D=D*(1-p['dia_churn'])+newD
        gmvL=L*p['hours']*p['rate']; gmvD=D*12*p['rate']
        hB=interp(p['b2b'],m)
        rev_fam=gmvL*p['take']
        rev_dia=D*p['dia_arpu']
        rev_b2b=hB*7.0
        y=(m-1)//12
        rev_b2g=p['b2g'][y]/12
        rev_comp=(L+D)*p['comp'] if m>=10 else 0
        rev=rev_fam+rev_dia+rev_b2b+rev_b2g+rev_comp
        gmv=gmvL+gmvD+hB*29
        # variable costs
        pay=0.015*gmv
        ins=1.0*(L+D)+500
        accomp_new=(newL+newD)/4+ ( (L+D)/4*0.04)
        checks=accomp_new*40
        coord_fte=max(0.5,(L+D+hB/15)/150)
        coord=coord_fte*2900
        mkt=newL*p['cac']+newD*p['cac_d']+1000
        var=pay+ins+checks
        # fixed
        founders=0 if m<=6 else (4000 if m<=12 else ((6000 if name=='prudent' else 8000) if m<=24 else (7000 if name=='prudent' else 10000)))
        staff=0
        if m>=p['dev_start']+3: staff+=5500
        if m>=13 and name!='prudent': staff+=4000
        if name=='ambitieux': staff+= (9000 if m>=13 else 0)+(16000 if m>=25 else 0)
        if name=='prudent' and m>=25: staff-=7000
        for (start,f) in p['terr'][1:]:
            if m>=start-1: staff+=3500
        if m>=25: staff+=5000+2000
        tech=300 if m<12 else (1500 if m<=24 else 3000)
        appdev=p['app']/6 if p['dev_start']<=m<p['dev_start']+6 else 0
        admin=1500+500*sum(1 for s,_ in p['terr'] if m>=s)+(1000 if m>=13 else 0)
        struct=0.08*rev
        fixed=founders+staff+tech+appdev+admin+struct
        ebitda=rev-var-coord-mkt-fixed
        cum+=ebitda; minc=min(minc,cum)
        if be is None and m>6 and ebitda>0: be=m
        a=acc_ann.setdefault(y+1,dict(rev=0,fam=0,dia=0,b2b=0,b2g=0,comp=0,gmv=0,var=0,coord=0,mkt=0,fixed=0,ebitda=0))
        for k,v in dict(rev=rev,fam=rev_fam,dia=rev_dia,b2b=rev_b2b,b2g=rev_b2g,comp=rev_comp,gmv=gmv,var=var,coord=coord,mkt=mkt,fixed=fixed,ebitda=ebitda).items(): a[k]+=v
        a['L']=L; a['D']=D; a['hB']=hB
        if verbose and m in (3,6,12,18,24,30,36): print(name,m,'L',round(L),'D',round(D),'rev',round(rev),'ebitda',round(ebitda),'cum',round(cum))
    print(name,'BE month',be,'min cum',round(minc))
    for y,a in acc_ann.items():
        print(' Y',y,{k:round(v) for k,v in a.items()})
for n,p in S.items(): run(n,p,True)
