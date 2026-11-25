# export.py : labels.npy -> st-figure-color.svg (one path a part, named by the side of the picture) + a gap/overlap report
import json, cv2, numpy as np, importlib.util
S='/private/tmp/claude-501/-Users-grahameves-build-a-player/46b9cef3-70ec-42b9-8393-74347ecfbbff/scratchpad/st/'
spec=importlib.util.spec_from_file_location('seams',S+'seams.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
K=3; lab=np.load(S+'labels.npy'); names=list(m.SEEDS)
ID={'back thigh':'left thigh','back sock band':'left sock top','back sock':'left sock','back boot':'left boot','front thigh':'right thigh','front sock band':'right sock top','front sock':'right sock','front boot':'right boot'}
ORDER=['ball','jersey','collar','neck','sleeve','cuff','hand','shorts','back thigh','front thigh','back sock band','front sock band','back sock','front sock','back boot','front boot','hair','face']
SIG=K*0.9; EPS=K*0.22
paths={}; polys={}
for nm in ORDER:
    i=names.index(nm)+1
    f=cv2.GaussianBlur((lab==i).astype(np.float32),(0,0),SIG)
    b=(f>=0.5).astype(np.uint8)
    cs,h=cv2.findContours(b,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_NONE)
    d=''; pl=[]
    for c in cs:
        if cv2.contourArea(c)<K*K*4: continue
        c=cv2.approxPolyDP(c,EPS,True).reshape(-1,2).astype(np.float64)
        c=(c+0.5)/K-0.5+0.5          # 3x pixel centres -> image units (pixel i covers [i, i+1))
        pl.append(c)
        d+='M'+' '.join(f'{x:.1f} {y:.1f}' for x,y in c).replace(' ','L',1).replace('L',' ',0)+'Z'
    # proper M x y L x y ... Z
    d=''
    for c in pl: d+='M'+f'{c[0][0]:.1f} {c[0][1]:.1f}'+''.join(f'L{x:.1f} {y:.1f}' for x,y in c[1:])+'Z'
    paths[nm]=d; polys[nm]=pl
svg='<svg width="1024" height="1536" viewBox="0 0 1024 1536" fill="none" xmlns="http://www.w3.org/2000/svg">\n<g id="striker">\n'
for nm in ORDER: svg+=f'<path id="{ID.get(nm,nm)}" d="{paths[nm]}" fill-rule="evenodd" stroke="black"/>\n'
svg+='</g>\n</svg>\n'
open(S+'st-figure-color.svg','w').write(svg)
print('svg bytes',len(svg),'points',sum(len(c) for pl in polys.values() for c in pl))
# coverage: every pixel of the figure under exactly one part
R=4; H,W=1536*R,1024*R; cov=np.zeros((H,W),np.uint8)
for nm,pl in polys.items():
    t=np.zeros((H,W),np.uint8); cv2.fillPoly(t,[np.round(c*R).astype(np.int32) for c in pl],1); cov+=t
a=cv2.imread(S+'src.png',cv2.IMREAD_UNCHANGED)[...,3]
solid=cv2.resize((a>=200).astype(np.uint8),(W,H),interpolation=cv2.INTER_NEAREST)
edge=cv2.resize((a>=40).astype(np.uint8),(W,H),interpolation=cv2.INTER_NEAREST)
gap=(cov==0)&(solid==1); over=(cov>=2); out=(cov>=1)&(edge==0)
print('gaps px %.1f  overlaps px %.1f  outside the art px %.1f  (image px)'%(gap.sum()/R/R,over.sum()/R/R,out.sum()/R/R))
for nmk,mk in (('gap',gap),('overlap',over),('outside',out)):
    n,l,st,ce=cv2.connectedComponentsWithStats(mk.astype(np.uint8))
    big=sorted([(st[j][4]/R/R,ce[j][0]/R,ce[j][1]/R) for j in range(1,n)],reverse=True)[:6]
    print(' ',nmk,[(round(a_,1),round(x),round(y)) for a_,x,y in big])
