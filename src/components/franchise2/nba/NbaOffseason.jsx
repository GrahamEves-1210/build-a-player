import { useEffect, useState } from 'react'
import {
  TEAM, STEPS, STEP_NAME, nextStep, manOf, teamOfMan, photoOf, AWARD_FULL, seasonText, nick, FINISH_TEXT, onClock, available, makePick, draftTo,
  rangeOf, scout, starProspect, resignMine, signFA, faNext, campCheck, CAP_SIM, ROSTER_MAX, draftOrder, addNews, teamOptions, setOption, answerSheet,
} from '../../../lib/franchise2/nba'
import { sfx, haptic } from '../../../lib/juice'
import { fkVars, KLogo, Chyron, LowerThird, Go, Stamp, Tag, Flip, ActionBar } from '../kit'
import { CapBar, dealText } from './NbaTeam'
import { money } from './NbaHub'

// THE SUMMER, a stop at a time: awards, the lottery, the draft, re-signing, free agency, camp
export default function NbaOffseason({ F, act, owner }) {
  const st = F.off?.step ?? 'awards'
  const at = STEPS.indexOf(st)
  const go = () => { act(X => { nextStep(X) }); sfx('whistle'); haptic('light'); window.scrollTo?.(0, 0) }
  return (
    <div className="nb-off">
      <ol className="nb-steps">{STEPS.map((k, i) => <li key={k} className={i < at ? 'is-done' : i === at ? 'is-on' : ''}>{STEP_NAME[k]}</li>)}</ol>
      {st === 'awards' && <Awards F={F} act={act} go={go} />}
      {st === 'lottery' && <Lottery F={F} go={go} />}
      {st === 'draft' && <Draft F={F} act={act} go={go} />}
      {st === 'resign' && <Resign F={F} act={act} go={go} />}
      {st === 'fa' && <FreeAgency F={F} act={act} go={go} />}
      {st === 'camp' && <Camp F={F} act={act} go={go} owner={owner} />}
    </div>
  )
}

function Awards({ F, act, go }) {
  const h = F.hist[F.hist.length - 1]
  const A = h?.aw ?? {}
  return (
    <section className="nb-aw">
      <Chyron team={F.team} tag={seasonText(F.year)} title={`${nick(F.team)} ${h.w}-${h.l}`} sub={(FINISH_TEXT[h.finish] ?? '').toUpperCase()} />
      <Chyron tone="ink" size="s" title="Awards" />
      {['MVP', 'FMVP', 'DPOY', 'ROY', '6MOY', 'MIP'].filter(k => A[k]).map((k, i) => {
        const p = manOf(F, A[k].i)
        return <LowerThird key={k} name={A[k].n} pos={p?.p} num={p?.num} ovr={p?.o} photo={p?.h ? photoOf(A[k].n) : null} team={A[k].s} size="s" line={AWARD_FULL[k].toUpperCase()} delay={i * 80} />
      })}
      {(A.ALL ?? []).map((t, k) => (
        <div key={k} className="nb-alln"><small>ALL-NBA {['FIRST', 'SECOND', 'THIRD'][k]} TEAM</small><p>{t.map(x => `${x.n} (${TEAM[x.s]?.short ?? ''})`).join(', ')}</p></div>
      ))}
      <TeamOptions F={F} act={act} />
      <ActionBar><Go onClick={go}>The draft lottery</Go></ActionBar>
    </section>
  )
}

// the lottery, read out the way the league does it: 14 to 1, one card at a time
function Lottery({ F, go }) {
  const L = F.lot
  const [k, setK] = useState(0)   // cards turned (from 14 down)
  const list = L.lottery.slice().reverse()
  useEffect(() => {
    if (k >= list.length) return
    const t = setTimeout(() => setK(k + 1), k < 10 ? 260 : 900)
    return () => clearTimeout(t)
  }, [k, list.length])
  const mine = L.lottery.find(x => x.s === F.team)
  return (
    <section className="nb-lot">
      <Chyron team={F.team} title={`${L.y} Draft Lottery`} sub={mine ? `${nick(F.team).toUpperCase()}: ${mine.odds.toFixed(1)}% FOR NO. 1` : 'NOT IN THE LOTTERY'} />
      <div className="nb-lot-list">
        {list.map((x, i) => (
          <Flip key={x.s} open={i < k} className="nb-lot-card" back={<span className="nb-lot-back">{x.to}</span>}
            front={<span className={`nb-lot-face${x.s === F.team ? ' is-me' : ''}`} style={fkVars(x.s)}><i>{x.to}</i><KLogo s={x.s} size={30} /><b>{TEAM[x.s].nick}</b><small>{x.to < x.from ? `UP FROM ${x.from}` : x.to > x.from ? `DOWN FROM ${x.from}` : `${x.odds.toFixed(1)}%`}</small></span>} />
        ))}
      </div>
      {k < list.length ? <button type="button" className="fh-textbtn" onClick={() => setK(list.length)}>Show all</button> : <ActionBar><Go onClick={go}>Draft night</Go></ActionBar>}
    </section>
  )
}

