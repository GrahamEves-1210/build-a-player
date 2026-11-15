import { useMemo, useState } from 'react'
import { TEAM } from '../../lib/franchise2'
import { FACE_SKIN, FACE_HEAD, FACE_EYES, FACE_BROWS, FACE_NOSE, FACE_MOUTH, FACE_HAIR, FACE_HC, FACE_BEARD, FACE_STACHE, FACE_GEAR, defaultFace, buildFaceUrl } from '../../lib/franchise2/faces'
import { sfx } from '../../lib/juice'
import { IconSpin } from '../app/icons'
import { fkVars } from './kit'
import './face.css'

// A BUILD'S FACE, on his name step (Setup.jsx NameForm). It sits right under the name step's big lower-third, so his
// face changes in view. Seven categories (a 4 × 2 block with the shuffle), then the category's choices as big
// previews of his own face with that one thing changed, zoomed to where it shows (the eyes, the mouth, the beard).
// Colours (skin, hair colour) are plain swatches.
//   face: faces.js B.face · pos (the head's width: a lineman's is wider) · team · onChange(face)
//   shuffleKey: what a new random look is keyed by (the setup's seed and the spot, plus a count)
const CATS = [
  ['skin', 'SKIN', [['skin', 'SKIN TONE', FACE_SKIN, 'swatch']]],
  ['head', 'HEAD', [['head', 'FACE SHAPE', FACE_HEAD, 'full']]],
  ['hair', 'HAIR', [['hair', 'STYLE', FACE_HAIR, 'full'], ['hc', 'COLOUR', FACE_HC, 'swatch']]],
  ['beard', 'BEARD', [['beard', 'BEARD', FACE_BEARD, 'low'], ['stache', 'MOUSTACHE', FACE_STACHE, 'mouth']]],
  ['eyes', 'EYES', [['eyes', 'EYES', FACE_EYES, 'eyes'], ['brows', 'BROWS', FACE_BROWS, 'eyes']]],
  ['nose', 'NOSE · MOUTH', [['nose', 'NOSE', FACE_NOSE, 'mouth'], ['mouth', 'MOUTH', FACE_MOUTH, 'mouth']]],
  ['gear', 'GEAR', [['gear', 'GAME DAY', FACE_GEAR, 'full']]],
]
const labelOf = (list, v) => list.find(x => x[0] === v)?.[1] ?? ''

function Group({ k, title, list, kind, face, pos, color, onSet }) {
  const thumbs = useMemo(() => (kind === 'swatch' ? null : list.map(([v]) => buildFaceUrl({ pos, face: { ...face, [k]: v } }, color))),
    [kind, k, pos, color, ...Object.values(face)]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ffp-grp">
      <span className="ffp-grp-h"><small>{title}</small><b>{labelOf(list, face[k])}</b></span>
      <div className={`ffp-opts ffp-opts--${kind}`} role="radiogroup" aria-label={title}>
        {list.map(([v, label], i) => (
          <button key={v} type="button" role="radio" aria-checked={face[k] === v} aria-label={label} title={label}
            className={`ffp-o${face[k] === v ? ' is-on' : ''}`} onClick={() => onSet(k, v)}>
            {thumbs ? <img src={thumbs[i]} alt="" draggable={false} /> : <i style={{ background: v }} />}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function FacePick({ face: given, pos, team, shuffleKey, onChange }) {
  const [cat, setCat] = useState('hair')
  const [n, setN] = useState(0)
  const color = TEAM[team]?.color
  // (a face saved before the picker had every part: the rest filled from his default look)
  const face = useMemo(() => ({ ...defaultFace(shuffleKey ?? pos, pos), ...given }), [given, shuffleKey, pos])
  const set = (k, v) => { if (face[k] === v) return; onChange({ ...face, [k]: v }); sfx('tap') }
  const shuffle = () => { const k = n + 1; setN(k); onChange(defaultFace(`${shuffleKey}-${k}`, pos)); sfx('flip') }
  const [, , groups] = CATS.find(c => c[0] === cat)
  return (
    <div className="ffp" style={fkVars(team)}>
      <div className="ffp-cats" role="tablist" aria-label="Face">
        {CATS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={cat === k} className={`ffp-cat${cat === k ? ' is-on' : ''}`} onClick={() => { setCat(k); sfx('tap') }}>{label}</button>
        ))}
        <button type="button" className="ffp-cat ffp-shuf" onClick={shuffle} aria-label="New random look"><IconSpin size={16} />RANDOM</button>
      </div>
      {groups.map(([k, title, list, kind]) => <Group key={k} k={k} title={title} list={list} kind={kind} face={face} pos={pos} color={color} onSet={set} />)}
    </div>
  )
}
