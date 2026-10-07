import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { CREATORS, CREATORS_AS_OF } from '../data/creators'

// Creators who have played Build-A-Player and Build-A-Bucket. Everything here
// links out to the creator; YouTube videos play through YouTube's own embedded
// player (loaded on tap, so the page stays light), TikToks and posts link out.

const fmtViews = n => (n == null ? null : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M views` : n >= 1e3 ? `${Math.round(n / 1e3)}K views` : `${n} views`)
const fmtDate = s => (s ? new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null)
const PLAT = { youtube: 'YouTube', tiktok: 'TikTok', x: 'X' }

function YouTubeEmbed({ item }) {
  const [on, setOn] = useState(false)
  const src = `https://www.youtube-nocookie.com/embed/${item.id}?autoplay=1&rel=0`
  return (
    <div className={`cr-embed${item.short ? ' cr-embed--short' : ''}`}>
      {on ? (
        <iframe src={src} title={item.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" />
      ) : (
        <button type="button" className="cr-thumb" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${item.id}/hqdefault.jpg)` }} onClick={() => setOn(true)} aria-label={`Play ${item.title}`}>
          <span className="cr-play" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
        </button>
      )}
    </div>
  )
}

export default function CreatorsPage({ onBack, onWiki }) {
  const [filter, setFilter] = useState('all')      // all | nfl | nba | shorts
  const list = useMemo(() => {
    const keep = it => filter === 'all' || (filter === 'shorts' ? it.short : it.game === filter)
    return CREATORS.map(c => ({ ...c, items: c.items.filter(keep) })).filter(c => c.items.length)
      .sort((a, b) => Math.max(...b.items.map(i => i.views || 0)) - Math.max(...a.items.map(i => i.views || 0)))
  }, [filter])
  const total = CREATORS.reduce((s, c) => s + c.items.length, 0)

  return (
    <div className="about-page wiki-page">
      <Helmet>
        <title>Creators — Build-A-Player</title>
        <meta name="description" content="YouTubers, streamers and TikTok creators who have played Build-A-Player and Build-A-Bucket, with their videos and shorts." />
        <link rel="canonical" href="https://build-a-player.com/creators" />
      </Helmet>
      <div className="about-inner wiki-inner">
        <button className="prf-top-back" onClick={onBack}>← Back to Game</button>
        <header className="wiki-head">
          <span className="about-section-title">CREATORS</span>
          <h1 className="wiki-title">People who played it on camera</h1>
          <p className="wiki-p">Creators who have built quarterbacks, bigs and running backs on Build-A-Player and Build-A-Bucket. {total} videos and posts from {CREATORS.length} creators, sorted by their biggest hit, current as of <b>{CREATORS_AS_OF}</b>. Everything links to the creator and plays through YouTube's own player; nothing is re-hosted.</p>
          <nav className="wiki-toc" aria-label="Filter">
            {[['all', 'All'], ['nfl', 'Football'], ['nba', 'Basketball'], ['shorts', 'Shorts']].map(([k, l]) => (
              <a key={k} href={`#${k}`} onClick={e => { e.preventDefault(); setFilter(k) }} style={filter === k ? { background: '#fff', color: '#0f1612', borderColor: '#fff' } : undefined}>{l}</a>
            ))}
            {onWiki && <a href="/wiki" onClick={e => { e.preventDefault(); onWiki() }}>Wiki ↗</a>}
          </nav>
        </header>

        <div className="cr-grid">
          {list.map(c => (
            <article key={c.id} className="cr-card">
              <div className="cr-head">
                <span className="cr-avatar" aria-hidden="true">{c.name.slice(0, 1)}</span>
                <div>
                  <div className="cr-name"><a href={c.url} target="_blank" rel="noopener noreferrer">{c.name}</a></div>
                  {c.blurb && <div className="cr-sub">{c.blurb}</div>}
                </div>
                <div className="cr-platforms">{[...new Set(c.items.map(i => i.type))].map(p => <span key={p} className={`cr-plat cr-plat--${p}`}>{PLAT[p]}</span>)}</div>
              </div>
              {c.items.some(i => i.type === 'youtube') && (
                <div className="cr-videos">
                  {c.items.filter(i => i.type === 'youtube').map(i => (
                    <div key={i.id} className="cr-video">
                      <YouTubeEmbed item={i} />
                      <div className="cr-vtitle"><a href={`https://www.youtube.com/watch?v=${i.id}`} target="_blank" rel="noopener noreferrer">{i.title}</a></div>
                      <div className="cr-vmeta">{[i.short ? 'Short' : null, fmtDate(i.date), fmtViews(i.views)].filter(Boolean).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              )}
              {c.items.some(i => i.type !== 'youtube') && (
                <div className="cr-links">
                  {c.items.filter(i => i.type !== 'youtube').map(i => (
                    <a key={i.url} className="cr-link" href={i.url} target="_blank" rel="noopener noreferrer">
                      <span className={`cr-plat cr-plat--${i.type}`}>{PLAT[i.type]}</span>
                      <span>{i.title}</span>
                      {i.date && <small>{fmtDate(i.date)}</small>}
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
          {list.length === 0 && <p className="wiki-note">Nothing in this filter yet.</p>}
        </div>

        <section className="cr-submit">
          <h3 className="wiki-h3" style={{ margin: 0 }}>Made a video?</h3>
          <p className="wiki-p">If you have played Build-A-Player or Build-A-Bucket on YouTube, TikTok, Twitch or anywhere else, send the link to <a className="about-link" href="mailto:buildaplayer@outlook.com">buildaplayer@outlook.com</a> or tag <a className="about-link" href="https://x.com/Build_A_Player" target="_blank" rel="noopener noreferrer">@Build_A_Player</a> and it goes on this page.</p>
        </section>

        <div className="about-footer-links">
          <a className="about-text-link" href="/wiki" onClick={e => { if (onWiki) { e.preventDefault(); onWiki() } }}>Wiki</a>
          <span style={{ color: 'var(--text-muted, #666)', margin: '0 8px' }}>·</span>
          <a className="about-text-link" href="/?about">About</a>
        </div>
      </div>
    </div>
  )
}
