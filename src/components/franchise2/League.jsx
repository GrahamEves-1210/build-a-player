import { useMemo, useState } from 'react'
import { TEAM, standings, recText, DIVISIONS, CONFS, ROUNDS, CONF_OF, DIV_OF, leagueStats, leaders, whoIs, LEADER_CATS, wire, scoreText } from '../../lib/franchise2'
import { sfx } from '../../lib/juice'
import { Chyron, KLogo, Tag, fkVars } from './kit'
import { Man, PlayerPage } from './dparts'
import { Logo } from './bits'
import './fd.css'

// LEAGUE: the standings as the broadcast shows them (a bar a team, as long as its winning percentage), the league's
// leaders, the wire, and every game's score.
const VIEWS = [['table', 'STANDINGS'], ['leaders', 'LEADERS'], ['wire', 'WIRE'], ['scores', 'SCORES']]

export default function LeagueTab({ F, owner, act }) {
  const [view, setView] = useState('table')
  const [page, setPage] = useState(null)
  return (
    <div className="fd fk">
      <div className="fd-seg fd-seg--4" role="tablist">
        {VIEWS.map(([k, label]) => <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'is-on' : ''} onClick={() => { setView(k); sfx('tap') }}>{label}</button>)}
      </div>
      {view === 'table' && <Standings F={F} />}
      {view === 'leaders' && <Leaders F={F} owner={owner} onMan={setPage} />}
      {view === 'wire' && <Wire F={F} />}
      {view === 'scores' && <Scores F={F} />}
      {page != null && <PlayerPage F={F} id={page} owner={owner} act={act} onClose={() => setPage(null)} />}
    </div>
  )
}

