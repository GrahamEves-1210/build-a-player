# wire.py : seams.py (anchors) -> seams.json (smooth splines through the anchors, sampled about every 0.5 px)
import json, numpy as np, importlib.util
S='/private/tmp/claude-501/-Users-grahameves-build-a-player/46b9cef3-70ec-42b9-8393-74347ecfbbff/scratchpad/st/'
spec=importlib.util.spec_from_file_location('seams',S+'seams.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
def cr(P, closed=False):
    P=[np.array(p[:2],float) for p in P]
    if closed: Q=[P[-1]]+P+[P[0],P[1]]
    else: Q=[2*P[0]-P[1]]+P+[2*P[-1]-P[-2]]
    out=[]
    for i in range(1,len(Q)-2):
        p0,p1,p2,p3=Q[i-1],Q[i],Q[i+1],Q[i+2]
        def tj(ti,a,b): return ti+max(np.linalg.norm(b-a),1e-6)**0.5
        t0=0; t1=tj(t0,p0,p1); t2=tj(t1,p1,p2); t3=tj(t2,p2,p3)
        n=max(2,int(np.linalg.norm(p2-p1)*2))
        for t in np.linspace(t1,t2,n,endpoint=False):
            A1=(t1-t)/(t1-t0)*p0+(t-t0)/(t1-t0)*p1; A2=(t2-t)/(t2-t1)*p1+(t-t1)/(t2-t1)*p2; A3=(t3-t)/(t3-t2)*p2+(t-t2)/(t3-t2)*p3
            B1=(t2-t)/(t2-t0)*A1+(t-t0)/(t2-t0)*A2; B2=(t3-t)/(t3-t1)*A2+(t-t1)/(t3-t1)*A3
            out.append(((t2-t)/(t2-t1)*B1+(t-t1)/(t2-t1)*B2).tolist())
    out.append(P[0].tolist() if closed else P[-1].tolist())
    return out
out={k:cr(v, closed=k in getattr(m,'CLOSED',())) for k,v in m.SEAMS.items()}
# an end that stops inside the figure runs on straight until it is outside it (unless the seam ends on another seam)
import cv2
A=cv2.imread(S+'src.png',cv2.IMREAD_UNCHANGED)[...,3]
def inside(p):
    x,y=int(round(p[0])),int(round(p[1])); return 0<=x<A.shape[1] and 0<=y<A.shape[0] and A[y,x]>=40
KEEP=getattr(m,'ENDS_ON_SEAM',{})
for k,pts in out.items():
    if k in getattr(m,'CLOSED',()): continue
    for end in (0,-1):
        if (k,'start' if end==0 else 'end') in KEEP: continue
        a=np.array(pts[end]); b=np.array(pts[3] if end==0 else pts[-4]); d=a-b; n=np.linalg.norm(d)
        if n<1e-6: continue
        d/=n; ext=[]; q=a.copy(); steps=0
        while inside(q) and steps<60: q=q+d*0.5; ext.append(q.tolist()); steps+=1
        for _ in range(6): q=q+d*0.5; ext.append(q.tolist())
        if end==0: pts[:0]=ext[::-1]
        else: pts.extend(ext)
json.dump({'paths':out,'anchors':{k:[p[:2] for p in v] for k,v in m.SEAMS.items()}},open(S+'seams.json','w'))
