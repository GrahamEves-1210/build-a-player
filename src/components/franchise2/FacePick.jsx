import { useMemo, useState } from 'react'
import { TEAM } from '../../lib/franchise2'
import { FACE_SKIN, FACE_HAIR, FACE_HC, FACE_BEARD, defaultFace, buildFaceUrl } from '../../lib/franchise2/faces'
import { sfx } from '../../lib/juice'
import { IconSpin } from '../app/icons'
import { fkVars } from './kit'
import './face.css'

// A BUILD'S FACE, on his name step (Setup.jsx NameForm): skin tone, hair, hair colour, facial hair.
// It sits right under the name step's big lower-third, so his face changes in view: four tabs (each shows what it's
// set to) and the tab's choices: swatches for the two colours, his own head with each cut or beard for the other two.
//   face: { skin, hair, hc, beard } · pos (the head's width: a lineman's is wider) · team · onChange(face)
//   shuffleKey: what a new random look is keyed by (the setup's seed and the spot, plus a count)
const TABS = [['skin', 'SKIN', FACE_SKIN], ['hair', 'HAIR', FACE_HAIR], ['hc', 'COLOUR', FACE_HC], ['beard', 'BEARD', FACE_BEARD]]
const labelOf = (list, v) => list.find(x => x[0] === v)?.[1] ?? ''

export default function FacePick({ face, pos, team, shuffleKey, onChange }) {
  const [tab, setTab] = useState('hair')
  const [n, setN] = useState(0)
  const color = TEAM[team]?.color
  const [, , list] = TABS.find(t => t[0] === tab)
  const thumbs = useMemo(() => (tab === 'hair' || tab === 'beard'
    ? list.map(([v]) => buildFaceUrl({ pos, face: { ...face, [tab]: v } }, color)) : null), [tab, face.skin, face.hc, face.hair, face.beard, pos, color]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => { if (face[k] === v) return; onChange({ ...face, [k]: v }); sfx('tap') }
  const shuffle = () => { const k = n + 1; setN(k); onChange(defaultFace(`${shuffleKey}-${k}`, pos)); sfx('flip') }
  return (
    <div className="ffp" style={fkVars(team)}>
      <div className="ffp-top">
        <div className="ffp-tabs" role="tablist" aria-label="Face">
          {TABS.map(([k, label, opts]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`ffp-tab${tab === k ? ' is-on' : ''}`} onClick={() => { setTab(k); sfx('tap') }}>
              <small>{label}</small>
              <b>{k === 'skin' ? <i className="ffp-dot ffp-dot--wide" style={{ background: face[k] }} title={labelOf(opts, face[k])} /> : <>{k === 'hc' && <i className="ffp-dot" style={{ background: face[k] }} />}{labelOf(opts, face[k])}</>}</b>
            </button>
          ))}
        </div>
        <button type="button" className="ffp-shuf" onClick={shuffle} aria-label="New random look"><IconSpin size={18} /></button>
      </div>
      <div className={`ffp-opts ffp-opts--${tab}`} role="radiogroup" aria-label={TABS.find(t => t[0] === tab)[1]}>
        {list.map(([v, label], i) => (
          <button key={v} type="button" role="radio" aria-checked={face[tab] === v} aria-label={label} title={label}
            className={`ffp-o${face[tab] === v ? ' is-on' : ''}`} onClick={() => set(tab, v)}>
            {thumbs ? <img src={thumbs[i]} alt="" draggable={false} /> : <i style={{ background: v }} />}
          </button>
        ))}
      </div>
    </div>
  )
}
