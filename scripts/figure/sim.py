# sim.py out : the striker coloured the way the game will (fills screen-blended over the art), a few kits and skin tones
import sys, re, cv2, numpy as np
S='/private/tmp/claude-501/-Users-grahameves-build-a-player/46b9cef3-70ec-42b9-8393-74347ecfbbff/scratchpad/st/'
svg=open(S+'st-figure-color.svg').read()
im=cv2.imread(S+'src.png',cv2.IMREAD_UNCHANGED); R=1
base=im[...,:3].astype(np.float32)/255; al=im[...,3:4].astype(np.float32)/255
parts={}
for pid,d in re.findall(r'<path id="([^"]+)" d="([^"]+)"',svg):
    polys=[]
    for sub in d.split('Z'):
        nums=re.findall(r'-?\d+\.?\d*',sub)
        if len(nums)>=6: polys.append(np.round(np.array(nums,float).reshape(-1,2)*16).astype(np.int32))
    t=np.zeros(im.shape[:2],np.uint8); cv2.fillPoly(t,polys,255,lineType=cv2.LINE_AA,shift=4); parts[pid]=t.astype(np.float32)/255
hx=lambda h:(int(h[5:7],16)/255,int(h[3:5],16)/255,int(h[1:3],16)/255)   # -> BGR 0..1
def warm(h,light=1,red=34):
    r=int(h[1:3],16)+light+red; o=max(0,r-255); g=int(h[3:5],16)+light-o; b=int(h[5:7],16)+light-6-o
    c=lambda v:max(0,min(255,v)); return '#%02x%02x%02x'%(c(r),c(g),c(b))
def light(h): return 0.299*int(h[1:3],16)+0.587*int(h[3:5],16)+0.114*int(h[5:7],16)>200
def paint(c1,c2,skin,boot,SK=0.58,KIT=0.78,gain=1.0):
    o=np.clip(base*gain,0,1).copy()
    def fill(pid,h,op):
        nonlocal o
        m=parts[pid][...,None]*op; col=np.float32(hx(h))
        o=1-(1-o)*(1-m*col)
    shorts=c1 if light(c1) else c2
    band=c2
    for p in ('jersey','sleeve'): fill(p,c1,KIT)
    for p in ('collar','cuff'): fill(p,c2,KIT+0.04)
    fill('shorts',shorts,KIT-0.02)
    for p in ('left sock','right sock'): fill(p,c1,KIT)
    for p in ('left sock top','right sock top'): fill(p,band,KIT+0.04)
    for p in ('left boot','right boot'): fill(p,boot,KIT)
    ws=warm(skin)
    for p in ('face','neck','hand','left thigh','right thigh'): fill(p,ws,SK)
    bg=np.float32([0.07,0.05,0.04]); return (o*al+bg*(1-al))
kits=[('#EF0107','#FFFFFF','#c68642','#111111'),('#6CABDD','#1C2C5B','#8d5524','#f2f2f2'),('#FFFFFF','#FEBE10','#e0ac69','#00529F'),('#FFDF00','#009C3B','#5c3a21','#ffffff'),('#132257','#FFFFFF','#f1c27d','#d4af37')]
tiles=[paint(*k) for k in kits]
row=np.hstack([cv2.resize((t*255).astype(np.uint8)[90:1470],None,fx=0.5,fy=0.5,interpolation=cv2.INTER_AREA) for t in tiles])
cv2.imwrite(sys.argv[1],row)
if len(sys.argv)>2:
    x0,y0,x1,y1=map(int,sys.argv[2].split(','))
    cv2.imwrite(sys.argv[1].replace('.png','_z.png'),np.hstack([(t*255).astype(np.uint8)[y0:y1,x0:x1] for t in tiles[:4]]))
