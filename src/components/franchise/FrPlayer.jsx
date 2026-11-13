import { useMemo, useRef, useState } from 'react'
import { Panel, FrSheet, FrSheetHead, GradeRow, Steps, Switch, Confirm } from './frUi'
import { Act, Fact, Sub, up, plural, safe } from './frBits'
import { sfx, haptic } from '../../lib/juice'

// FRANCHISE: a player's sheet. His letter grades (and, for the GM's own man with points in hand, the button that
// raises each one), how he develops, his contract, his season and career, his mood and what drives him, and
// what the front office can do with him:
//   the GM's player   EXTEND (the last year of a deal) · TRADE BLOCK · SHOP HIM (the league's offers) ·
//                     INJURED RESERVE / ACTIVATE · RELEASE
//   another team's    BUILD A TRADE (LEAGUE · MARKET, with him in the offer)
//   a free agent      SIGN at his ask
// Every action is the engine's (lib/franchise API.md §3); a refusal comes back as the red line under the scorebug.
// Props: pid (null: closed) · act(fn) · say(text) (a plain line under the scorebug) · go(tab, jump)

const STAT_LABEL = { g: 'G', gs: 'GS', cmp: 'CMP', att: 'ATT', pct: 'PCT', yds: 'YDS', td: 'TD', int: 'INT', rtg: 'RTG', sk: 'SK', rushYds: 'RUSH', rushTD: 'R TD', ypc: 'AVG', rec: 'REC', recYds: 'REC YDS', recTD: 'REC TD', fum: 'FUM',
  tgt: 'TGT', ypr: 'AVG', long: 'LONG', sacksAllowed: 'SACKS ALW', pancakes: 'PANCAKES', tkl: 'TKL', sack: 'SACK', tfl: 'TFL', pd: 'PD', ff: 'FF', dTD: 'TD', fgm: 'FGM', fga: 'FGA', xpm: 'XPM', xpa: 'XPA', pts: 'PTS' }

function StatTable({ stat }) {
  const keys = Object.keys(stat ?? {}).filter(k => stat[k] != null)
  if (!keys.length) return null
  return <div className="fr-statgrid">{keys.map(k => <span key={k}><small>{STAT_LABEL[k] ?? k.toUpperCase()}</small><b>{typeof stat[k] === 'number' ? stat[k].toLocaleString('en-US') : stat[k]}</b></span>)}</div>
}
const has = stat => Object.values(stat ?? {}).some(v => v != null && v !== 0)

