import { useState } from 'react'
import { motion } from 'motion/react'
import { PATCH_NOTES } from '../../lib/whatsNew'
import { RATINGS_PATCH } from '../../data/ratings-patch'
import { SPRING_LAYOUT } from '../../lib/motion'
import { sfx } from '../../lib/juice'
import { IconClose } from './icons'

// Patch notes (opens once after an update; the menu has it too). The words: lib/whatsNew.js.
// The Ratings tab: data/ratings-patch.js, generated from scripts/ratings, by team.
const TABS = [['notes', 'PATCH NOTES'], ['ratings', 'RATINGS UPDATE']]
const SPORTS = [['nfl', 'NFL', '2026-27 season · through Week 8'], ['nba', 'NBA', '2026-27 season · through November 2']]
const logoOf = (sport, team) => (sport === 'nba' ? `/logos/nba/${team}.png` : `/logos/${team}.png`)

function Ratings() {
  const [sport, setSport] = useState('nfl')
  const teams = RATINGS_PATCH[sport]
  const span = SPORTS.find(s => s[0] === sport)[2]
  return (
    <>
      <div className="wn-sports" role="tablist" aria-label="League">
        {SPORTS.map(([id, label]) => <button key={id} role="tab" aria-selected={sport === id} className={sport === id ? 'is-on' : ''} onClick={() => { setSport(id); sfx('tap') }}>{label}</button>)}
      </div>
      <p className="wn-span">{span}</p>
      {teams.map(t => (
        <section key={`${sport}-${t.team}`} className="wn-team">
          <h2><img src={logoOf(sport, t.team)} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />{t.name}</h2>
          {t.players.map(p => (
            <div key={p.name} className="wn-player">
              <b>{p.name}</b>
              {p.changes.map(c => (
                <p key={c.attr} className="wn-change">
                  {c.attr} <span className={c.up ? 'wn-up' : 'wn-down'}>{c.from} → {c.to}</span>{c.why && <small> ({c.why.replace(/\.$/, '')})</small>}
                </p>
              ))}
            </div>
          ))}
        </section>
      ))}
    </>
  )
}

export default function AppWhatsNew({ onClose }) {
  const [tab, setTab] = useState('notes')
  const [at, setAt] = useState(0)   // which update: 0 is the newest (the date menu goes back through them)
  const N = PATCH_NOTES[at]
  const tabs = N.ratings ? TABS : TABS.slice(0, 1)
  const view = N.ratings ? tab : 'notes'
  return (
    <div className="ag-screen wn-screen">
      <div className="wn-wrap">
        <header className="wn-top">
          <div>
            <label className="wn-date">
              <span className="ag-eyebrow">{N.fullDate}</span>
              <select value={at} aria-label="Update date" onChange={e => { setAt(Number(e.target.value)); setTab('notes'); sfx('tap') }}>
                {PATCH_NOTES.map((p, i) => <option key={p.id} value={i}>{p.fullDate}</option>)}
              </select>
            </label>
            <h1 className="ag-h1">Patch Notes</h1>
          </div>
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </header>
        {tabs.length > 1 && <div className="ag-seg wn-tabs" role="tablist" aria-label="Patch notes">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => { setTab(id); sfx('tap') }}>
              {tab === id && <motion.span layoutId="wn-tab" className="ag-seg-pill" transition={SPRING_LAYOUT} />}
              {label}
            </button>
          ))}
        </div>}
        {view === 'notes' ? N.sections.map(s => (
          <section key={`${N.id}-${s.name}`} className="wn-sec">
            <h2>{s.name}</h2>
            {s.image && <img className="wn-shot" src={s.image.src} alt={s.image.alt} width={s.image.w ?? 240} height={s.image.h ?? 409} style={s.image.w > 240 ? { width: s.image.w } : undefined} loading="lazy" />}
            <ul>{s.items.map(text => <li key={text}>{text}</li>)}</ul>
          </section>
        )) : <Ratings />}
      </div>
    </div>
  )
}
