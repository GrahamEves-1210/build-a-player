# build.py : src.png + seams.json -> labels (npy) + preview.png ; reports any piece without a name
import json, cv2, numpy as np, importlib.util
S='/private/tmp/claude-501/-Users-grahameves-build-a-player/46b9cef3-70ec-42b9-8393-74347ecfbbff/scratchpad/st/'
spec=importlib.util.spec_from_file_location('seams',S+'seams.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
K=3
im=cv2.imread(S+'src.png',cv2.IMREAD_UNCHANGED); a=im[...,3]
aK=cv2.resize(a,None,fx=K,fy=K,interpolation=cv2.INTER_CUBIC)
mask=(cv2.GaussianBlur(aK,(0,0),K*0.6)>=128).astype(np.uint8)
PJ=json.load(open(S+'seams.json'))
bar=np.zeros_like(mask)
for k,pts in PJ['paths'].items():
    q=np.round((np.array(pts)+0.5)*K-0.5).astype(np.int32).reshape(-1,1,2)
    cv2.polylines(bar,[q],k in getattr(m,'CLOSED',()),1,2)
free=(mask==1)&(bar==0)
n,lab=cv2.connectedComponents(free.astype(np.uint8),connectivity=4)
names=list(m.SEEDS); out=np.zeros(lab.shape,np.int32); used={}
for i,nm in enumerate(names):
    x,y=m.SEEDS[nm]; l=lab[int(y*K),int(x*K)]
    if l==0: print('SEED ON A SEAM OR OUTSIDE:',nm); continue
    if l in used: print('SAME PIECE:',nm,'and',used[l])
    used[l]=nm; out[lab==l]=i+1
# pieces nobody named
st=cv2.connectedComponentsWithStats(free.astype(np.uint8),connectivity=4)
for l in range(1,st[0]):
    if l not in used:
        x,y,w,h,ar=st[2][l]; 
        if ar>K*K*6: print('unnamed piece: area %.0f px at (%d,%d)-(%d,%d)'%(ar/K/K,x/K,y/K,(x+w)/K,(y+h)/K))
# the seam pixels (and unnamed specks) go to the nearest named part
unk=(mask==1)&(out==0)
d,idx=cv2.distanceTransformWithLabels((out==0).astype(np.uint8),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
ys,xs=np.nonzero(out>0); lut=np.zeros(idx.max()+1,np.int32); lut[idx[ys,xs]]=out[ys,xs]
out[unk]=lut[idx][unk]
np.save(S+'labels.npy',out)
# preview
g=cv2.cvtColor(im[...,:3],cv2.COLOR_BGR2GRAY); cl=cv2.createCLAHE(clipLimit=6.0,tileGridSize=(8,8)).apply(g)
e=np.clip((cl.astype(np.float32)/255)**0.55*255,0,255).astype(np.uint8)
eK=cv2.resize(cv2.cvtColor(e,cv2.COLOR_GRAY2BGR),None,fx=K,fy=K,interpolation=cv2.INTER_CUBIC).astype(np.float32)
rng=np.random.RandomState(7); pal=np.array([[0,0,0]]+[[int(c) for c in cv2.cvtColor(np.uint8([[[ (i*47)%180,200,255]]]),cv2.COLOR_HSV2BGR)[0,0]] for i in range(len(names))],np.float32)
col=pal[out]; pv=np.where((out>0)[...,None],eK*0.55+col*0.45,np.float32([90,40,110]))
edge=cv2.morphologyEx(out.astype(np.float32),cv2.MORPH_GRADIENT,np.ones((3,3)))>0
pv[edge&(mask==1)]=(255,255,255)
cv2.imwrite(S+'preview3x.png',pv.astype(np.uint8))
cv2.imwrite(S+'preview.png',cv2.resize(pv.astype(np.uint8),None,fx=0.33,fy=0.33,interpolation=cv2.INTER_AREA))
print('parts',len(used),'of',len(names))
