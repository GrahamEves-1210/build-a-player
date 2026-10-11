import { useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import './wiki.css'
import { PAGES, SEARCH_INDEX, POOLS } from './WikiPages'
import { RATINGS_AS_OF, fmtDate } from '../RatingsTable'

// The Build-A-Player Wiki: its own page, with its own header, search, page
// tabs and sidebar, and none of the game's chrome. Pages live at /wiki and
// /wiki/<slug>; the shell owns that routing (App only knows "the wiki is open").

const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : null
export const wikiPath = slug => (slug === 'main' ? '/wiki' : `/wiki/${slug}`)
export const slugFromPath = path => {
  const m = /^\/wiki\/?([a-z0-9-]*)/.exec(path || '')
  const s = m?.[1] || 'main'
  return PAGES.some(p => p.slug === s) ? s : 'main'
}
const readLocation = () => ({ slug: slugFromPath(window.location.pathname), query: new URLSearchParams(window.location.search).get('q') || '', pool: new URLSearchParams(window.location.search).get('pool') || 'qb' })

export default function Wiki({ onExit }) {
  const [loc, setLoc] = useState(readLocation)
  const [search, setSearch] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const searchRef = useRef(null)
  const rootRef = useRef(null)                // desktop: the wiki is its own scroll container; phones: the page scrolls (wiki.css)
  const page = PAGES.find(p => p.slug === loc.slug) ?? PAGES[0]

  const go = (slug, opts = {}) => {
    const qs = new URLSearchParams()
    if (opts.query) qs.set('q', opts.query)
    if (opts.pool) qs.set('pool', opts.pool)
    const path = wikiPath(slug) + (qs.toString() ? `?${qs}` : '') + (opts.hash ? `#${opts.hash}` : '')
    if (window.location.pathname + window.location.search + window.location.hash !== path) window.history.pushState({}, '', path)
    setLoc({ slug, query: opts.query || '', pool: opts.pool || 'qb' }); setNavOpen(false); setSearch('')
    if (opts.hash) setTimeout(() => document.getElementById(opts.hash)?.scrollIntoView({ block: 'start' }), 60)
    else {
      const el = rootRef.current
      if (el && el.scrollHeight > el.clientHeight + 1) el.scrollTo({ top: 0, behavior: 'instant' })
      else window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }
  useEffect(() => {
    const onPop = () => setLoc(readLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // a hash in the URL on arrival (shared section link)
  useEffect(() => { const h = window.location.hash.slice(1); if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: 'start' }), 120) }, []) // eslint-disable-line

  const results = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (s.length < 2) return null
    // a section whose title matches outranks a page that only mentions the word
    const score = e => { const m = (e.label.toLowerCase().includes(s) ? 2 : 0) + ((e.keywords || '').toLowerCase().includes(s) ? 1 : 0); return m ? m + (e.anchor ? 0.5 : 0) : 0 }
    const sections = SEARCH_INDEX.map(e => [e, score(e)]).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([e]) => e)
    const seen = new Set()
    const players = []
    for (const p of POOLS) for (const x of [...p.players, ...p.legends]) {
      if (players.length >= 6) break
      if (x.name.toLowerCase().includes(s) && !seen.has(x.name + p.id)) { seen.add(x.name + p.id); players.push({ name: x.name, team: x.team, pool: p }) }
    }
    return { sections, players }
  }, [search])

  const title = page.slug === 'main' ? 'Build-A-Player Wiki' : `${page.title} - Build-A-Player Wiki`
  return (
    <div className="wk" ref={rootRef}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={page.description} />
        <link rel="canonical" href={`https://build-a-player.com${wikiPath(page.slug)}`} />
      </Helmet>

      <header className="wk-top">
        <a className="wk-brand" href="/wiki" onClick={e => { e.preventDefault(); go('main') }}>
          <img src="/bap-mark.webp" alt="" />
          <span><b>Build-A-Player Wiki</b></span>
        </a>
        <div className="wk-search">
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the wiki" aria-label="Search the wiki"
            onKeyDown={e => { if (e.key === 'Escape') setSearch(''); if (e.key === 'Enter' && results) { const r = results.sections[0]; if (r) go(r.slug, { hash: r.anchor || undefined }); else if (results.players[0]) go('ratings', { query: results.players[0].name, pool: results.players[0].pool.id }); else go('ratings', { query: search.trim() }) } }} />
          {results && (
            <div className="wk-search-results" role="listbox">
              {results.sections.length > 0 && <div className="wk-search-group">Pages and sections</div>}
              {results.sections.map(r => <button key={`${r.slug}-${r.anchor}`} className="wk-search-hit" onClick={() => go(r.slug, { hash: r.anchor || undefined })}><b>{r.label}</b><small>{r.anchor ? `in ${r.page}` : 'page'}</small></button>)}
              {results.players.length > 0 && <div className="wk-search-group">Players</div>}
              {results.players.map(r => <button key={`${r.pool.id}-${r.name}`} className="wk-search-hit" onClick={() => go('ratings', { query: r.name, pool: r.pool.id })}><b>{r.name}</b><small>{r.team} · {r.pool.label} ratings</small></button>)}
              {results.sections.length === 0 && results.players.length === 0 && <div className="wk-search-empty">No matches. Try a player, a mode or a stat.</div>}
            </div>
          )}
        </div>
        <a className="wk-exit" href="/" onClick={e => { e.preventDefault(); onExit() }}>← Back to the game</a>
        <button className="wk-burger" onClick={() => setNavOpen(o => !o)} aria-label="Pages and contents" aria-expanded={navOpen}>☰</button>
      </header>

      <div className="wk-body">
        <aside className={`wk-side${navOpen ? ' is-open' : ''}`}>
          <nav className="wk-nav" aria-label="Pages">
            <h4>Pages</h4>
            <ul>{PAGES.map(p => <li key={p.slug} className={p.slug === page.slug ? 'is-on' : ''}><a href={wikiPath(p.slug)} onClick={e => { e.preventDefault(); go(p.slug) }}>{p.title}</a></li>)}</ul>
          </nav>
          {page.toc.length > 0 && (
            <nav className="wk-nav" aria-label="On this page">
              <h4>On this page</h4>
              <ol>{page.toc.map(([id, label]) => <li key={id}><a href={`#${id}`} onClick={e => { e.preventDefault(); setNavOpen(false); setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 30); window.history.replaceState({}, '', `${wikiPath(page.slug)}#${id}`) }}>{label}</a></li>)}</ol>
            </nav>
          )}
          <nav className="wk-nav" aria-label="Elsewhere">
            <h4>Elsewhere</h4>
            <ul>
              <li><a href="/" onClick={e => { e.preventDefault(); onExit() }}>Play Build-A-Player</a></li>
              <li><a href="/bucket">Play Build-A-Bucket</a></li>
              <li><a href="https://discord.gg/zdZBu2VjUD" target="_blank" rel="noopener noreferrer">Discord</a></li>
              <li><a href="https://x.com/Build_A_Player" target="_blank" rel="noopener noreferrer">@Build_A_Player on X</a></li>
            </ul>
          </nav>
        </aside>

        <div className="wk-main">
          <div className="wk-tabs" role="tablist" aria-label="Wiki pages">
            {PAGES.map(p => <a key={p.slug} role="tab" aria-selected={p.slug === page.slug} className={p.slug === page.slug ? 'is-on' : ''} href={wikiPath(p.slug)} onClick={e => { e.preventDefault(); go(p.slug) }}>{p.title}</a>)}
          </div>
          <article className="wk-article">
            <h1 className="wk-h1">{page.heading ?? page.title}</h1>
            <div className="wk-from">From Build-A-Player Wiki</div>
            <page.Component go={go} query={loc.query} pool={loc.pool} />
            <footer className="wk-foot">
              <p>This page was last updated on {fmtDate(BUILD_DATE)}. Ratings as of {fmtDate(RATINGS_AS_OF)}; they refresh with every update to the game's data.</p>
              <p>Build-A-Player is an independent fan project and is not affiliated with, endorsed by, or sponsored by the National Football League, the NBA, or any of their member teams, players' associations, or players. Team names, logos, player names and images belong to their respective owners.</p>
              <p><a href="/" onClick={e => { e.preventDefault(); onExit() }}>Game</a> · <a href="/?about">About</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="mailto:buildaplayer@outlook.com">Corrections</a></p>
            </footer>
          </article>
        </div>
      </div>
    </div>
  )
}
