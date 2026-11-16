import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, POS_LABEL } from '../../lib/franchise2'
import { realOf } from '../../lib/franchise2/league'
import { jersey } from '../../lib/franchise2/roster'
import { sfx, haptic } from '../../lib/juice'
import { photoOf, chipCls, outlineCls } from './bits'
import './kit.css'
import { teamKit } from '../../lib/franchise2/kits'

// THE KIT: Franchise's "Sunday broadcast" look (F:\bap-agents\franchise2\TEAM.md, THE LOOK). Every Franchise
// screen is made of these: a chyron for a section's header, a scorebug, a league ticker, a player's lower-third,
// big numbers that count, a stamp, a segmented meter, a team slab. Flat team colours (fkVars), near-black and
// graphite, white type; gold only on trophies, rings and the Super Bowl (tone="gold").
// Anything that moves delivers a result (a stamp landing, a number counting, a card flipping), plays once,
// is short, and Reduce Motion skips it. The ticker scrolls only while it's on screen, twice, then rests.
// The dev page that shows every piece: ?fkit on the dev server (KitPage.jsx).

export const reduced = () => { try { return document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false } }

// ── Team colours as slab colours ─────────────────────────────────────────────
// --tc the slab, --tc2 the accent stripe, --tct / --tc2t the type that reads on each. A black slab (the Raiders)
// is lifted to graphite; a black accent (the Cardinals) reads as white; a light slab (Steelers gold) takes dark type.
const lum = hex => {
  const n = parseInt(String(hex).slice(1, 7), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const mix = (hex, to, k) => {
  const a = parseInt(hex.slice(1, 7), 16), b = parseInt(to.slice(1, 7), 16)
  const ch = s => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k)
  return `#${[16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('')}`
}
const VARS = new Map()
export function fkVars(short) {
  if (VARS.has(short)) return VARS.get(short)
  const t = TEAM[short]
  if (!t) return undefined
  let a = t.color, b = t.color2
  if (lum(a) < 0.012) a = mix(a, '#ffffff', 0.13)
  if (lum(b) < 0.02 || Math.abs(lum(b) - lum(a)) < 0.03) b = '#ffffff'
  // (the type on a slab: whichever of white or near-black reads better on it; --tca: the team's colour that reads on
  // the near-black page, for bars, underlines and accents: its main colour, else its second, else white)
  const dark = L => (L + 0.05) / 0.0527 > 1.05 / (L + 0.05)
  const onInk = L => (L + 0.05) / 0.0527 >= 3
  const la = lum(a), lb = lum(b)
  const v = { '--tc': a, '--tc2': b, '--tct': dark(la) ? '#0b0c0e' : '#ffffff', '--tc2t': dark(lb) ? '#0b0c0e' : '#ffffff', '--tca': onInk(la) ? a : onInk(lb) ? b : '#ffffff' }
  VARS.set(short, v)
  return v
}
export const KLogo = ({ s, size = 28, className = '' }) => (TEAM[s] ? <img className={`fk-logo${chipCls(s)} ${className}`} src={TEAM[s].logo} alt="" width={size} height={size} style={{ width: size, height: size, '--ls': `${size}px` }} draggable={false} /> : null)

// ── A man's name, number and face, the broadcast way ─────────────────────────
const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i
export function splitName(n) {
  const w = String(n || '').trim().split(/\s+/)
  if (w.length < 2) return { first: '', last: w[0] ?? '' }
  let k = w.length > 2 && SUFFIX.test(w[w.length - 1]) ? w.length - 2 : w.length - 1
  if (k > 1 && /^(st\.?|de|del|la|le|van|von|da|di|mc)$/i.test(w[k - 1])) k--   // (St. Brown, Van Noy, De La Cruz are last names)
  return { first: w.slice(0, k).join(' '), last: w.slice(k).join(' ') }
}
// "B. NIX", the scorebug and ticker shorthand
export const shortName = n => { const { first, last } = splitName(n); return `${first ? `${first[0]}. ` : ''}${last}`.toUpperCase() }
const NUM_SPAN = { qb: [1, 19], rb: [20, 39], wr: [10, 19], te: [80, 89], ol: [60, 79], dl: [90, 99], lb: [40, 59], db: [20, 39], k: [1, 19] }
const hashOf = t => { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h) }
// his jersey number: a build's own (setup), a real man's from the data, a depth player's from his name (stable)
export function jerseyOf(F, p) {
  if (!p) return null
  if (F) { const n = jersey(F, p); if (n != null) return n }   // (the depth chart's numbers: roster.js)
  if (p.b != null) return F?.builds?.[p.b]?.num ?? null
  if (p.nu != null) return p.nu
  if (p.num != null) return p.num
  const r = realOf(p.p, p.n)
  if (r?.num != null) return r.num
  const [lo, hi] = NUM_SPAN[p.p] ?? [10, 99]
  return lo + (hashOf(p.n ?? '') % (hi - lo + 1))
}

