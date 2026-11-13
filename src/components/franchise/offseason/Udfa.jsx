import { useMemo, useState } from 'react'
import { Panel, FrTable, useWide } from '../frUi'
import { Frame, useOff } from './frame'
import { ProspectSheet } from './Draft'
import { PosFilter, Who, byPos, safe, up, plural } from './offUi'

// OFFSEASON 7 · UNDRAFTED FREE AGENTS (the engine's udfaPool / signUdfa). The best of who the draft left: a
// short list, a three-year minimum deal each, up to the camp limit. Left alone, nobody is signed; DELEGATE has the
// staff bring in a few at the club's thinnest spots.

const f2 = v => (v == null ? '' : Number(v).toFixed(2))

export default function Udfa() {
  const { FR, F, o, act, move } = useOff()
  const pool = o.view
  const wide = useWide()
  const [pos, setPos] = useState('all')
  const [open, setOpen] = useState(null)
  const [got, setGot] = useState([])
  const camp = useMemo(() => safe(() => FR.campView(F).camp), [FR, F])
  const board = useMemo(() => safe(() => FR.draftBoard(F)), [FR, F])
  const p = pool.find(x => x.id === open) ?? null
  const full = camp ? camp.count >= camp.limit : false
  const sign = x => { const n = act(f => FR.signUdfa(f, x.id), { say: true }); if (n?.flash?.ok) { setGot(g => [...g, `${x.slot} ${x.name}`]); setOpen(null) } }
  const cols = [
    ...(wide ? [{ k: 'rank', label: 'RK', w: 44, cls: 'fro-t-rk', val: x => x.rank, desc: false }] : []),
    { k: 'slot', label: 'POS', w: 42, cls: 'fr-t-pos', val: x => x.slot },
    { k: 'name', label: 'PLAYER', val: x => x.name, render: x => <Who name={x.name} sub={up(x.college)} /> },
    { k: 'forty', label: '40', w: 46, align: 'r', cls: 'fr-t-num', desc: false, val: x => x.combine?.forty ?? 9, render: x => f2(x.combine?.forty) },
    { k: 'grade', label: 'GRADE', w: 76, align: 'r', cls: 'fr-t-lab', val: x => (x.range.lo + x.range.hi) / 2, render: x => x.range.text },
    { k: 'go', label: '', w: 64, align: 'r', render: x => <button className="fr-btn fr-btn--line fr-btn--sm fro-rowbtn" disabled={full} onClick={e => { e.stopPropagation(); sign(x) }}>SIGN</button> },
  ]
  return (
    <Frame main={{ label: 'TO TRAINING CAMP', onClick: () => move(f => FR.advanceStage(f)) }}
      side={{ label: 'DELEGATE', onClick: () => move(f => FR.advanceStage(f, { auto: true, once: true }), 'THE STAFF SIGNED UNDRAFTED PLAYERS', 'The staff did not bring anyone in.') }}>
      <div className="fro-cap" role="group" aria-label="Camp roster">
        <span className="is-lead"><small>CAMP ROSTER</small><b>{camp ? `${camp.count}/${camp.limit}` : ''}</b></span>
        <span><small>SIGNED HERE</small><b>{got.length}</b></span>
        <span><small>THE DEAL</small><b>3 YRS · MIN</b></span>
        {board?.needs?.[0] && <span><small>THINNEST</small><b>{board.needs.slice(0, wide ? 3 : 2).map(n => n.group).join(' · ')}</b></span>}
      </div>
      {got.length > 0 && <Panel title="Signed" meta={plural(got.length, 'PLAYER')}>{got.map((g, i) => <p key={i} className="fro-line">{g}</p>)}</Panel>}
      <Panel title="Undrafted free agents" meta={`THE BEST ${pool.length} LEFT`}>
        <PosFilter value={pos} onChange={setPos} />
        <FrTable key={pos} className="fro-fixed" cols={cols} rows={byPos(pool, pos)} sort={{ k: 'grade', desc: true }} onRow={x => setOpen(x.id)} label="Undrafted free agents" empty="NO ONE LEFT AT THIS POSITION" />
      </Panel>
      <ProspectSheet FR={FR} p={p} onClose={() => setOpen(null)} foot={p ? <button className="fr-btn" disabled={full} onClick={() => sign(p)}>{full ? 'THE CAMP ROSTER IS FULL' : 'SIGN HIM'}</button> : null} />
    </Frame>
  )
}
