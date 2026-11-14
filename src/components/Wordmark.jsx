// The BUILD-A-PLAYER wordmark as Home sets it (the owner, 2026-11-13): the hand-set gaps from the L to the P (lib: app-game.css
// .bap-wm and .ag-wordmark, in em so it keeps its shape at every size). Every place the name is set in type uses it; the place
// sets the size and the colours. tail: what follows -A- (basketball's B<HoopU />CKET), else PLAYER. emStyle: -A-'s own colour
export default function Wordmark({ tail = null, emStyle }) {
  return (
    <span className="bap-wm">
      BUI<i className="wm-k wm-k2">L</i>D<em style={emStyle}><i className="wm-g1">-</i><i className="wm-g2">A</i><i className="wm-g3">-</i></em>
      {tail ?? <><i className="wm-k wm-p">P</i><i className="wm-k">L</i>AY<i className="wm-k wm-e">E</i>R</>}
    </span>
  )
}
