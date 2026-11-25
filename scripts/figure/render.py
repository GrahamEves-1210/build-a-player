# render.py out x0,y0,x1,y1 scale [mode] : the SVG's parts drawn over the art (mode 'flat': random colours; 'gap': gaps red, overlaps yellow)
import sys, re, cv2, numpy as np
S='/private/tmp/claude-501/-Users-grahameves-build-a-player/46b9cef3-70ec-42b9-8393-74347ecfbbff/scratchpad/st/'
out=sys.argv[1]; x0,y0,x1,y1=map(int,sys.argv[2].split(',')); sc=float(sys.argv[3]); mode=sys.argv[4] if len(sys.argv)>4 else 'flat'
svg=open(S+'st-figure-color.svg').read()
im=cv2.imread(S+'src.png',cv2.IMREAD_UNCHANGED); a=im[...,3]; g=cv2.cvtColor(im[...,:3],cv2.COLOR_BGR2GRAY)
cl=cv2.createCLAHE(clipLimit=6.0,tileGridSize=(8,8)).apply(g); e=np.clip((cl.astype(np.float32)/255)**0.55*255,0,255).astype(np.uint8)
W,H=int((x1-x0)*sc),int((y1-y0)*sc)
M=np.float32([[sc,0,-x0*sc],[0,sc,-y0*sc]])
base=cv2.warpAffine(cv2.cvtColor(e,cv2.COLOR_GRAY2BGR),M,(W,H),flags=cv2.INTER_CUBIC).astype(np.float32)
al=cv2.warpAffine(a,M,(W,H),flags=cv2.INTER_CUBIC).astype(np.float32)[...,None]/255
base=base*al+np.float32([110,40,90])*(1-al)
cov=np.zeros((H,W),np.uint8); col=np.zeros((H,W,3),np.float32)
for i,(pid,d) in enumerate(re.findall(r'<path id="([^"]+)" d="([^"]+)"',svg)):
    polys=[]
    for sub in d.split('Z'):
        nums=re.findall(r'-?\d+\.?\d*',sub)
        if len(nums)<6: continue
        p=np.array(nums,float).reshape(-1,2); polys.append(np.round(((p-[x0,y0])*sc)*16).astype(np.int32))
    t=np.zeros((H,W),np.uint8); cv2.fillPoly(t,polys,1,lineType=cv2.LINE_8,shift=4); cov+=t
    c=cv2.cvtColor(np.uint8([[[ (i*47)%180,210,255]]]),cv2.COLOR_HSV2BGR)[0,0].astype(np.float32)
    col[t==1]=c
    if mode=='line': cv2.polylines(base,polys,True,(0,255,255),1,cv2.LINE_AA,shift=4)
if mode=='flat': o=np.where((cov>0)[...,None],base*0.5+col*0.5,base)
elif mode=='gap':
    o=base*0.6; o[(cov==0)&(al[...,0]>0.8)]=(0,0,255); o[cov>=2]=(0,255,255)
else: o=base
cv2.imwrite(out,np.clip(o,0,255).astype(np.uint8))
