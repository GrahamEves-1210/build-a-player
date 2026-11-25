# view.py x0 y0 x1 y1 out [scale] [overlay.svgpaths.json]  : an enhanced, gridded crop of the striker art
import sys, json, cv2, numpy as np
S='/private/tmp/claude-501/-Users-grahameves-build-a-player/46b9cef3-70ec-42b9-8393-74347ecfbbff/scratchpad/st/'
x0,y0,x1,y1=map(int,sys.argv[1:5]); out=sys.argv[5]; sc=float(sys.argv[6]) if len(sys.argv)>6 else 2
im=cv2.imread(S+'src.png',cv2.IMREAD_UNCHANGED); a=im[...,3]; g=cv2.cvtColor(im[...,:3],cv2.COLOR_BGR2GRAY)
cl=cv2.createCLAHE(clipLimit=6.0,tileGridSize=(8,8)).apply(g)
e=np.clip((cl.astype(np.float32)/255)**0.55*255,0,255).astype(np.uint8)
rgb=cv2.cvtColor(e,cv2.COLOR_GRAY2BGR).astype(np.float32)
bg=np.zeros_like(rgb); bg[...]=(120,60,150)
al=(a.astype(np.float32)/255)[...,None]; rgb=rgb*al+bg*(1-al)
if len(sys.argv)>7:
    PJ=json.load(open(sys.argv[7]))
c=rgb[y0:y1,x0:x1].astype(np.uint8)
c=cv2.resize(c,None,fx=sc,fy=sc,interpolation=cv2.INTER_CUBIC)
if len(sys.argv)>7:
    cols=[(0,255,255),(0,255,0),(255,128,0),(0,128,255),(255,0,255),(255,255,0),(128,255,128),(0,0,255),(255,200,200),(200,255,0)]
    for i,(k,pts) in enumerate(PJ['paths'].items()):
        q=((np.array(pts)-[x0,y0])*sc).astype(np.int32).reshape(-1,1,2)
        cv2.polylines(c,[q],False,cols[i%len(cols)],1,cv2.LINE_AA)
        for ax,ay in PJ['anchors'][k]: cv2.circle(c,(int((ax-x0)*sc),int((ay-y0)*sc)),2,(0,0,255),-1)
step=50 if sc<=2.5 else 25
for x in range((x0//step+1)*step,x1,step):
    X=int((x-x0)*sc); cv2.line(c,(X,0),(X,c.shape[0]),(255,255,255) if x%100==0 else (160,160,160),1); 
    if x%100==0 or step==25: cv2.putText(c,str(x),(X+2,12),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,255,255),1)
for y in range((y0//step+1)*step,y1,step):
    Y=int((y-y0)*sc); cv2.line(c,(0,Y),(c.shape[1],Y),(255,255,255) if y%100==0 else (160,160,160),1)
    if y%100==0 or step==25: cv2.putText(c,str(y),(2,Y-2),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,255,255),1)
cv2.imwrite(out,c)
