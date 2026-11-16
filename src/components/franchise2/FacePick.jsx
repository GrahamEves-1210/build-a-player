import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TEAM } from '../../lib/franchise2'
import {
  FACE_SKIN, FACE_HEAD, FACE_EYES, FACE_IRIS, FACE_BROWS, FACE_NOSE, FACE_MOUTH, PLAYER_HAIR, PLAYER_HC, FACE_BEARD, FACE_STACHE,
  FACE_GEAR, FACE_EB, FACE_EAR, FACE_CHAIN, FACE_SLIDERS, defaultFace, normFace, buildFaceUrl,
} from '../../lib/franchise2/faces'
import { sfx } from '../../lib/juice'
import { IconSpin } from '../app/icons'
import { fkVars } from './kit'
import './face.css'

// HIS FACE, Career's full creator: the name step and the face sheet on the career screen (AppCareer.jsx). Franchise's
// builds pick a made-up face from a strip the way the coach's is picked (Setup.jsx NameForm, owner 11-15: "use the
// same system as coach face where you spin for more"). The creator a game would have: his face big on the team's colour with the categories beside it. That pair
// sticks to the top of whatever scrolls the page (--ffp-stick: how far down, under a page's own sticky bar), so his
// face stays in view while the choices scroll under it with the page: no box that scrolls on its own inside the page.
// A category with more than one part (BEARD and MOUSTACHE, HAIR's style and colour, the gear) shows one part at a
// time under a row of part tabs, so nothing sits below the bottom of the screen without a tab that reaches it.
//   face: faces.js B.face · pos (the head's width: a lineman's is wider) · team · onChange(face)
//   shuffleKey: what a new random look is keyed by (the setup's seed and the spot, plus a count)
//   color: the colour he wears when it isn't a Franchise team's (Career: his club's) · kit: what he wears under his
//   face (faces.js KITS: a basketball tank, a crew neck; eye black is football's only)
//
// Light on the CPU: a face is built once and cached by its look (faces.js). Only the open part's thumbnails are
// built. A slider moves the big face at most once a frame (requestAnimationFrame) and the thumbnails catch up when it
// is let go, so a drag never rebuilds a grid.
const SL = Object.fromEntries(FACE_SLIDERS)
// a category: its tab, then its parts: [part tab, rows]; a row: ['pick', key, title, list, view] · ['swatch', key,
// title, list] · ['slider', key]
const CATS = [
  ['skin', 'SKIN', [['SKIN TONE', [['swatch', 'skin', 'SKIN TONE', FACE_SKIN]]]]],
  ['face', 'FACE', [['SHAPE', [['pick', 'head', 'FACE SHAPE', FACE_HEAD, 'head'], ['slider', 'wt'], ['slider', 'jaw'], ['slider', 'chn'], ['slider', 'chk']]]]],
  ['eyes', 'EYES', [['EYES', [['pick', 'eyes', 'EYES', FACE_EYES, 'eyes'], ['swatch', 'iris', 'EYE COLOUR', FACE_IRIS], ['slider', 'esz'], ['slider', 'esp']]],
    ['BROWS', [['pick', 'brows', 'BROWS', FACE_BROWS, 'eyes'], ['slider', 'brh']]]]],
  ['nose', 'NOSE · MOUTH', [['NOSE', [['pick', 'nose', 'NOSE', FACE_NOSE, 'nose'], ['slider', 'nsw'], ['slider', 'nsl']]],
    ['MOUTH', [['pick', 'mouth', 'MOUTH', FACE_MOUTH, 'mouth'], ['slider', 'lip'], ['slider', 'mw']]]]],
  ['hair', 'HAIR', [['STYLE', [['pick', 'hair', 'HAIR STYLE', PLAYER_HAIR, 'hair']]], ['COLOUR', [['swatch', 'hc', 'HAIR COLOUR', PLAYER_HC]]]]],
  ['beard', 'BEARD', [['BEARD', [['pick', 'beard', 'BEARD', FACE_BEARD, 'low']]], ['MOUSTACHE', [['pick', 'stache', 'MOUSTACHE', FACE_STACHE, 'mouth']]]]],
  ['gear', 'GEAR', [['HEAD', [['pick', 'gear', 'HEAD', FACE_GEAR, 'hair']]], ['EYE BLACK', [['pick', 'eb', 'EYE BLACK', FACE_EB, 'eyes']]],
    ['EARRINGS', [['pick', 'ear', 'EARRINGS', FACE_EAR, 'ear']]], ['CHAIN', [['pick', 'chain', 'CHAIN', FACE_CHAIN, 'low']]]]],
]
const labelOf = (list, v) => list.find(x => x[0] === v)?.[1] ?? ''
const signed = v => { const n = Math.round(v * 10); return n > 0 ? `+${n}` : String(n) }
// the box that scrolls the page the creator is on (the setup's page, a sheet, the document)
const scrollerOf = el => {
  for (let n = el?.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n }
  return document.scrollingElement
}

