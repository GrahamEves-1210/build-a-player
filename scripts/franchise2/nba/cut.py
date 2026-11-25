# NBA coaches' ESPN 65px studio headshots (public/headshots/nba-coaches/<espn>.jpg, grey or blue background) cut out
# into the players' 600x436 headshot frame: the background flood-filled off from the edges, the head sized to the
# width of Spoelstra's full-size ESPN png and set where a player's head sits, the shoulders faded out at the bottom.
# The ESPN files are left as they are; the cut-outs go to a folder of their own (coach.js coachShot reads them).
#   PYTHONPATH=<pillow> python3 scripts/franchise2/nba/cut.py public/headshots/nba-coaches/cut
import sys, glob, os
from PIL import Image, ImageFilter, ImageChops
from collections import deque
SRC=os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../public/headshots/nba-coaches')
OUT=sys.argv[1]
os.makedirs(OUT, exist_ok=True)
def bbox_alpha(im, th=40):
    a=im.split()[3].point(lambda v:255 if v>th else 0); return a.getbbox()
def head_width(im, top, frac):
    a=im.split()[3]; W,H=im.size; y=int(top+frac)
    xs=[x for x in range(W) if a.getpixel((x,min(H-1,y)))>100]
    return (min(xs),max(xs)) if xs else (0,W)
# the player-headshot frame: Spoelstra's ESPN png, his own jpg calibrates
ref=Image.open(f'{SRC}/6749.png').convert('RGBA')
def cutout(path, S=6, tol=34):
    im=Image.open(path).convert('RGB')
    W,H=im.size
    big=im.resize((W*S,H*S), Image.LANCZOS)
    px=big.load(); BW,BH=big.size
    # background colour: the median of the border
    border=[px[x,0] for x in range(BW)]+[px[0,y] for y in range(BH)]+[px[BW-1,y] for y in range(BH)]
    bg=tuple(sorted(c[i] for c in border)[len(border)//2] for i in range(3))
    def near(c): return sum((c[i]-bg[i])**2 for i in range(3)) < tol*tol
    mask=Image.new('L',(BW,BH),255); m=mask.load()
    q=deque()
    for x in range(BW):
        for y in (0,):
            q.append((x,y))
    for y in range(BH):
        q.append((0,y)); q.append((BW-1,y))
    seen=set()
    while q:
        x,y=q.popleft()
        if (x,y) in seen or x<0 or y<0 or x>=BW or y>=BH: continue
        seen.add((x,y))
        if not near(px[x,y]): continue
        m[x,y]=0
        q.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
    mask=mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.6))
    out=big.convert('RGBA'); out.putalpha(mask)
    return out, bg
def place(cut, scale, top_y, cx):
    W,H=cut.size
    c=cut.resize((int(W*scale),int(H*scale)), Image.LANCZOS)
    bb=bbox_alpha(c)
    hw=head_width(c, bb[1], c.size[1]*0.12)
    hx=(hw[0]+hw[1])/2
    canvas=Image.new('RGBA',(600,436),(0,0,0,0))
    ox=int(cx-hx); oy=int(top_y-bb[1])
    canvas.paste(c,(ox,oy),c)
    # (the photo's bottom edge: faded out over its last 18%, so the cut torso doesn't end on a hard line)
    bottom=oy+c.size[1]
    if bottom<436:
        a=canvas.split()[3]; g=Image.new('L',(600,436),255); gp=g.load()
        f0=bottom-int(c.size[1]*0.18)
        for y in range(436):
            v=255 if y<f0 else max(0,int(255*(bottom-y)/max(1,bottom-f0)))
            for x in range(600): gp[x,y]=v
        canvas.putalpha(ImageChops.multiply(a,g))
    return canvas
rb=bbox_alpha(ref); rtop=rb[1]; rhw=head_width(ref, rtop, 436*0.12)
rhead=rhw[1]-rhw[0]; rcx=(rhw[0]+rhw[1])/2
print('ref', rb, rhw, rhead)
# calibrate: Spoelstra's jpg head width at the same depth
sj,_=cutout(f'{SRC}/6749.jpg')
sb=bbox_alpha(sj); shw=head_width(sj, sb[1], sj.size[1]*0.12)
print('spo jpg', sb, shw, sj.size)
for f in sorted(glob.glob(f'{SRC}/*.jpg')):
    n=os.path.basename(f)[:-4]
    c,bg=cutout(f, tol={'489':14}.get(n,34))
    b=bbox_alpha(c); hw=head_width(c,b[1],c.size[1]*0.12)
    scale=rhead/max(1,(hw[1]-hw[0]))*{'3612':0.84}.get(n,1)
    out=place(c, scale, rtop, 300)
    out.save(f'{OUT}/{n}.png', optimize=True)
    print(n, bg, 'scale', round(scale,2), os.path.getsize(f'{OUT}/{n}.png'))
