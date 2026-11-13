import { useEffect, useMemo, useState } from 'react'
import { Panel, FrTable, FrSheet, Seg, Logo } from './frUi'
import { Sub, TeamCell, tap, up, plural, shortName, safe } from './frBits'
import { sfx, haptic } from '../../lib/juice'

// FRANCHISE: LEAGUE · MARKET. Everything that moves a player between clubs during the season.
//   OFFERS        what other GMs have put on the table: ACCEPT, DECLINE, or COUNTER (the offer goes into the
//                 builder the other way round)
//   BLOCK         the GM's own men on the block, and who the league is selling (each club's state beside him)
//   BUILD         a trade: pick the club, add players and picks both ways. The other GM answers as it is built
//                 (FR.tradeVerdict: his honest read, what each side's pile is worth to him, and why not when it
//                 is no); ADD WHAT THEY ASK FOR takes his counter; PROPOSE sends it (FR.proposeTrade)
//   FREE AGENTS   the street: a row opens the player, SIGN is on his sheet (FR.signFreeAgent at his ask)
// The deadline is the engine's (tradeBlock().open / deadlineWeek): after it the builder is read-only.
// `jump`: { sub, team, want } (a player's BUILD A TRADE, a club's TALK TRADE, SHOP HIM's offers).

const EMPTY = { players: [], picks: [] }
const POS = [['all', 'ALL'], ['QB', 'QB'], ['RB', 'RB'], ['WR', 'WR'], ['TE', 'TE'], ['OL', 'OL'], ['DL', 'DL'], ['LB', 'LB'], ['DB', 'DB'], ['K', 'K']]
const GROUP = { LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL', EDGE: 'DL', DT: 'DL', CB: 'DB', S: 'DB' }
const STATE_SHORT = { contend: 'CONTENDING', retool: 'RETOOLING', rebuild: 'REBUILDING' }

// a leg of a deal as lines: "EDGE Maxx Crosby", "Round 2, the next draft"
function useAssets(FR, F, team) { return useMemo(() => (team ? safe(() => FR.tradeAssets(F, team), EMPTY) : EMPTY), [FR, F, team]) }
const lines = (assets, leg) => [
  ...(leg?.players ?? []).map(id => assets.players.find(p => p.id === id)).filter(Boolean).map(p => ({ k: `p${p.id}`, pos: p.slot, text: p.name, sub: `AGE ${p.age} · ${p.ovr} OVR`, value: p.value, id: p.id })),
  ...(leg?.picks ?? []).map(k => assets.picks.find(p => p.key === k)).filter(Boolean).map(p => ({ k: p.key, pos: 'PICK', text: p.text, sub: null, value: p.value, key: p.key })),
]

function Offer({ FR, F, o, act, say, onCounter }) {
  const theirs = useAssets(FR, F, o.from), ours = useAssets(FR, F, o.to)
  const get = lines(theirs, o.give), give = lines(ours, o.get)
  const t = o.fromTeam ?? FR.teamRef(o.from)
  const answer = yes => { sfx(yes ? 'send' : 'back'); haptic('medium'); const n = act(f => FR.answerOffer(f, o.id, yes)); if (n?.flash?.ok && n.flash.msg) say(n.flash.msg) }
  return (
    <div className="fr-offer">
      <div className="fr-offer-top"><Logo team={t.short} size={26} /><b>{up(t.name)}</b></div>
      <div className="fr-offer-legs">
        <div><small>THE {up(FR.teamRef(o.to)?.nick)} GET</small>{get.map(x => <p key={x.k}>{x.pos !== 'PICK' ? `${x.pos} ` : ''}{x.text}</p>)}</div>
        <div><small>THE {up(t.nick)} GET</small>{give.map(x => <p key={x.k}>{x.pos !== 'PICK' ? `${x.pos} ` : ''}{x.text}</p>)}</div>
      </div>
      <div className="fr-offer-btns">
        <button className="fr-btn fr-btn--sm fr-btn--line" onClick={() => answer(false)}>DECLINE</button>
        <button className="fr-btn fr-btn--sm fr-btn--line" onClick={() => { tap(); onCounter(o) }}>COUNTER</button>
        <button className="fr-btn fr-btn--sm" onClick={() => answer(true)}>ACCEPT</button>
      </div>
    </div>
  )
}

// what a club has to deal: its players (by value) and its picks; a tap puts one in the offer or takes it out
function AssetSheet({ FR, F, team, leg, onToggle, onClose }) {
  const assets = useAssets(FR, F, team)
  const [tab, setTab] = useState('players')
  const t = team ? FR.teamRef(team) : null
  return (
    <FrSheet open={!!team} onClose={onClose} label="Add to the offer"
      head={t && <span className="fr-clubhead"><Logo team={t.short} size={52} /><span className="fr-sheet-who"><b>{up(t.nick)}</b><small>{plural((leg?.players.length ?? 0) + (leg?.picks.length ?? 0), 'PIECE')} IN THE OFFER</small></span></span>}
      foot={<button className="fr-btn" onClick={() => { tap(); onClose() }}>DONE</button>}>
      <Panel>
        <Seg label="Assets" options={[['players', 'PLAYERS'], ['picks', 'PICKS']]} value={tab} onChange={setTab} />
        {tab === 'players' && assets.players.map(p => {
          const on = leg.players.includes(p.id)
          return (
            <button key={p.id} className={`fr-row fr-pick${on ? ' is-on' : ''}`} role="checkbox" aria-checked={on} onClick={() => { tap(); onToggle('players', p.id) }}>
              <span className="fr-pick-box" aria-hidden="true" />
              <span className="fr-t-pos">{p.at ?? p.slot}</span>
              <span className="fr-row-main">{p.name}<small>AGE {p.age} · {FR.moneyText(p.salary)} · {plural(p.yrs, 'YR')}{p.flags?.block ? ' · ON THE BLOCK' : ''}</small></span>
              <b className="fr-t-num">{p.ovr}</b>
            </button>
          )
        })}
        {tab === 'picks' && assets.picks.map(p => {
          const on = leg.picks.includes(p.key)
          return (
            <button key={p.key} className={`fr-row fr-pick${on ? ' is-on' : ''}`} role="checkbox" aria-checked={on} onClick={() => { tap(); onToggle('picks', p.key) }}>
              <span className="fr-pick-box" aria-hidden="true" />
              <span className="fr-row-main">{p.text}</span>
            </button>
          )
        })}
        {tab === 'picks' && !assets.picks.length && <div className="fr-empty">NO PICKS TO DEAL</div>}
      </Panel>
    </FrSheet>
  )
}

function ClubPicker({ FR, F, open, value, onPick, onClose }) {
  const teams = useMemo(() => (open ? FR.teams(F).filter(t => !t.user).sort((a, b) => a.name.localeCompare(b.name)) : []), [FR, F, open])
  return (
    <FrSheet open={open} onClose={onClose} label="Trade partner" head={<span className="fr-sheet-who"><b>TRADE PARTNER</b><small>31 CLUBS</small></span>}>
      <Panel>
        {teams.map(t => (
          <button key={t.short} className={`fr-row fr-pick${value === t.short ? ' is-on' : ''}`} onClick={() => { tap(); onPick(t.short) }}>
            <Logo team={t.short} size={26} />
            <span className="fr-row-main">{t.name}<small>{t.record} · {STATE_SHORT[t.state] ?? ''}</small></span>
            <span className="fr-chev" />
          </button>
        ))}
      </Panel>
    </FrSheet>
  )
}

function Builder({ FR, F, act, say, deal, setDeal, open, onPlayer }) {
  const [adding, setAdding] = useState(null)   // 'give' | 'get'
  const [picking, setPicking] = useState(false)
  const us = FR.teamRef(F.team), them = deal.team ? FR.teamRef(deal.team) : null
  const mine = useAssets(FR, F, F.team), theirs = useAssets(FR, F, deal.team)
  const give = lines(mine, deal.give), get = lines(theirs, deal.get)
  const offer = useMemo(() => ({ from: F.team, to: deal.team, give: deal.give, get: deal.get }), [F.team, deal])
  const any = give.length + get.length > 0
  const v = useMemo(() => (deal.team && any ? safe(() => FR.tradeVerdict(F, offer)) : null), [FR, F, offer, deal.team, any])
  const state = useMemo(() => (deal.team ? safe(() => FR.teams(F).find(t => t.short === deal.team)?.state) : null), [FR, F, deal.team])
  const toggle = side => (kind, id) => setDeal(d => ({ ...d, [side]: { ...d[side], [kind]: d[side][kind].includes(id) ? d[side][kind].filter(x => x !== id) : [...d[side][kind], id] } }))
  const drop = (side, x) => setDeal(d => ({ ...d, [side]: { players: d[side].players.filter(id => id !== x.id), picks: d[side].picks.filter(k => k !== x.key) } }))
  const propose = () => {
    sfx('send'); haptic('medium')
    const n = act(f => FR.proposeTrade(f, offer))
    if (n?.flash?.accepted) { say(n.flash.answer ?? 'The trade is done.'); setDeal(d => ({ team: d.team, give: EMPTY, get: EMPTY })) }
  }
  const max = Math.max(1, v?.give ?? 0, v?.get ?? 0)
  const leg = (side, title, list, team) => (
    <>
      <Sub action={<button disabled={!open} onClick={() => { tap(); setAdding(side) }}>ADD</button>}>{title}</Sub>
      {list.map(x => (
        <div key={x.k} className="fr-asset">
          <span className="fr-t-pos">{x.pos}</span>
          <span className="fr-asset-main" onClick={x.id != null ? () => onPlayer(x.id) : undefined}>{x.text}{x.sub && <small>{x.sub}</small>}</span>
          <button aria-label={`Take ${x.text} out`} onClick={() => { tap(); drop(side, x) }} />
        </div>
      ))}
      {!list.length && <div className="fr-empty">{team ? 'NOTHING YET' : ''}</div>}
    </>
  )
  return (
    <>
      <div className="fr-cols is-even">
        <Panel title="The offer" meta={open ? null : 'TRADES CLOSED'}>
          <button className="fr-row" onClick={() => { tap(); setPicking(true) }}>
            {them && <Logo team={them.short} size={30} />}
            <span className="fr-row-main">{them ? them.name : 'Pick a club to deal with'}{them && <small>{safe(() => FR.teams(F).find(t => t.short === them.short)?.record, '')} · {STATE_SHORT[state] ?? ''}</small>}</span>
            <span className="fr-row-state">{them ? 'CHANGE' : 'PICK'}</span><span className="fr-chev" />
          </button>
          {them && leg('give', `THE ${up(us.nick)} SEND`, give, us)}
          {them && leg('get', `THE ${up(them.nick)} SEND`, get, them)}
        </Panel>
        {them && (
          <Panel title={`The ${them.nick}' answer`} meta={v ? 'VALUE AS THEY SEE IT' : null}>
            {v ? <>
              <div className="fr-scale">
                <span><small>THEY GET</small><b>{v.give.toLocaleString('en-US')}</b><i className="is-team"><u style={{ width: `${v.give / max * 100}%` }} /></i></span>
                <span><small>THEY GIVE UP</small><b>{v.get.toLocaleString('en-US')}</b><i><u style={{ width: `${v.get / max * 100}%` }} /></i></span>
              </div>
              <div className={`fr-verdict${v.ok ? ' is-yes' : ''}`}><small>{v.ok ? 'THEY WOULD DO IT' : !v.capOk ? 'THE CAP' : !v.rosterOk ? 'THE ROSTERS' : 'NOT YET'}</small><p>{v.answer}</p></div>
            </> : <div className="fr-empty">ADD A PLAYER OR A PICK TO HEAR FROM THEM</div>}
            <div className="fr-pad">
              {v?.counter && <button className="fr-btn fr-btn--line fr-btn--wide" onClick={() => { tap(); setDeal(d => ({ team: d.team, give: { players: v.counter.give.players ?? [], picks: v.counter.give.picks ?? [] }, get: { players: v.counter.get.players ?? [], picks: v.counter.get.picks ?? [] } })) }}>ADD WHAT THEY ASK FOR</button>}
              <button className="fr-btn fr-btn--wide" disabled={!open || !any} onClick={propose}>PROPOSE THE TRADE</button>
              {any && <button className="fr-btn fr-btn--quiet fr-btn--sm fr-btn--wide" onClick={() => { tap(); setDeal(d => ({ team: d.team, give: EMPTY, get: EMPTY })) }}>CLEAR THE TABLE</button>}
            </div>
          </Panel>
        )}
      </div>
      <ClubPicker FR={FR} F={F} open={picking} value={deal.team} onClose={() => setPicking(false)} onPick={s => { setPicking(false); setDeal(d => (d.team === s ? d : { team: s, give: d.give, get: EMPTY })) }} />
      <AssetSheet FR={FR} F={F} team={adding === 'give' ? F.team : adding === 'get' ? deal.team : null} leg={adding ? deal[adding] : EMPTY} onToggle={adding ? toggle(adding) : () => {}} onClose={() => setAdding(null)} />
    </>
  )
}

function FreeAgents({ FR, F, wide, onPlayer }) {
  const all = useMemo(() => safe(() => FR.freeAgents(F, { n: 200 }), []), [FR, F])
  const [pos, setPos] = useState('all')
  const rows = pos === 'all' ? all : all.filter(r => (GROUP[r.slot] ?? r.slot) === pos)
  return (
    <Panel title="Free agents" meta={`${rows.length} AVAILABLE`}>
      <Seg className="fr-seg--fit" label="Position" options={POS} value={pos} onChange={setPos} />
      <FrTable key={pos} className="fr-table--tight" label="Free agents" rows={rows.slice(0, 80)} sort={{ k: 'ovr', desc: true }} onRow={r => onPlayer(r.id)} empty="NOBODY AT THAT SPOT"
        cols={[{ k: 'pos', label: 'POS', w: wide ? 56 : 42, cls: 'fr-t-pos', render: r => r.slot },
          { k: 'name', label: 'PLAYER', cls: 'fr-t-name', val: r => r.short, render: r => (wide ? r.name : shortName(r.name)) },
          { k: 'age', label: 'AGE', align: 'r', w: wide ? 50 : 34, val: r => r.age },
          { k: 'ovr', label: 'OVR', align: 'r', w: wide ? 54 : 38, cls: 'fr-t-num', val: r => r.ovr },
          ...(wide ? [{ k: 'arch', label: 'TYPE', cls: 'fr-t-dim', render: r => r.arch ?? '' }] : []),
          { k: 'ask', label: 'ASK', align: 'r', w: wide ? 90 : 62, val: r => r.ask?.perYear ?? 0, render: r => FR.moneyText(r.ask?.perYear ?? 0) },
          { k: 'yrs', label: 'YRS', align: 'r', w: wide ? 50 : 32, val: r => r.ask?.years ?? 0 }]} />
    </Panel>
  )
}

export default function FrMarket({ FR, F, act, say, wide, onPlayer, onClub, jump }) {
  const block = useMemo(() => safe(() => FR.tradeBlock(F), { mine: [], league: [], offers: [], open: false, deadlineWeek: FR.TRADE_DEADLINE }), [FR, F])
  const [sub, setSub] = useState(jump?.sub ?? (block.offers.length ? 'offers' : 'block'))
  const [deal, setDeal] = useState({ team: jump?.team ?? null, give: EMPTY, get: jump?.want != null ? { players: [jump.want], picks: [] } : EMPTY })
  useEffect(() => {
    if (!jump) return
    if (jump.sub) setSub(jump.sub)
    if (jump.team) setDeal({ team: jump.team, give: EMPTY, get: jump.want != null ? { players: [jump.want], picks: [] } : EMPTY })
  }, [jump])
  const counter = o => { setDeal({ team: o.from, give: { players: o.get.players ?? [], picks: o.get.picks ?? [] }, get: { players: o.give.players ?? [], picks: o.give.picks ?? [] } }); setSub('build') }
  const deadline = block.open ? (F.phase === 'offseason' ? 'TRADES ARE OPEN' : `DEADLINE: AFTER WEEK ${block.deadlineWeek}`) : 'THE DEADLINE HAS PASSED'
  const cols = [
    { k: 'pos', label: 'POS', w: wide ? 56 : 42, cls: 'fr-t-pos', render: r => r.slot },
    { k: 'name', label: 'PLAYER', cls: 'fr-t-name fr-t-wrap', val: r => r.short, render: r => <>{wide ? r.name : shortName(r.name)}{!wide && r.asking && <span className="fr-t-sub">{r.asking}</span>}</> },
    { k: 'tm', label: 'TEAM', w: wide ? 150 : 62, val: r => r.team, render: r => (wide ? <><TeamCell t={FR.teamRef(r.team)} /></> : <TeamCell t={FR.teamRef(r.team)} />) },
    ...(wide ? [{ k: 'ts', label: 'STATE', w: 120, cls: 'fr-t-lab fr-t-dim', render: r => STATE_SHORT[r.teamState] ?? '' }] : []),
    { k: 'age', label: 'AGE', align: 'r', w: wide ? 50 : 32, val: r => r.age },
    { k: 'ovr', label: 'OVR', align: 'r', w: wide ? 54 : 36, cls: 'fr-t-num', val: r => r.ovr },
    { k: 'sal', label: 'PAY', align: 'r', w: wide ? 84 : 54, val: r => r.salary, render: r => FR.moneyText(r.salary) },
    ...(wide ? [{ k: 'ask', label: 'ASKING', cls: 'fr-t-dim', render: r => r.asking ?? '' }] : []),
  ]
  return (
    <>
      <Panel title="Market" meta={deadline}>
        <Seg className="fr-seg--fit" label="Market" options={[['offers', block.offers.length ? `OFFERS ${block.offers.length}` : 'OFFERS'], ['block', 'BLOCK'], ['build', 'BUILD A TRADE'], ['fa', 'FREE AGENTS']]} value={sub} onChange={setSub} />
        {sub === 'offers' && (block.offers.length
          ? block.offers.map(o => <Offer key={o.id} FR={FR} F={F} o={o} act={act} say={say} onCounter={counter} />)
          : <div className="fr-empty">{block.open ? 'NO OFFERS ON THE TABLE' : 'THE DEADLINE HAS PASSED'}</div>)}
      </Panel>
      {sub === 'block' && (
        <div className="fr-cols">
          <Panel title="Around the league" meta={`${block.league.length} AVAILABLE`}>
            <FrTable className="fr-table--tight fr-table--tall" label="Trade block" cols={cols} rows={block.league} sort={{ k: 'ovr', desc: true }} onRow={r => onPlayer(r.id)} empty="NOBODY IS BEING SHOPPED" />
          </Panel>
          <Panel title={`${FR.teamRef(F.team)?.nick} block`} meta={plural(block.mine.length, 'PLAYER')} style={{ order: wide ? 0 : -1 }}>
            {block.mine.map(p => (
              <button key={p.id} className="fr-row" onClick={() => { tap(); onPlayer(p.id) }}>
                <span className="fr-t-pos" style={{ width: 38 }}>{p.slot}</span>
                <span className="fr-row-main">{p.name}<small>AGE {p.age} · {FR.moneyText(p.salary)} · {plural(p.yrs, 'YR')}</small></span>
                <b className="fr-t-num">{p.ovr}</b><span className="fr-chev" />
              </button>
            ))}
            {!block.mine.length && <div className="fr-empty">NOBODY ON THE BLOCK</div>}
          </Panel>
        </div>
      )}
      {sub === 'build' && <Builder FR={FR} F={F} act={act} say={say} deal={deal} setDeal={setDeal} open={block.open} onPlayer={onPlayer} />}
      {sub === 'fa' && <FreeAgents FR={FR} F={F} wide={wide} onPlayer={onPlayer} />}
    </>
  )
}
