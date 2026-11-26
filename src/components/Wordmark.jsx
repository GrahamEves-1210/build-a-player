// The BUILD-A-PLAYER wordmark as Home sets it (the owner, 2026-11-13): the hand-set gaps from the L to the P (lib: app-game.css
// .bap-wm and .ag-wordmark, in em so it keeps its shape at every size). Every place the name is set in type uses it; the place
// sets the size and the colours. tail: what follows -A- (basketball's B<HoopU />CKET), else PLAYER. emStyle: -A-'s own colour
// (wm-a: -A- without its own colour, which app-game.css colours by sport. Not :not([style]): any rule that reads the style
// attribute made every inline style the page writes, each frame of a wheel or an animation, cost a style match)
// (the B and the P have the real logo's cut: the upper bowl open at the back, no upright between the top bar and
// the middle one: .wm-cb / .wm-cp in app-game.css, owner 11-25)
// (owner 11-25: the logo is one picture used everywhere, so it can never set differently from one screen to the next. The
// pictures are the spin screen's nav wordmark cut out (public/wordmark/*-m.webp); app-game.css .bap-wm--img sizes them by
// the place's font-size. tail (basketball's BUCKET) picks Build-A-Bucket; soccer's grey -A- shows wherever soccer's on)
export default function Wordmark({ tail = null }) {
  if (tail) return (
    <span className="bap-wm bap-wm--img"><img className="wmi wmi--bucket" src="/wordmark/bucket-m.webp" alt="Build-A-Bucket" draggable={false} /></span>
  )
  return (
    <span className="bap-wm bap-wm--img">
      <img className="wmi wmi--nfl" src="/wordmark/nfl-m.webp" alt="Build-A-Player" draggable={false} />
      <img className="wmi wmi--soccer" src="/wordmark/soccer-m.webp" alt="Build-A-Player" draggable={false} />
    </span>
  )
}