const rows = (F, ids) => ids.map(i => (F.dc ?? []).find(p => p.i === i)).filter(Boolean)
function Draft({ F, act, go }) {
  const pk = onClock(F)
  const [show, setShow] = useState('board')
  const mine = pk?.t === F.team
  const made = F.dn?.made ?? []
  const simTo = () => { act(X => { draftTo(X) }); sfx('flip') }
  const pick = id => { act(X => { const r = makePick(X, id); if (r) addNews(X, { k: 'draft', tag: 'DRAFT', s: X.team, text: `With the No. ${r.pick.n} pick, the ${nick(X.team)} select ${r.man.n}, ${r.man.p}, ${r.man.c}` }) }); sfx('claim'); haptic('medium') }
  const mineLeft = draftOrder(F).slice(F.dn?.at ?? 0).filter(p => p.t === F.team)
  return (
    <section className="nb-draft">
      <Chyron team={pk?.t ?? F.team} tag={pk ? `NO. ${pk.n}` : 'DONE'} title={pk ? `${TEAM[pk.t].nick} on the clock` : 'The draft is over'} sub={pk ? `ROUND ${pk.r}${pk.o !== pk.t ? ` · FROM ${TEAM[pk.o].short}` : ''} · ${mineLeft.length ? `${nick(F.team).toUpperCase()} PICK ${mineLeft.map(p => p.n).join(', ')}` : 'NO PICKS LEFT'}` : `${made.length} PICKS`} />
      {pk && !mine && <div className="fh-go"><Go onClick={simTo}>{mineLeft.length ? `Sim to pick ${mineLeft[0].n}` : 'Sim the rest'}</Go></div>}
      {pk && mine && <div className="nb-mine"><p className="nb-gd-tail">{(F.sp ?? 0) > 0 ? `${F.sp} scouting reports left` : 'Make the pick'}</p><button type="button" className="fh-textbtn" onClick={() => pick(null)}>Best available</button></div>}
      <div className="nb-by">
        <button type="button" className={show === 'board' ? 'is-on' : ''} onClick={() => setShow('board')}>Big board</button>
        <button type="button" className={show === 'mine' ? 'is-on' : ''} onClick={() => setShow('mine')}>Starred</button>
        <button type="button" className={show === 'made' ? 'is-on' : ''} onClick={() => setShow('made')}>Picks made</button>
      </div>
      {show !== 'made' && (
        <div className="nb-board">
          {(show === 'mine' ? rows(F, F.board ?? []).filter(p => !p.dt) : available(F)).slice(0, 40).map(p => <Prospect key={p.i} F={F} p={p} act={act} onPick={mine ? () => pick(p.i) : null} />)}
        </div>
      )}
      {show === 'made' && (
        <ol className="nb-made">{made.slice().reverse().map(m => { const p = (F.dc ?? []).find(x => x.i === m.i); return <li key={m.n} className={m.t === F.team ? 'is-me' : ''} style={fkVars(m.t)}><i>{m.n}</i><KLogo s={m.t} size={22} /><b>{p?.n}</b><small>{p?.p} · {p?.c}</small>{p && m.t === F.team && p.sc >= 2 && <Stamp kind={p.tg === 'GEM' ? 'gem' : p.tg === 'BUST' ? 'bust' : 'solid'} quiet>{p.tg}</Stamp>}</li> })}</ol>
      )}
      {!pk && <ActionBar><Go onClick={go}>Re-sign your players</Go></ActionBar>}
    </section>
  )
}
export function Prospect({ F, p, act, onPick }) {
  const R = rangeOf(p)
  const star = (F.board ?? []).includes(p.i)
  return (
    <div className="nb-pros">
      <span className="nb-pros-rk">{p.rank}</span>
      <span className="nb-pros-txt"><b>{p.n}</b><small>{p.p} · {p.ag} · {Math.floor(p.ht / 12)}'{p.ht % 12}" · {p.c}</small></span>
      <span className="nb-pros-gr"><b>{R.text}</b><small>{p.sc >= 2 ? p.tg : p.sc === 1 ? 'SCOUTED' : 'CEILING'}</small></span>
      <span className="nb-pros-acts">
        <button type="button" aria-pressed={star} className={star ? 'is-on' : ''} onClick={() => { act(X => { starProspect(X, p.i) }); sfx('tap') }} aria-label="Star">★</button>
        {p.sc < 2 && (F.sp ?? 0) > 0 && <button type="button" onClick={() => { act(X => { scout(X, p.i) }); sfx('flip') }}>Scout</button>}
        {onPick && <button type="button" className="is-go" onClick={onPick}>Pick</button>}
      </span>
    </div>
  )
}