// ── Standings ────────────────────────────────────────────────────────────────
const streakText = k => (k > 0 ? `W${k}` : k < 0 ? `L${-k}` : '')
function Standings({ F }) {
  const [conf, setConf] = useState(CONF_OF[F.team])
  const S = useMemo(() => standings(F), [F, F.wk, F.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const pct = s => { const r = S.R[s], g = r.w + r.l + r.t; return g ? (r.w + r.t / 2) / g : 0 }
  const seeds = S.seeds[conf], hunt = S.conf[conf].slice(7, 10)
  return (
    <>
      {F.po ? <Bracket F={F} /> : null}
      <div className="fd-seg" role="tablist">
        {CONFS.map(c => <button key={c} role="tab" aria-selected={conf === c} className={conf === c ? 'is-on' : ''} onClick={() => { setConf(c); sfx('tap') }}>{c}</button>)}
      </div>
      <Chyron tone="ink" title={F.po ? `${conf} FIELD` : `${conf} · IN TODAY`} sub={F.phase === 'season' ? `AFTER WEEK ${F.wk}` : `${F.year} FINAL`} />
      <div className="fd-seeds">
        {seeds.map((s, i) => (
          <span key={s} className={`fd-seed${s === F.team ? ' is-me' : ''}${i === 0 ? ' is-bye' : ''}`} style={fkVars(s)}>
            <i>{i + 1}</i><KLogo s={s} size={30} /><b>{recText(S.R[s])}</b>
          </span>
        ))}
      </div>
      {!F.po && hunt.length > 0 && <div className="fd-hunt"><small>IN THE HUNT</small>{hunt.map(s => <span key={s} className={s === F.team ? 'is-me' : ''}><KLogo s={s} size={20} />{recText(S.R[s])}</span>)}</div>}
      {DIVISIONS.filter(d => d.conf === conf).map((d, di) => (
        <section key={d.name} className="fd-div" style={{ '--d': `${di * 50}ms` }}>
          <div className="fd-room-h"><b>{d.name.toUpperCase()}</b><small>W-L · DIV</small></div>
          {S.div[d.name].map((s, i) => {
            const r = S.R[s], k = Math.max(0.1, pct(s))
            return (
              <div key={s} className={`fd-bar${s === F.team ? ' is-me' : ''}`} style={{ ...fkVars(s), '--k': k, '--d': `${di * 50 + i * 40}ms` }}>
                <span className="fd-bar-fill"><KLogo s={s} size={26} /><b>{TEAM[s].nick.toUpperCase()}</b>{i === 0 && r.w + r.l + r.t > 0 && <em>1</em>}</span>
                <span className="fd-bar-rec"><b>{recText(r)}</b><small>{r.dw}-{r.dl}{r.dt ? `-${r.dt}` : ''}{r.strk ? ` · ${streakText(r.strk)}` : ''}</small></span>
              </div>
            )
          })}
        </section>
      ))}
    </>
  )
}

// ── Leaders ──────────────────────────────────────────────────────────────────
function Leaders({ F, owner, onMan }) {
  const tot = useMemo(() => leagueStats(F), [F, F.wk, F.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const who = useMemo(() => whoIs(F), [F, F.wk, F.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!Object.keys(tot).length) return <div className="fd-none">THE LEADERS START AFTER WEEK 1</div>
  return (
    <>
      {LEADER_CATS.map((c, ci) => {
        const L = leaders(F, c.f ?? c.k, 5, { tot, who })
        if (!L.length) return null
        const [a, ...rest] = L
        return (
          <section key={c.k} className="fd-lead" style={{ '--d': `${ci * 40}ms` }}>
            <div className="fd-room-h"><b>{c.label}</b><small>{F.year}</small></div>
            <Man F={F} p={a.p} s={a.s} owner={owner} size="m" stat={{ v: a.v.toLocaleString('en-US'), label: c.unit }} line={TEAM[a.s].nick.toUpperCase()} onClick={() => onMan(a.p.i)} />
            {rest.map((x, j) => (
              <button key={x.p.i} className={`fd-lead-row${x.s === F.team ? ' is-me' : ''}`} style={fkVars(x.s)} onClick={() => onMan(x.p.i)}>
                <i>{j + 2}</i><KLogo s={x.s} size={22} /><b>{x.p.n}</b><span>{x.v.toLocaleString('en-US')}</span>
              </button>
            ))}
          </section>
        )
      })}
    </>
  )
}

// ── The wire ─────────────────────────────────────────────────────────────────
const TAG_TONE = { INJURY: 'inj', RECORD: 'gold', CLINCHED: 'w', SIGNED: 'new', MVP: 'gold', 'SUPER BOWL': 'gold', RETIRED: 'ink', RELEASED: 'l', TRADE: 'new', STREAK: 'ink', MILESTONE: 'ink' }
function Wire({ F }) {
  const items = useMemo(() => wire(F, { n: 40 }), [F, F.wk, F.phase, F.stage]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return <div className="fd-none">NOTHING ON THE WIRE YET</div>
  return (
    <>
      <Chyron tone="ink" title="THE WIRE" sub={F.phase === 'season' ? `WEEK ${F.wk}` : F.phase === 'off' ? `${F.year + 1} OFFSEASON` : String(F.year)} />
      {items.map((x, i) => (
        <div key={i} className={`fd-wire${x.big ? ' is-big' : ''}${x.s === F.team ? ' is-me' : ''}`} style={{ ...fkVars(x.s), '--d': `${Math.min(i, 12) * 30}ms` }}>
          {x.s && <KLogo s={x.s} size={x.big ? 34 : 26} />}
          <span><Tag tone={TAG_TONE[x.tag] ?? 'ink'}>{x.tag}</Tag><b>{x.text}</b></span>
        </div>
      ))}
    </>
  )
}

// ── Scores ───────────────────────────────────────────────────────────────────
function Scores({ F }) {
  const last = F.phase === 'season' ? Math.max(0, F.wk - 1) : F.sched.weeks.length - 1
  const [wk, setWk] = useState(last)
  const games = F.sched.weeks[wk] ?? []
  const played = games.filter(g => g.hs != null)
  const byes = F.sched.weeks[wk] ? Object.keys(TEAM).filter(s => !games.some(g => g.h === s || g.a === s)) : []
  return (
    <>
      <div className="fd-wk">
        <button disabled={wk <= 0} onClick={() => { setWk(w => w - 1); sfx('tap') }} aria-label="Week before">‹</button>
        <b>WEEK {wk + 1}</b>
        <button disabled={wk >= last} onClick={() => { setWk(w => w + 1); sfx('tap') }} aria-label="Week after">›</button>
      </div>
      {!played.length && <div className="fd-none">NO GAMES PLAYED YET</div>}
      <div className="fd-scores">
        {played.map((g, i) => {
          const aw = g.as > g.hs, hw = g.hs > g.as, me = g.h === F.team || g.a === F.team
          return (
            <div key={i} className={`fd-game${me ? ' is-me' : ''}`} aria-label={scoreText(g)}>
              <span className={aw ? 'is-w' : 'is-l'} style={fkVars(g.a)}><KLogo s={g.a} size={24} /><b>{g.a}</b><strong>{g.as}</strong></span>
              <span className={hw ? 'is-w' : 'is-l'} style={fkVars(g.h)}><KLogo s={g.h} size={24} /><b>{g.h}</b><strong>{g.hs}</strong></span>
              <small>{g.ot ? 'F/OT' : 'FINAL'}{DIV_OF[g.h] === DIV_OF[g.a] ? ' · DIV' : ''}</small>
            </div>
          )
        })}
      </div>
      {byes.length > 0 && <div className="fd-hunt"><small>BYE</small>{byes.map(s => <span key={s}><KLogo s={s} size={20} /></span>)}</div>}
    </>
  )
}

// ── The bracket (the hub shows it in January) ────────────────────────────────
function Game({ F, g }) {
  const po = F.po
  const done = g.hs != null, hw = done && g.hs > g.as
  const seedOf = s => (g.c === 'SB' ? '' : po.seeds[g.c].indexOf(s) + 1)
  const side = (s, sc, won) => (
    <span className={`fd-br-side${done ? (won ? ' is-w' : ' is-l') : ''}${s === F.team ? ' is-me' : ''}`} style={fkVars(s)}>
      <i>{seedOf(s)}</i><Logo s={s} size={24} /><b>{s}</b><strong>{done ? sc : ''}</strong>
    </span>
  )
  return <div className="fd-br-game">{side(g.a, g.as, done && !hw)}{side(g.h, g.hs, hw)}</div>
}
export function Bracket({ F }) {
  const po = F.po
  if (!po) return null
  return (
    <section className="fd-bracket">
      {po.rounds.map((games, rd) => (
        <div key={rd} className={`fd-br-round${rd === po.rd && !po.champ ? ' is-now' : ''}`}>
          <Chyron tone={rd === 3 ? 'gold' : 'ink'} size="s" title={ROUNDS[rd]} />
          {rd === 3 ? games.map((g, i) => <Game key={i} F={F} g={g} />) : (
            <div className="fd-br-confs">
              {CONFS.map(c => <div key={c} className="fd-br-conf"><small>{c}</small>{games.filter(g => g.c === c).map((g, i) => <Game key={i} F={F} g={g} />)}</div>)}
            </div>
          )}
        </div>
      ))}
      {po.rd === 0 && !po.rounds[0].some(g => g.hs != null) && (
        <div className="fd-hunt"><small>BYES</small>{CONFS.map(c => <span key={c} className={po.seeds[c][0] === F.team ? 'is-me' : ''}><KLogo s={po.seeds[c][0]} size={22} />1 SEED</span>)}</div>
      )}
    </section>
  )
}