// ── Chyron: a section's header ───────────────────────────────────────────────
// A flat team-colour slab with one angled edge and white caps; the thin dark bar under it for what's secondary.
//   tag: a block at the slab's front (WEEK 7) · sub: the bar under it · right: anything on the far side
//   tone: 'team' (default) | 'ink' (graphite slab) | 'gold' (the Super Bowl only) | 'w' | 'l'
export function Chyron({ team, title, tag, sub, right, tone = 'team', size = 'm', as: H = 'h2', className = '' }) {
  return (
    <header className={`fk-chy fk-chy--${tone} fk-chy--${size} ${className}`} style={team ? fkVars(team) : undefined}>
      <div className="fk-chy-slab">
        {tag != null && <span className="fk-chy-tag">{tag}</span>}
        <H className="fk-chy-title">{title}</H>
        {right != null && <span className="fk-chy-right">{right}</span>}
      </div>
      {sub != null && <div className="fk-chy-sub">{sub}</div>}
    </header>
  )
}

// ── Ticker: the league along the bottom edge ─────────────────────────────────
// items: { k: 'score', a, as, h, hs, tag ('FINAL', 'F/OT', 'Q3') } | { k: 'news', tag ('INJURY', 'TRADE'…), s (team), text }
// Scrolls while it's on screen, twice through, then rests (tap: again). Reduce Motion: a strip you swipe.
export function Ticker({ items, label = 'AROUND THE LEAGUE', team, passes = 2 }) {
  const box = useRef(null), run = useRef(null)
  const [on, setOn] = useState(false), [n, setN] = useState(0)
  const [dur, setDur] = useState(30)
  const rm = reduced()
  useEffect(() => {
    if (rm || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '0px' })
    if (box.current) io.observe(box.current)
    const vis = () => { if (document.hidden) setOn(false) }
    document.addEventListener('visibilitychange', vis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis) }
  }, [rm])
  // the speed: the same pace however long the reel (about 60 px a second)
  useLayoutEffect(() => { const w = run.current?.scrollWidth ?? 0; if (w) setDur(Math.max(12, w / 2 / 60)) }, [items])
  if (!items?.length) return null
  const done = n >= passes
  const reel = items.map((x, i) => <TickItem key={i} x={x} />)
  return (
    <div ref={box} className={`fk-tick${rm ? ' is-still' : ''}`} style={team ? fkVars(team) : undefined} onClick={() => { if (done) { setN(0); sfx('tap') } }}>
      <span className="fk-tick-label">{label}</span>
      <div className="fk-tick-win">
        <div ref={run} className={`fk-tick-run${on && !done && !rm ? ' is-on' : ''}`} style={{ '--dur': `${dur}s`, '--passes': passes }} onAnimationEnd={() => setN(passes)} onAnimationIteration={() => setN(k => k + 1)}>
          {reel}{!rm && reel}
        </div>
      </div>
    </div>
  )
}
function TickItem({ x }) {
  if (x.k === 'score') {
    const aw = x.as > x.hs, hw = x.hs > x.as
    return (
      <span className="fk-ti fk-ti--score">
        <span className={aw ? 'is-win' : ''}><KLogo s={x.a} size={18} />{x.a}<b>{x.as}</b></span>
        <span className={hw ? 'is-win' : ''}><KLogo s={x.h} size={18} />{x.h}<b>{x.hs}</b></span>
        {x.tag && <small>{x.tag}</small>}
      </span>
    )
  }
  return (
    <span className="fk-ti fk-ti--news">
      {x.tag && <em className={`fk-ti-tag is-${String(x.tag).toLowerCase()}`}>{x.tag}</em>}
      {x.s && <KLogo s={x.s} size={18} />}
      <span>{x.text}</span>
    </span>
  )
}