function Resign({ F, act, go }) {
  const ids = F.off?.mine ?? []
  const [why, setWhy] = useState(null)
  const men = ids.map(i => (F.fa ?? []).find(p => p.i === i)).filter(Boolean)
  return (
    <section className="nb-resign">
      <CapBar F={F} />
      <Chyron team={F.team} title="Re-sign" sub={men.length ? `${men.length} ${men.length === 1 ? 'DEAL' : 'DEALS'} UP` : 'NOBODY LEFT TO SIGN'} />
      {men.map(p => {
        const d = CAP_SIM.resignOffer(F, p)
        return (
          <div key={p.i} className="nb-fa-row">
            <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={p.h ? photoOf(p.n) : null} team={F.team} size="s" line={`AGE ${p.ag}${p.rfa ? ' · RESTRICTED' : ''} · ASKS ${d ? `${money(d.$)} × ${d.y}` : 'TO TEST THE MARKET'}`} />
            <span className="nb-fa-acts">
              <button type="button" className="is-go" disabled={!d} onClick={() => { const r = act(X => resignMine(X, p.i, true)); setWhy(r?.ok ? null : r?.why ?? null); sfx(r?.ok ? 'claim' : 'deny') }}>Keep</button>
              <button type="button" onClick={() => { act(X => { resignMine(X, p.i, false) }); sfx('tap') }}>Let go</button>
            </span>
          </div>
        )
      })}
      {why && <p className="nb-why">{why}</p>}
      <ActionBar><Go onClick={go}>Free agency</Go></ActionBar>
    </section>
  )
}

function FreeAgency({ F, act, go }) {
  const [why, setWhy] = useState(null)
  const sheets = (F.rfq ?? []).map(q => ({ q, p: (F.fa ?? []).find(x => x.i === q.i) })).filter(x => x.p)
  const pool = (F.fa ?? []).slice().sort((a, b) => b.o - a.o).slice(0, 30)
  const day = F.off?.day ?? 0
  return (
    <section className="nb-fa">
      <CapBar F={F} />
      <Chyron team={F.team} tag={`DAY ${day + 1}`} title="Free agency" sub={`${(F.fa ?? []).length} ON THE MARKET · ${F.teams[F.team].r.filter(p => !p.tw).length} OF ${ROSTER_MAX} SIGNED`} />
      {sheets.map(({ q, p }) => (
        <div key={p.i} className="nb-counter">
          <p>{`${p.n} signed an offer sheet with the ${TEAM[q.s].nick}: ${q.d.y} years, ${money(q.d.$)} a year. Match it to keep him.`}</p>
          <span className="nb-fa-acts"><button type="button" className="is-go" onClick={() => { act(X => { answerSheet(X, p.i, true) }); sfx('claim') }}>Match</button><button type="button" onClick={() => { act(X => { answerSheet(X, p.i, false) }); sfx('tap') }}>Let him go</button></span>
        </div>
      ))}
      {pool.map(p => {
        const d = CAP_SIM.askOf(F, p)
        const ok = CAP_SIM.canSign(F, F.team, p, d)
        return (
          <div key={p.i} className="nb-fa-row">
            <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={p.h ? photoOf(p.n) : null} team={p.was ?? F.team} size="s" line={`AGE ${p.ag} · ASKS ${money(d.$)} × ${d.y}${ok.ok && ok.via ? ` · ${VIA[ok.via] ?? ''}` : ''}`} />
            <span className="nb-fa-acts"><button type="button" className="is-go" disabled={!ok.ok} title={ok.why} onClick={() => { const r = act(X => signFA(X, p.i)); setWhy(r?.ok ? null : r?.why ?? null); sfx(r?.ok ? 'claim' : 'deny') }}>{ok.ok ? 'Sign' : ok.why ?? 'No room'}</button></span>
          </div>
        )
      })}
      {why && <p className="nb-why">{why}</p>}
      <div className="fh-go">
        {day < CAP_SIM.FA_DAYS && <button type="button" className="fh-textbtn" onClick={() => { act(X => { faNext(X) }); sfx('flip') }}>Next day</button>}
        <ActionBar><Go onClick={go}>To training camp</Go></ActionBar>
      </div>
    </section>
  )
}
const VIA = { room: 'CAP ROOM', mle: 'MID-LEVEL', tmle: 'TAXPAYER MLE', bae: 'BI-ANNUAL', min: 'MINIMUM', bird: 'BIRD RIGHTS', rookie: 'ROOKIE SCALE' }