export function PlayerSheet({ FR, F, pid, onClose, act = null, say = null, go = null }) {
  const card = useMemo(() => (pid == null ? null : safe(() => FR.playerCard(F, pid))), [FR, F, pid])
  const kept = useRef(null)   // (the sheet keeps the man on it while it slides shut)
  if (card) kept.current = card
  const c = card ?? kept.current
  const [ask, setAsk] = useState(null)   // 'release' | 'extend' | 'sign'
  const con = c?.contract
  const mine = !!c?.mine && !!act, fa = !!c && !c.team && !!act
  const open = safe(() => FR.tradeBlock(F).open, true)
  const money = v => (v ? FR.moneyText(v) : '$0')
  const run = (fn, close = false) => { const next = act(fn); if (next?.flash?.ok && next.flash.msg) say?.(next.flash.msg); if (close && next?.flash?.ok !== false) onClose(); return next }
  const pts = c?.pts ?? 0
  // (a free agent in season signs at the street's ask, the one the free-agent list shows)
  const street = useMemo(() => (card && !card.team ? safe(() => FR.freeAgents(F, { n: 400 }).find(r => r.id === card.id)?.ask) : null), [FR, F, card])
  const term = street ?? con?.extAsk ?? con?.ask
  const inSeason = F.phase !== 'offseason'
  return (
    <>
      <FrSheet open={!!card} onClose={onClose} label={c?.name}
        head={c && <FrSheetHead name={c.name} photo={FR.photoUrl(c.photo)} big={c.ovr} line={[c.at ?? c.slot, c.num != null ? `#${c.num}` : null, `AGE ${c.age}`, c.team ?? 'FREE AGENT'].filter(Boolean).join(' · ')} />}>
        {c && <>
          {(c.inj || c.arch || c.flags?.wantsOut || c.flags?.hold || c.onBlock) && (
            <Panel>
              {c.arch && <div className="fr-kv"><span>{c.built ? `BUILT BY ${up(F.gm?.name ?? 'THE GM')}` : 'TYPE'}</span><b className="is-text">{c.arch}</b></div>}
              {c.inj && <div className="fr-kv"><span>{c.inj.status}</span><b className="is-text fr-t-red">{c.inj.what}{c.inj.wk > 0 ? ` · ${plural(c.inj.wk, 'week')}` : ''}</b></div>}
              {c.flags?.hold && <div className="fr-kv"><span>HOLDING OUT</span><b className="is-text fr-t-red">Wants a new deal</b></div>}
              {c.flags?.wantsOut && <div className="fr-kv"><span>TRADE REQUEST</span><b className="is-text fr-t-red">He has asked out</b></div>}
              {c.onBlock && <div className="fr-kv"><span>TRADE BLOCK</span><b className="is-text">On the block</b></div>}
            </Panel>
          )}
          {c.traits?.length > 0 && (
            <Panel title="Ratings" meta={mine && pts > 0 ? `${plural(pts, 'POINT')} TO SPEND` : c.grade}>
              {mine && pts > 0
                ? c.traits.map(t => (
                  <div key={t.key} className="fr-trait">
                    <GradeRow label={up(t.label)} grade={t.grade} v={t.val} />
                    <button disabled={t.cost == null || t.cost > pts} aria-label={t.cost == null ? `${t.label} is as high as it goes` : `Raise ${t.label} for ${plural(t.cost, 'point')}`}
                      onClick={() => { sfx('tap'); haptic('medium'); act(f => FR.upgradeTrait(f, c.id, t.key)) }}>{t.cost == null ? 'MAX' : <><b>+1</b>{t.cost} PT</>}</button>
                  </div>
                ))
                : c.traits.map(t => <GradeRow key={t.key} label={<>{up(t.label)}{t.fading && <em className="fr-fade">FADING</em>}</>} grade={t.grade} v={t.val} />)}
              {mine && pts > 0 && <Act label="Let the staff spend them" note="BEST VALUE FIRST" onClick={() => run(f => FR.autoUpgrade(f, c.id))} />}
            </Panel>
          )}
          <Panel title="Development" meta={c.devName ?? 'NOT KNOWN YET'}>
            {c.devText && <p className="fr-note">{c.devText}</p>}
            {c.team && <div className="fr-kv"><span>XP</span><b>{(c.xp ?? 0).toLocaleString('en-US')}</b></div>}
            {c.team && <div className="fr-kv"><span>UPGRADE POINTS</span><b>{pts}</b></div>}
            {c.team && <div className="fr-kv"><span>WEAR</span><b className="is-text">{c.wear >= 60 ? 'Heavy' : c.wear >= 30 ? 'Building' : 'Fresh'} <Steps value={c.wear || 1} low={-1} label={`Wear ${c.wear} of 100`} /></b></div>}
          </Panel>
          <Panel title="Contract" meta={!c.team ? 'FREE AGENT' : c.rookie ? 'ROOKIE DEAL' : con?.tag ? 'FRANCHISE TAG' : null}>
            {c.team ? <>
              <div className="fr-kv"><span>SALARY</span><b>{money(con?.salary ?? c.salary)}</b></div>
              <div className="fr-kv"><span>YEARS LEFT</span><b>{con?.yrs ?? c.yrs ?? 0}</b></div>
              <div className="fr-kv"><span>GUARANTEED LEFT</span><b>{money(con?.guar ?? c.guar)}</b></div>
              {con?.option && <div className="fr-kv"><span>FIFTH-YEAR OPTION</span><b className="is-text">{con.option === 'exercised' ? 'Exercised' : 'Available'}</b></div>}
              {con?.extension && <div className="fr-kv"><span>EXTENSION SIGNED</span><b className="is-text">{plural(con.extension.years, 'year')} · {money(con.extension.perYear)} a year</b></div>}
              {con?.cut && (con.cut.dead > 0 || con.cut.saves > 0) && <div className="fr-kv"><span>IF RELEASED</span><b className="is-text">{money(con.cut.dead)} dead · {money(con.cut.saves)} saved</b></div>}
            </> : null}
            {term && !con?.extension && <div className="fr-kv"><span>{c.team ? 'HIS ASK' : 'ASKING'}</span><b className="is-text">{plural(term.years, 'year')} · {money(term.perYear)} a year</b></div>}
          </Panel>
          <Panel title={`${F.year} season`} meta={has(c.stats?.season) ? null : 'NO GAMES YET'}>
            {has(c.stats?.season) && <StatTable stat={c.stats.season} />}
          </Panel>
          {c.stats?.byYear?.length > 0 && <Panel title="Career"><StatTable stat={c.stats.career} /></Panel>}
          {c.awards?.length > 0 && <Panel title="Honors">{c.awards.map((a, i) => <div key={i} className="fr-kv"><span>{a.year}</span><b className="is-text">{a.name}</b></div>)}</Panel>}
          <Panel title="Mood" meta={up(c.moodWord)}>
            <div className="fr-kv"><span>MORALE</span><b><Steps value={c.mood} label={`Morale ${Math.round(c.mood)} of 100`} /></b></div>
            {(c.drives ?? []).map(d => <Fact key={d} label={d}>{FR.DRIVE_TEXT?.[d] ?? ''}</Fact>)}
            {(c.moodFactors ?? []).length > 0 && <Sub>WHY</Sub>}
            {(c.moodFactors ?? []).map((m, i) => <div key={i} className="fr-kv"><span className="is-wrap">{up(m.text)}</span><b className={m.d < 0 ? 'fr-t-red' : undefined}>{m.d > 0 ? `+${m.d}` : `−${-m.d}`}</b></div>)}
          </Panel>
          {(c.college || c.bodyText || c.draft) && (
            <Panel title="Bio">
              {c.bodyText ? <div className="fr-kv"><span>SIZE</span><b className="is-text">{c.bodyText}</b></div> : null}
              {c.college && <div className="fr-kv"><span>COLLEGE</span><b className="is-text">{c.college}</b></div>}
              {c.draft && <div className="fr-kv"><span>DRAFT</span><b className="is-text">{c.draft}</b></div>}
              <div className="fr-kv"><span>SEASONS</span><b>{c.exp === 0 ? 'ROOKIE' : c.exp}</b></div>
            </Panel>
          )}
          {mine && (
            <Panel title="Front office">
              {inSeason && con?.yrs <= 1 && !con?.extension && term && <Act label="Offer an extension" note={`${plural(term.years, 'YR')} · ${money(term.perYear)}`} onClick={() => setAsk('extend')} />}
              <Switch label="On the trade block" note="OTHER TEAMS KNOW HE CAN BE HAD" on={!!c.onBlock} onChange={v => act(f => FR.setBlock(f, c.id, v))} />
              <Act label="Shop him" note={open ? 'WHAT THE LEAGUE WOULD GIVE' : 'DEADLINE PASSED'} disabled={!open}
                onClick={() => { const next = run(f => FR.shopPlayer(f, c.id)); if (next?.flash?.offers?.length) { onClose(); go?.('league', { view: 'market', sub: 'offers' }) } }} />
              {c.inj && c.inj.wk > 0 && c.inj.status !== 'IR' && <Act label="Move to injured reserve" note="OUT AT LEAST FOUR GAMES" onClick={() => run(f => FR.moveToIR(f, c.id))} />}
              {c.inj?.status === 'IR' && <Act label="Activate from injured reserve" note={c.inj.wk > 0 ? `RETURNS ON HIS OWN IN ${plural(c.inj.wk, 'WEEK')}` : 'READY'} disabled={c.inj.wk > 0} onClick={() => run(f => FR.activate(f, c.id))} />}
              <Act danger label="Release" note={con?.cut ? `${money(con.cut.dead)} DEAD` : null} onClick={() => setAsk('release')} />
            </Panel>
          )}
          {!c.mine && c.team && act && go && (
            <Panel title="Front office">
              <Act label="Build a trade for him" note={open ? up(FR.teamRef(c.team)?.nick ?? c.team) : 'DEADLINE PASSED'} disabled={!open} onClick={() => { onClose(); go('league', { view: 'market', sub: 'build', team: c.team, want: c.id }) }} />
            </Panel>
          )}
          {fa && term && (
            <Panel title="Front office">
              <Act label="Sign him" note={`${plural(term.years, 'YR')} · ${money(term.perYear)}`} onClick={() => setAsk('sign')} />
            </Panel>
          )}
        </>}
      </FrSheet>
      <Confirm open={ask === 'release' && !!c} danger title={`Release ${c?.name}?`} yes="RELEASE" no="KEEP HIM" onNo={() => setAsk(null)}
        body={con?.cut ? `${money(con.cut.dead)} stays on the cap as dead money; ${money(con.cut.saves)} comes off it. He goes to the free-agent list.` : 'He goes to the free-agent list.'}
        onYes={() => { setAsk(null); run(f => FR.releasePlayer(f, c.id), true) }} />
      <Confirm open={ask === 'extend' && !!c} title={`Extend ${c?.name}?`} yes="SIGN HIM" no="NOT NOW" onNo={() => setAsk(null)}
        body={term ? `He is asking for about ${money(term.perYear)} a year over ${plural(term.years, 'year')}. The new deal starts next season.` : ''}
        onYes={() => { setAsk(null); run(f => FR.extendPlayer(f, c.id)) }} />
      <Confirm open={ask === 'sign' && !!c} title={`Sign ${c?.name}?`} yes="SIGN HIM" no="NOT NOW" onNo={() => setAsk(null)}
        body={term ? `${plural(term.years, 'year')} at ${money(term.perYear)} a year.` : ''}
        onYes={() => { setAsk(null); run(f => FR.signFreeAgent(f, c.id), true) }} />
    </>
  )
}