// a row of choices, each his face with that one thing changed (built from the settled face, never mid-drag). The
// thumbnails swap in a few a frame (each new one is a face to build and an image to decode), so a change that touches
// every thumbnail (a new random look, a new hair colour) never lands as one long task.
const PER_FRAME = 2
const Pick = memo(function Pick({ k, title, list, view, tf, pos, kit, color, value, onSet }) {
  const urlOf = useCallback(v => buildFaceUrl({ pos, kit, face: { ...tf, [k]: v } }, color, view), [tf, k, pos, kit, color, view])
  const [shown, setShown] = useState(() => list.map(([v], i) => (i < PER_FRAME + 1 ? urlOf(v) : null)))
  const ref = useRef(shown)
  useEffect(() => {
    let id = 0, i = 0
    const step = () => {
      const n = ref.current.slice()
      let c = 0
      for (; i < list.length && c < PER_FRAME; i++) { const u = urlOf(list[i][0]); if (n[i] !== u) { n[i] = u; c++ } }
      if (c) { ref.current = n; setShown(n) }
      if (i < list.length) id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [urlOf, list])
  return (
    <div className="ffp-grp">
      <span className="ffp-grp-h"><small>{title}</small><b>{labelOf(list, value)}</b></span>
      <div className={`ffp-opts ffp-opts--${view}${list.length > 12 ? ' is-many' : ''}`} role="radiogroup" aria-label={title}>
        {list.map(([v, label], i) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} aria-label={label} title={label}
            className={`ffp-o${value === v ? ' is-on' : ''}`} onClick={() => onSet(k, v)}>
            {shown[i] && <img src={shown[i]} alt="" draggable={false} />}
            <span className="ffp-o-l">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
})
function Swatches({ k, title, list, value, onSet }) {
  return (
    <div className="ffp-grp">
      <span className="ffp-grp-h"><small>{title}</small><b>{labelOf(list, value)}</b></span>
      <div className={`ffp-sw ffp-sw--${k}`} role="radiogroup" aria-label={title}>
        {list.map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} aria-label={label} title={label}
            className={`ffp-s${value === v ? ' is-on' : ''}`} onClick={() => onSet(k, v)}>
            <i style={{ background: v === '#b8893c' ? 'linear-gradient(180deg, #c99a48 0 45%, #16110e 45%)' : v }} />
          </button>
        ))}
      </div>
    </div>
  )
}
// a shape slider: -1 … 1, uncontrolled while it's dragged (gen remounts it when the face is replaced)
function Slider({ k, value, onLive, onEnd }) {
  return (
    <label className="ffp-sl">
      <span className="ffp-grp-h"><small>{SL[k]}</small><b>{signed(value)}</b></span>
      <input type="range" min="-1" max="1" step="0.05" defaultValue={value} aria-label={SL[k]}
        onInput={e => onLive(k, +e.currentTarget.value)} onPointerUp={onEnd} onKeyUp={onEnd} onBlur={onEnd} onTouchEnd={onEnd} />
    </label>
  )
}

export default function FacePick({ face: given, pos, team, color: given2 = null, kit = 'fb', shuffleKey, onChange }) {
  const [cat, setCat] = useState('hair')
  const [part, setPart] = useState(0)
  const [n, setN] = useState(0)
  const color = given2 ?? TEAM[team]?.color
  // (a face saved before today's parts: the rest filled from his default look, its old parts mapped)
  const [face, setFace] = useState(() => normFace(given, defaultFace(shuffleKey ?? pos, pos)))
  const [tf, setTf] = useState(face)              // the face the thumbnails are built from (settles after a drag)
  const [gen, setGen] = useState(0)
  const pend = useRef(null), raf = useRef(0), cur = useRef(face), out = useRef(onChange)
  const stage = useRef(null), panel = useRef(null), moved = useRef(false)
  cur.current = face
  out.current = onChange
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  // a new category or part while the page is scrolled past the top of the choices: bring their top up under his
  // face (a long list left half-scrolled would otherwise open the next one in its middle)
  useLayoutEffect(() => {
    if (!moved.current) return
    moved.current = false
    // (the face's own height under where it sticks: its rect may be pushed up by the end of a short list)
    const st = stage.current, s = st?.getBoundingClientRect(), p = panel.current?.getBoundingClientRect()
    const under = s ? (parseFloat(getComputedStyle(st).top) || 0) + s.height : 0
    if (s && p && p.top < under - 1) scrollerOf(panel.current).scrollBy(0, p.top - under - 6)
  }, [cat, part])
  // a pick: the big face, the thumbnails and the setup's lower-third, all at once
  const set = useCallback((k, v) => {
    if (cur.current[k] === v) return
    const f = { ...cur.current, [k]: v }
    cur.current = f; setFace(f); setTf(f); out.current(f); sfx('tap')
  }, [])
  // a slider: only the big face follows the drag, its newest value once a frame; the thumbnails and the lower-third
  // catch up when it's let go
  const live = useCallback((k, v) => {
    pend.current = { ...(pend.current ?? cur.current), [k]: Math.round(v * 100) / 100 }
    if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; const f = pend.current; pend.current = null; if (f) { cur.current = f; setFace(f) } })
  }, [])
  const settle = useCallback(() => { requestAnimationFrame(() => { const f = cur.current; setTf(f); out.current(f) }) }, [])
  const shuffle = () => {
    const k = n + 1, f = normFace(defaultFace(`${shuffleKey}-${k}`, pos), defaultFace(`${shuffleKey}-${k}`, pos))
    cur.current = f; setN(k); setFace(f); setTf(f); onChange(f); setGen(g => g + 1); sfx('flip')
  }
  const C = CATS.find(c => c[0] === cat)
  // (eye black is football's: off a basketball or soccer kit)
  const parts = C[2].filter(p => kit === 'fb' || p[1][0][1] !== 'eb')
  const at = Math.min(part, parts.length - 1)
  const rows = parts[at][1]
  const hero = buildFaceUrl({ pos, kit, face }, color, 'hero')
  const go = (c, p) => { moved.current = true; setCat(c); setPart(p); sfx('tap') }
  return (
    <div className="ffp fk-root" style={team && TEAM[team] ? fkVars(team) : { '--tc': color, '--tca': color }}>
      <div className="ffp-stage" ref={stage}>
        <div className="ffp-top">
          <div className="ffp-hero"><img src={hero} alt="His face" draggable={false} /></div>
          <div className="ffp-tabs" role="tablist" aria-label="Face">
            {CATS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={cat === k} className={`ffp-tab${cat === k ? ' is-on' : ''}`} onClick={() => { if (cat !== k) go(k, 0) }}>{label}</button>
            ))}
            <button type="button" className="ffp-tab ffp-shuf" onClick={shuffle} aria-label="New random look"><IconSpin size={15} />RANDOM</button>
          </div>
        </div>
        {parts.length > 1 && (
          <div className="ffp-parts" role="tablist" aria-label={C[1]} style={{ '--n': parts.length }}>
            {parts.map(([label], i) => (
              <button key={label} type="button" role="tab" aria-selected={at === i} className={`ffp-part${at === i ? ' is-on' : ''}`} onClick={() => { if (at !== i) go(cat, i) }}>{label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="ffp-panel" role="tabpanel" ref={panel}>
        {rows.map(([kind, k, title, list, view]) => (
          kind === 'pick' ? <Pick key={k} k={k} title={title} list={list} view={view} tf={tf} pos={pos} kit={kit} color={color} value={face[k]} onSet={set} />
            : kind === 'swatch' ? <Swatches key={k} k={k} title={title} list={list} value={face[k]} onSet={set} />
              : <Slider key={`${k}-${gen}`} k={k} value={face[k] ?? 0} onLive={live} onEnd={settle} />
        ))}
      </div>
    </div>
  )
}