function Camp({ F, act, go, owner }) {
  const t = F.teams[F.team]
  const chk = campCheck(F)
  const std = t.r.filter(p => !p.tw).sort((a, b) => b.o - a.o)
  const tw = t.r.filter(p => p.tw)
  const [sure, setSure] = useState(null)
  return (
    <section className="nb-camp">
      <Chyron team={F.team} title="Training camp" sub={`${std.length} STANDARD · ${tw.length} TWO-WAY · MAX ${ROSTER_MAX} AND 3`} />
      {!chk.ok && <p className="nb-why">{chk.why}</p>}
      {std.map(p => (
        <div key={p.i} className="nb-fa-row">
          <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={p.h ? photoOf(p.n) : null} team={F.team} size="s" mine={p.b != null ? owner : null} line={`AGE ${p.ag} · ${dealText(p)}${p.rk === F.year + 1 ? ' · ROOKIE' : ''}`} />
          <span className="nb-fa-acts">
            {sure === p.i
              ? <><button type="button" onClick={() => setSure(null)}>Keep</button><button type="button" className="is-danger" onClick={() => { act(X => { CAP_SIM.cutMan(X, X.team, p.i); addNews(X, { k: 'cut', tag: 'WAIVED', s: X.team, text: `The ${nick(X.team)} have waived ${p.n}` }) }); setSure(null); sfx('deny') }}>Waive</button></>
              : <button type="button" onClick={() => setSure(p.i)}>Waive</button>}
          </span>
        </div>
      ))}
      {tw.length > 0 && <Chyron tone="ink" size="s" title="Two-way" />}
      {tw.map(p => <LowerThird key={p.i} name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={p.h ? photoOf(p.n) : null} team={F.team} size="s" line={`AGE ${p.ag} · TWO-WAY`} />)}
      <ActionBar><Go disabled={!chk.ok} onClick={go}>{`Start the ${seasonText(F.year + 1)} season`}</Go></ActionBar>
    </section>
  )
}

// team options on next season: the GM picks each up or declines it (any he leaves, the front office decides)
function TeamOptions({ F, act }) {
  const due = teamOptions(F)
  if (!due.length) return null
  return (
    <>
      <Chyron tone="ink" size="s" title="Team options" sub={`${F.year + 1}-${String((F.year + 2) % 100).padStart(2, '0')} SEASON`} />
      {due.map(({ p }) => (
        <div key={p.i} className="nb-fa-row">
          <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={p.h ? photoOf(p.n) : null} team={F.team} size="s" line={`AGE ${p.ag} · ${money(p.sc?.[0] ?? p.$)} NEXT SEASON${p.optd === 1 ? ' · PICKED UP' : p.optd === 0 ? ' · DECLINED' : ''}`} />
          <span className="nb-fa-acts">
            <button type="button" className={p.optd === 1 ? 'is-go' : ''} onClick={() => { act(X => { setOption(X, p.i, true) }); sfx('tap') }}>Pick it up</button>
            <button type="button" className={p.optd === 0 ? 'is-go' : ''} onClick={() => { act(X => { setOption(X, p.i, false) }); sfx('tap') }}>Decline</button>
          </span>
        </div>
      ))}
    </>
  )
}
