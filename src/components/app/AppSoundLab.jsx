import { useState } from 'react'
import { getPicks, setPick, playLab, playBuiltIn, LAB_GAIN } from '../../lib/juice'
import { IconClose, IconPlay, IconCheck } from './icons'

// Sound Lab (app): every sound moment, a row of candidates you can hear and
// pick. A pick takes over that moment right away (saved on this phone); COPY
// MY PICKS hands the list over so the chosen sounds can be built in.

const NAMES = {
  's-click33': 'Click', 's-plastic': 'Plastic select', 's-retrobtn': 'Retro button', 's-beep': 'Beep', 's-gear': 'Gear tick',
  's-spinwhir': 'Spinning gears', 's-whoosh': 'Whoosh', 's-counter': 'Counter', 's-gearlock': 'Gear lock', 's-lever': 'Lever',
  's-noisy': 'Noisy impact', 's-hammer': 'Hammer', 's-steamhit': 'Steam hit', 's-punch': 'Punch', 's-zoom': 'Zoom',
  's-slideclose': 'Metal slide', 's-lighter': 'Lighter click', 's-feedback': 'Feedback up', 's-powerup': 'Power-up',
  's-impact': 'Cinematic impact', 's-boom': 'Boom', 's-perc': 'Percussion hit', 's-cannon': 'Cannon', 's-explosion': 'Explosion', 's-stone': 'Stone',
}
// [event, label, what it is, candidates, has a built-in sound]
const ROWS = [
  ['tap', 'Button tap', 'Every button', ['s-click33', 's-plastic', 's-retrobtn', 's-beep', 's-gear']],
  ['spin', 'Spin starts', 'When you hit SPIN (nothing plays now)', ['s-spinwhir', 's-whoosh', 's-counter'], false],
  ['tick', 'Reel ticks', 'Rapid ticks while the reels spin', ['s-gear', 's-click33', 's-beep']],
  ['lock', 'Reel locks', 'Team and player reels land', ['s-gearlock', 's-lever', 's-noisy', 's-hammer', 's-steamhit', 's-punch']],
  ['slot', 'Pick a trait', 'A player goes into your build', ['s-lever', 's-gearlock', 's-plastic', 's-noisy', 's-steamhit']],
  ['flip', 'Card flip', 'Spin side ↔ build side', ['s-zoom', 's-whoosh', 's-slideclose']],
  ['gradepop', 'Grade pops', 'Grades landing on the build-complete card', ['s-gear', 's-click33', 's-beep']],
  ['complete', 'Build complete', 'The big hit when your build fills', ['s-impact', 's-boom', 's-perc']],
  ['stamp', 'Tier stamp', 'ELITE / STARTER stamps down', ['s-hammer', 's-noisy', 's-stone', 's-steamhit']],
  ['pop', 'Sheet opens', 'Menus, shop sheets, chat', ['s-zoom', 's-whoosh', 's-plastic']],
  ['back', 'Close / back', 'X and back buttons', ['s-slideclose', 's-click33', 's-retrobtn']],
  ['swap', 'Sport switch', 'Football ⇄ basketball', ['s-whoosh', 's-zoom']],
  ['coin', 'Coins', 'Coins land', ['s-counter', 's-feedback', 's-gear']],
  ['claim', 'Claim reward', 'Missions, achievements, streaks', ['s-feedback', 's-counter', 's-powerup']],
  ['chime', 'Mission done', 'Little "done" toast', ['s-feedback', 's-beep']],
  ['purchase', 'Buy in shop', 'You buy an item', ['s-feedback', 's-powerup', 's-counter']],
  ['equip', 'Equip', 'Put an item on', ['s-lighter', 's-lever', 's-gearlock']],
  ['deny', 'Not allowed', 'Not enough coins, spot taken', ['s-beep', 's-retrobtn']],
  ['send', 'Chat send', 'Your message goes out', ['s-click33', 's-beep', 's-plastic']],
  ['card', 'New card', 'A card joins your binder', ['s-plastic', 's-zoom']],
  ['levelup', 'Level up', 'You level up', ['s-powerup', 's-impact', 's-perc']],
  ['achievement', 'Achievement', 'An achievement unlocks', ['s-feedback', 's-perc', 's-powerup']],
  ['award', 'Season award', 'MVP, OPOY, DPOY…', ['s-impact', 's-perc', 's-boom']],
  ['champion', 'Title', 'You win it all', ['s-boom', 's-impact', 's-cannon']],
  ['snd-cannon', 'Cannon Blast', 'The shop\'s Cannon Blast victory sound', ['s-cannon', 's-explosion']],
  ['whistle', 'Season starts', 'Referee whistle on SIMULATE', []],
]

export default function AppSoundLab({ onClose }) {
  const [picks, setPicks] = useState(getPicks)
  const [copied, setCopied] = useState(false)
  const choose = (ev, id) => {
    setPick(ev, id); setPicks(getPicks())
    if (id && id !== 'none') playLab(id, LAB_GAIN[ev] ?? 0.9)
    else if (!id) playBuiltIn(ev, ev === 'complete' ? 2 : ev === 'gradepop' ? 8 : undefined)
  }
  const summary = ROWS.map(([ev, label]) => `${label}: ${picks[ev] === 'none' ? 'Silent' : picks[ev] ? NAMES[picks[ev]] : 'Current'}`).join('\n')
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) }
  }
  return (
    <div className="ag-screen sl">
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">PICK BY EAR</span><h1 className="ag-h1">Sound Lab</h1></div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
      </div>
      <p className="sl-intro">Tap a sound to hear it. Whatever you tap is used in the game right away. <b>Current</b> is what plays now, <b>Silent</b> turns that moment off.</p>
      {ROWS.map(([ev, label, sub, cands, builtIn = true], i) => {
        const cur = picks[ev] ?? null
        const Opt = ({ id, name }) => {
          const on = (cur ?? null) === id || (id === 'none' && !builtIn && !cur)
          return (
            <button className={`sl-opt${on ? ' is-on' : ''}${id === 'none' ? ' is-silent' : ''}`} onClick={() => choose(ev, id)}>
              {on ? <IconCheck size={12} /> : id === 'none' ? null : <IconPlay size={11} />}<span>{name}</span>
            </button>
          )
        }
        return (
          <section key={ev} className="sl-row ag-pop" style={{ '--d': `${Math.min(i, 10) * 25}ms` }}>
            <div className="sl-head"><span className="sl-label">{label}</span><span className="sl-sub">{sub}</span></div>
            <div className="sl-opts">
              {builtIn && <Opt id={null} name="Current" />}
              {cands.map(id => <Opt key={id} id={id} name={NAMES[id]} />)}
              <Opt id="none" name="Silent" />
            </div>
          </section>
        )
      })}
      <div className="sl-foot">
        <pre className="sl-summary">{summary}</pre>
        <button className="ag-career-act ag-career-act--shop" onClick={copy}>{copied ? 'COPIED' : 'COPY MY PICKS'}</button>
        <button className="ag-career-act" onClick={() => { localStorage.removeItem('bap_sfx_picks'); setPicks({}) }}>RESET ALL TO CURRENT</button>
      </div>
    </div>
  )
}