// ── Scorebug: slim, on top of every game screen ──────────────────────────────
//   a / h: the teams (away first, the broadcast order) · as / hs: scores · per: '1ST'…'OT' · clock: '2:14'
//   dd: '3RD & 6' · poss: 'a' | 'h' (the ball) · final: 'FINAL' | 'F/OT' · flash: { s, text } a score banner
//   recA / recH: the records under the names, before a game
export function Scorebug({ a, h, as = 0, hs = 0, per, clock, dd, poss, final, flash, recA, recH, label }) {
  return (
    <div className={`fk-bug${final ? ' is-final' : ''}`} role="status" aria-label={`${a} ${as}, ${h} ${hs}`}>
      {label && !(dd && !final) && <span className="fk-bug-label">{label}</span>}
      <BugTeam s={a} pts={as} rec={recA} ball={poss === 'a'} win={final && as > hs} lose={final && as < hs} />
      <BugTeam s={h} pts={hs} rec={recH} ball={poss === 'h'} win={final && hs > as} lose={final && hs < as} />
      <span className="fk-bug-st">
        {final ? <b className="fk-bug-final">{final}</b> : <><b>{per}</b><span>{clock}</span></>}
      </span>
      {dd && !final && <span className="fk-bug-dd">{dd}</span>}
      {flash && <span key={flash.key ?? flash.text} className="fk-bug-flash" style={fkVars(flash.s)}><KLogo s={flash.s} size={20} />{flash.text}</span>}
    </div>
  )
}
function BugTeam({ s, pts, rec, ball, win, lose }) {
  return (
    <span className={`fk-bug-t${win ? ' is-win' : ''}${lose ? ' is-lose' : ''}`} style={fkVars(s)}>
      <KLogo s={s} size={24} />
      <span className="fk-bug-n"><b>{s}{ball && <i className="fk-bug-ball" aria-label="ball" />}</b>{rec && <small>{rec}</small>}</span>
      <strong key={pts} className="fk-bug-pts">{pts}</strong>
    </span>
  )
}

// ── Lower-third: a player ────────────────────────────────────────────────────
// His face cut against his team's colour, his number large and faint behind him, his name on a bar, his OVR in a box.
//   name · pos ('QB' or 'qb') · num · ovr · photo (url) · team · mine (one of the player's builds: his owner's name)
//   line: the bar's second line (a stat line, '4 TD · 312 YDS') · stat: { v, label } in place of the OVR box
//   size: 's' | 'm' | 'l' · onClick
export function LowerThird({ name, pos, num, ovr, photo, team, mine, line, stat, size = 'm', onClick, className = '', delay = 0 }) {
  const { first, last } = splitName(name)
  const [bad, setBad] = useState(false)
  const P = POS_LABEL[pos] ?? pos
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`fk-l3 fk-l3--${size}${mine ? ' is-mine' : ''}${onClick ? ' is-tap' : ''} ${className}`} style={{ ...(team ? fkVars(team) : null), '--d': `${delay}ms` }} onClick={onClick} type={onClick ? 'button' : undefined}>
      <span className="fk-l3-slab" aria-hidden="true">
        {num != null && <span className="fk-l3-num">{num}</span>}
        {photo && !bad ? <img className="fk-l3-cut" src={photo} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBad(true)} />
          : <span className="fk-l3-init">{(first[0] ?? '') + (last[0] ?? '')}</span>}
      </span>
      <span className="fk-l3-bar">
        <span className={`fk-l3-name${last.length > 11 ? ' is-xlong' : last.length > 8 ? ' is-long' : ''}`}>{first && <small>{first}</small>}<b>{last}</b></span>
        <span className="fk-l3-meta">
          {P && <span>{P}</span>}{num != null && <span>#{num}</span>}
          {mine && <span className="fk-l3-mine">★ {String(mine).toUpperCase()}</span>}
          {line && <span className="fk-l3-line">{line}</span>}
        </span>
      </span>
      {stat ? <span className="fk-l3-ovr is-stat"><b>{stat.v}</b><small>{stat.label}</small></span>
        : ovr != null && <span className="fk-l3-ovr"><b>{ovr}</b></span>}
    </Tag>
  )
}
// a man on a franchise roster as a lower-third (F, p: league.js's player); the rest as LowerThird
export function ManL3({ F, p, team, owner, ...rest }) {
  if (!p) return null
  return <LowerThird name={p.n} pos={p.s && (p.p === 'dl' || p.p === 'db') ? p.s.toUpperCase() : p.p} num={jerseyOf(F, p)} ovr={p.o} photo={photoOf(F, p, teamKit(team) ?? TEAM[team]?.color, rest.size === 's')} team={team} mine={p.b != null ? owner ?? true : null} {...rest} />
}

