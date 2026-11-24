import { useEffect, useMemo, useRef, useState } from 'react'
import { slotSummary, clearFranchise, SLOTS_N, TEAM, FR_KEY } from '../../lib/franchise2'
import { pullFranchiseCloud } from '../../lib/franchise2/cloud'
import { FRANCHISE_ART, FRANCHISE_TURN, FRANCHISE_CARD_KEY, franchiseCard } from '../../lib/franchiseLive'
import { sfx } from '../../lib/juice'
import { IconClose } from '../app/icons'
import { Chyron, KLogo, fkVars } from './kit'
import { NameForm } from './Setup'
import TrophyTurn from './TrophyTurn'
import './setup.css'

// The mode's first screen: the three save slots, each a team's slab (its record, the year, rings) or an empty one.
// A save that's there (a franchise or a setup) has DELETE SAVE under it, asked twice (owner 11-15: it was only in History).
// lg: another league's saves (basketball Franchise, components/franchise2/nba): { summary, clear, TEAM, where, art, turn }
export function Slots({ owner, onOpen, onHome, lg = null }) {
  const [sure, setSure] = useState(null)
  const [, redraw] = useState(0)
  const hero = useRef(null)
  // a signed-in player's saves from the account (lib/franchise2/cloud.js): an empty slot, or his own older one, filled
  const keyOf = lg?.key ?? FR_KEY
  useEffect(() => { let on = true; pullFranchiseCloud(Array.from({ length: SLOTS_N }, (_, i) => keyOf(i))).then(ch => { if (ch && on) redraw(n => n + 1) }); return () => { on = false } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const T = lg?.TEAM ?? TEAM
  const ART = lg ? lg.art ?? {} : FRANCHISE_ART, TURN = lg ? lg.turn ?? {} : FRANCHISE_TURN   // the league's ball: the football, or basketball's
  const rows = Array.from({ length: SLOTS_N }, (_, i) => ({ i, s: (lg?.summary ?? slotSummary)(i) }))
  const del = i => {
    if (lg) lg.clear(i)
    else {
      clearFranchise(i)
      try { if (franchiseCard()?.slot === i) localStorage.removeItem(FRANCHISE_CARD_KEY) } catch {}
    }
    setSure(null); redraw(n => n + 1); sfx('deny')
  }
  return (
    <div className="fk-root fsu fsu-slots">
      <div className="fsu-top">
        <button type="button" className="fsu-x" onClick={onHome} aria-label="Home"><IconClose size={16} /></button>
        <span className="fsu-slots-gm">{owner.toUpperCase()} · GENERAL MANAGER</span>
      </div>
      <div className="fsu-body">
        <div>
          {/* the trophy, and over it the same trophy turning slowly (TrophyTurn: a square in the middle; a tap turns it again once it rests) */}
          {ART.hero && (
            <div className="fsu-hero-box" ref={hero}>
              <img className="fsu-hero" src={ART.hero} alt="" width="1280" height="720" draggable={false} onError={e => { e.currentTarget.parentNode.style.display = 'none' }} />
              <TrophyTurn base={TURN.hero} turns={24} className="fsu-hero-turn" replay={hero} />
            </div>
          )}
          <Chyron tone="ink" size="l" title="Franchise" sub="THREE SAVE SLOTS" />
          {rows.map(({ i, s }) => {
            const t = s?.team ? T[s.team] : null
            const name = t ? `${t.nick} save` : 'setup'
            return (
              <div key={i} className="fsu-slotw">
              <button type="button" className={`fsu-slot${t ? '' : ' is-empty'}`} style={{ ...(t ? fkVars(s.team) : null), '--d': `${i * 60}ms` }} onClick={() => { sfx('tap'); onOpen(i) }}>
                <span className="fsu-slot-n">{i + 1}</span>
                {t ? <span className="fsu-slot-logo"><KLogo s={s.team} size={92} /></span> : null}
                <span className="fsu-slot-txt">
                  <small>{t ? t.name.replace(` ${t.nick}`, '').toUpperCase() : s?.setup ? 'NEW FRANCHISE' : 'SLOT ' + (i + 1)}</small>
                  <b>{t ? t.nick.toUpperCase() : s?.setup ? 'SETTING UP' : 'EMPTY'}</b>
                  <em>{s?.setup ? 'PICK UP WHERE YOU LEFT IT' : s ? lg ? lg.where(s) : `${s.year} · ${s.rec} · ${s.phase === 'season' ? `WEEK ${(s.wk ?? 0) + 1}` : s.phase === 'playoffs' ? 'PLAYOFFS' : 'OFFSEASON'}${s.rings ? ` · ${s.rings} RING${s.rings > 1 ? 'S' : ''}` : ''}${s.light ? ' · LIGHT' : ''}${s.sandbox ? ' · SANDBOX' : ''}` : 'START A FRANCHISE'}</em>
                </span>
              </button>
              {s && (sure === i
                ? <div className="fsu-del is-sure" role="group" aria-label="Delete save">
                    <span>Delete the {name} for good?</span>
                    <button type="button" className="fsu-del-b" onClick={() => { setSure(null); sfx('tap') }}>KEEP</button>
                    <button type="button" className="fsu-del-b is-danger" onClick={() => del(i)}>DELETE</button>
                  </div>
                : <div className="fsu-del"><button type="button" className="fsu-del-b" onClick={() => { setSure(i); sfx('tap') }}>DELETE SAVE</button></div>)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Sandbox's ADD A PROSPECT, back from the build page: he's in this year's class; name him (a prospect has no
// number until he's drafted and signs).
export function ProspectNamer({ F, B, owner, onDone }) {
  const taken = useMemo(() => new Map(), [])
  return (
    <div className="fk-root fsu fsu-sheet" role="dialog" aria-label="Name the prospect">
      <div className="fsu-body">
        <div>
          <Chyron team={F.team} tag="DRAFT CLASS" title="Name the prospect" sub="SANDBOX" />
          <NameForm pos={B.pos} build={B.build} team={F.team} taken={taken} owner={owner} showNum={false} faceKey={`${F.seed}-prospect-${F.builds.indexOf(B)}`} cta="Add him to the class" onDone={x => onDone(x.name, x.face)} />
        </div>
      </div>
    </div>
  )
}