// ── Big numbers ──────────────────────────────────────────────────────────────
// A number counting from where it was to where it is (the first time, from 0). Reduce Motion: straight there.
export function useTween(v, { ms = 650, from0 = true } = {}) {
  const to = Number(v) || 0
  const [x, setX] = useState(from0 ? 0 : to)
  const cur = useRef(from0 ? 0 : to)
  useEffect(() => {
    const a = cur.current
    if (a === to) return
    if (reduced()) { cur.current = to; setX(to); return }
    let raf, t0
    const step = now => {
      t0 ??= now
      const k = Math.min(1, (now - t0) / ms), e = k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)
      const n = Math.round(a + (to - a) * e)
      cur.current = n; setX(n)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return x
}
//   v · label (under it) · size (px) · tone: 'w' | 'l' | 'gold' | 'mute' · count: false shows it straight
export function BigNum({ v, label, size = 56, tone, count = true, ms, className = '' }) {
  const n = useTween(v, { ms, from0: count })
  return (
    <span className={`fk-big${tone ? ` is-${tone}` : ''} ${className}`} style={{ '--s': `${size}px` }}>
      <b>{count ? n : v}</b>{label && <small>{label}</small>}
    </span>
  )
}
// a record: 11–6 (–1), each part counting
export function BigRec({ w = 0, l = 0, t = 0, size = 56, label, className = '' }) {
  const W = useTween(w), L = useTween(l)
  return (
    <span className={`fk-big fk-rec ${className}`} style={{ '--s': `${size}px` }}>
      <b>{W}<i>-</i>{L}{t ? <><i>-</i>{t}</> : null}</b>{label && <small>{label}</small>}
    </span>
  )
}

// ── Stamp: W / L, GEM / BUST, slammed on ─────────────────────────────────────
//   kind: 'w' | 'l' | 't' | 'gem' | 'bust' | 'solid' | 'gold' | 'ink' · big · delay (ms) · quiet (no sound)
export function Stamp({ kind = 'ink', children, big = false, delay = 0, quiet = false, className = '' }) {
  const did = useRef(false)
  useEffect(() => {
    if (did.current || quiet) return
    did.current = true
    const t = setTimeout(() => { sfx('stamp'); haptic(big ? 'heavy' : 'light') }, reduced() ? delay : delay + 190)
    return () => clearTimeout(t)
  }, [delay, quiet, big])
  return <span className={`fk-stamp fk-stamp--${kind}${big ? ' is-big' : ''} ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</span>
}

// ── Meter: chunky, segmented, fills once it's on screen ──────────────────────
//   label · v · max (100) · segs (10) · tone: 'team' | 'w' | 'l' | 'ink' · show: the number on the right (v by default)
export function Meter({ label, v, max = 100, segs = 10, tone = 'team', show, color, team, className = '' }) {
  const box = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (reduced() || typeof IntersectionObserver === 'undefined') { setOn(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } })
    if (box.current) io.observe(box.current)
    return () => io.disconnect()
  }, [])
  const k = Math.max(0, Math.min(1, v / max)), full = k * segs
  const n = useTween(on ? Math.round(v) : 0, { ms: 700 })
  return (
    <div ref={box} className={`fk-meter fk-meter--${tone} ${className}`} style={team ? fkVars(team) : undefined}>
      <span className="fk-meter-top">{label && <small>{label}</small>}<b style={color ? { color } : undefined}>{show ?? n}</b></span>
      <span className="fk-meter-segs" style={{ '--n': segs }}>
        {Array.from({ length: segs }, (_, i) => {
          const f = Math.max(0, Math.min(1, full - i))
          return <i key={i}><em style={{ transform: `scaleX(${on ? f : 0})`, transitionDelay: `${i * 35}ms` }} /></i>
        })}
      </span>
    </div>
  )
}

// ── Team slab: a team as a block of its two colours ──────────────────────────
// A hard-edged two-colour split, the logo big and cut off by the edge, the name and the record.
//   s · rec ('11-6' or {w,l,t}) · sub (a line under: '2 SEED', 'AFC WEST') · side: 'l' | 'r' (mirrored) · size 's' | 'm' | 'l'
export function TeamSlab({ s, rec, sub, side = 'l', size = 'm', name, onClick, className = '' }) {
  const t = TEAM[s]
  if (!t) return null
  const Tag = onClick ? 'button' : 'div'
  const r = typeof rec === 'object' && rec ? <BigRec w={rec.w} l={rec.l} t={rec.t} size={size === 'l' ? 44 : size === 's' ? 24 : 34} /> : rec != null ? <span className="fk-slab-rec">{rec}</span> : null
  return (
    <Tag className={`fk-slab fk-slab--${side} fk-slab--${size} ${className}`} style={fkVars(s)} onClick={onClick} type={onClick ? 'button' : undefined}>
      <img className={`fk-slab-logo${outlineCls(s)}`} src={t.logo} alt="" draggable={false} />
      <span className="fk-slab-txt">
        <small>{name ?? t.name.replace(` ${t.nick}`, '').toUpperCase()}</small>
        <b>{t.nick.toUpperCase()}</b>
        {r}
        {sub && <em>{sub}</em>}
      </span>
    </Tag>
  )
}
// Two teams face to face (the matchup): away on the left, home on the right, the line under it.
//   a, h · recA, recH · mid ('AT' | 'VS') · subA, subH · foot (the strip under it)
export function Versus({ a, h, recA, recH, subA, subH, mid = 'AT', foot, size = 'm' }) {
  return (
    <div className={`fk-vs fk-vs--${size}`}>
      <div className="fk-vs-row">
        <TeamSlab s={a} rec={recA} sub={subA} side="l" size={size} />
        <span className="fk-vs-mid"><b>{mid}</b></span>
        <TeamSlab s={h} rec={recH} sub={subH} side="r" size={size} />
      </div>
      {foot && <div className="fk-vs-foot">{foot}</div>}
    </div>
  )
}
// The tale of the tape: one thing about both teams, the two values either side of it; the better one in white with
// its team's mark under it, the other dimmed (no bars: two bars that barely differ say nothing)
//   label · a, h (the values) · fa, fh (how they read: '27.4', 'A-') · teamA, teamH · lower (lower is better: points allowed)
export function Tape({ label, a, h, fa, fh, teamA, teamH, lower = false }) {
  const better = lower ? (a < h ? 'a' : h < a ? 'h' : null) : (a > h ? 'a' : h > a ? 'h' : null)
  return (
    <div className="fk-tape">
      <b className={better === 'a' ? 'is-up' : better ? 'is-down' : ''} style={fkVars(teamA)}>{fa ?? a}</b>
      <small>{label}</small>
      <b className={better === 'h' ? 'is-up' : better ? 'is-down' : ''} style={fkVars(teamH)}>{fh ?? h}</b>
    </div>
  )
}

// ── Navigation ───────────────────────────────────────────────────────────────
// The way back from a sub-view: always the top left (sticky under the hub's tabs), named for where it goes.
export function BackBar({ label = 'Back', title, onBack, right }) {
  return (
    <div className="fk-back">
      <button type="button" onClick={onBack}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" /></svg>
        <span>{label}</span>
      </button>
      {title != null && <b>{title}</b>}
      {right != null && <span className="fk-back-r">{right}</span>}
    </div>
  )
}
// The screen's next step: always at the bottom of the screen (it sticks there while the page scrolls)
export const ActionBar = ({ children, className = '' }) => <div className={`fk-actbar ${className}`}>{children}</div>
// A section that opens with a tap (the extras a screen keeps one tap away)
export function Fold({ title, right, open: init = false, children, className = '' }) {
  const [open, setOpen] = useState(init)
  return (
    <section className={`fk-fold${open ? ' is-open' : ''} ${className}`}>
      <button type="button" className="fk-fold-h" aria-expanded={open} onClick={() => { setOpen(o => !o); sfx('tap') }}>
        <b>{title}</b>{right != null && <span>{right}</span>}<i aria-hidden="true">▾</i>
      </button>
      {open && <div className="fk-fold-b">{children}</div>}
    </section>
  )
}

// ── Buttons ──────────────────────────────────────────────────────────────────
// The one call to action on a screen: a white slab, angled, black caps. ghost: the quiet second one.
export function Go({ children, onClick, sub, disabled, ghost = false, className = '', ...rest }) {
  return (
    <button type="button" className={`fk-go${ghost ? ' is-ghost' : ''} ${className}`} onClick={onClick} disabled={disabled} {...rest}>
      <span className="fk-go-txt">{children}</span>{sub && <small>{sub}</small>}
      {!ghost && <svg className="fk-go-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" /></svg>}
    </button>
  )
}
// a small label: tone 'inj' | 'out' | 'new' | 'w' | 'l' | 'team' | 'gold'
export const Tag = ({ tone = 'ink', children, className = '' }) => <span className={`fk-tag fk-tag--${tone} ${className}`}>{children}</span>

// ── Reveals ──────────────────────────────────────────────────────────────────
// A card that flips once from its back to its face (a draft card, a signing): open turns it.
export function Flip({ open, front, back, className = '', onFlipped }) {
  const was = useRef(open)
  useEffect(() => {
    if (open && !was.current) { sfx('flip'); haptic('light'); const t = setTimeout(() => onFlipped?.(), reduced() ? 0 : 520); was.current = open; return () => clearTimeout(t) }
    was.current = open
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`fk-flip${open ? ' is-open' : ''} ${className}`}>
      <div className="fk-flip-in">
        <div className="fk-flip-back">{back}</div>
        <div className="fk-flip-face">{front}</div>
      </div>
    </div>
  )
}
// A rating that spins to its value: the digits roll like a reel and land (run starts it). Reduce Motion: the value.
export function Spin({ v, run = true, ms = 650, size = 64, onLand, className = '' }) {
  const [x, setX] = useState(run ? null : v)
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    if (!run) return
    if (reduced()) { setX(v); setLanded(true); onLand?.(); return }
    let raf, t0, last = -1
    const step = now => {
      t0 ??= now
      const k = Math.min(1, (now - t0) / ms)
      // fast at first, slowing into the value; the shown number flicks less often as it slows
      const tick = Math.floor(Math.pow(k, 0.45) * 18)
      if (tick !== last && k < 1) { last = tick; setX(Math.max(1, Math.min(99, Math.round(v + (Math.sin(tick * 7.3) * 30) * (1 - k))))); if (tick % 3 === 0) sfx('tick') }
      if (k < 1) raf = requestAnimationFrame(step)
      else { setX(v); setLanded(true); sfx('gradepop', Math.max(1, Math.min(11, Math.round((v - 55) / 4)))); haptic('light'); onLand?.() }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [run, v]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className={`fk-spin${landed ? ' is-landed' : ''} ${className}`} style={{ '--s': `${size}px` }}>
      <b>{x ?? '--'}</b>
    </span>
  )
}
// A season's banner for the wall: drops in once. gold: a Super Bowl.
//   year · title ('SUPER BOWL CHAMPIONS', 'AFC WEST CHAMPIONS', 'DIVISIONAL ROUND') · rec · team · delay
export function Banner({ year, title, rec, team, gold = false, delay = 0, className = '' }) {
  return (
    <div className={`fk-banner${gold ? ' is-gold' : ''} ${className}`} style={{ ...fkVars(team), animationDelay: `${delay}ms` }}>
      <span className="fk-banner-year">{year}</span>
      <KLogo s={team} size={30} />
      <b className="fk-banner-title">{title}</b>
      {rec && <small className="fk-banner-rec">{rec}</small>}
    </div>
  )
}
// A broadcast bumper: a full-screen slab in the team's colours wipes across with one line (KEY MOMENT, FINAL),
// holds a beat and calls onDone (a tap skips it). Reduce Motion: no wipe, a short hold.
export function Bumper({ team, kicker, title, ms = 900, onDone }) {
  const done = useRef(false)
  const finish = () => { if (done.current) return; done.current = true; onDone?.() }
  useEffect(() => { sfx('swap'); const t = setTimeout(finish, reduced() ? 450 : ms); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="fk-bump" style={{ ...fkVars(team), '--ms': `${ms}ms` }} onClick={finish} role="status">
      <span className="fk-bump-a" /><span className="fk-bump-b" />
      <span className="fk-bump-txt">{kicker && <small>{kicker}</small>}<b>{title}</b></span>
    </div>,
    document.body,
  )
}

// ── Layout ───────────────────────────────────────────────────────────────────
// A section: a chyron and what's under it (no panel box: the chyron is the frame)
export function Section({ children, className = '', delay = 0, ...chy }) {
  return (
    <section className={`fk-sec ${className}`} style={{ '--d': `${delay}ms` }}>
      {chy.title != null && <Chyron {...chy} />}
      <div className="fk-sec-body">{children}</div>
    </section>
  )
}
// One fact the broadcast puts up (a stat with its label), in a row of two or three: never a table
export const Fact = ({ v, label, tone, size = 34 }) => <span className={`fk-fact${tone ? ` is-${tone}` : ''}`} style={{ '--s': `${size}px` }}><b>{v}</b><small>{label}</small></span>
