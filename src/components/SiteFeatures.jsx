// The website's "what is this" strip under the home menu and the build screens: four cards,
// one per part of the game (the app hides it: app-game.css)
const I = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

const IconSpin = () => (
  <svg {...I}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" /><circle cx="12" cy="12" r="2.5" /></svg>
)
const IconTrophy = () => (
  <svg {...I}><path d="M8 21h8M12 17v4M7 4h10l-1 8a4 4 0 0 1-8 0L7 4z" /><path d="M5 4h2v4a3 3 0 0 1-3-3V4zM19 4h-2v4a3 3 0 0 0 3-3V4z" /></svg>
)
const IconLive = () => (
  <svg {...I}><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.48M7.76 16.24a6 6 0 0 1 0-8.48M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" /></svg>
)
const IconClimb = () => (
  <svg {...I}><rect x="3" y="13" width="4" height="8" rx="1" /><rect x="10" y="8" width="4" height="13" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" /></svg>
)

const FEATURES = {
  nfl: [
    { Icon: IconSpin, title: 'Spin & Build', text: 'Every spin lands on a real player. Keep one piece of their game, an arm here and a pair of legs there, until your player is complete.' },
    { Icon: IconTrophy, title: 'Play It Out', text: 'Sim a full season, or take your build through a whole career: draft night, awards, titles and a legacy.' },
    { Icon: IconLive, title: 'Go Live', text: 'Compete against real builders in live pools and the Trait Auction: same spins, best build wins.' },
    { Icon: IconClimb, title: 'Climb the Hall', text: 'Level up, work through the Builder Pass and chase the leaderboards. Your best builds live on your profile.' },
  ],
  bucket: [
    { Icon: IconSpin, title: 'Spin & Build', text: 'Every spin lands on a real player. Keep one piece of their game, a jumper here and handles there, until your player is complete.' },
    { Icon: IconTrophy, title: 'Play It Out', text: 'Sim a full season, or take your build through a whole career: draft night, playoff series, rings and a legacy.' },
    { Icon: IconLive, title: 'Go Live', text: 'Blacktop: live 2v2 and 3v3, first to 11, or a 1v1. Plus Compete pools and the Trait Auction against real builders.' },
    { Icon: IconClimb, title: 'Climb the Hall', text: 'Level up, work through the Builder Pass and chase the leaderboards. Your best builds live on your profile.' },
  ],
}

export default function SiteFeatures({ sport = 'nfl', className = '' }) {
  const list = FEATURES[sport === 'bucket' ? 'bucket' : 'nfl']
  return (
    <section className={`splash-features${sport === 'bucket' ? ' splash-features--bucket' : ''} ${className}`} aria-label="How it plays">
      {list.map(({ Icon, title, text }, i) => (
        <div key={title} className="splash-feature" style={{ '--i': i }}>
          <span className="splash-feature-icon"><Icon /></span>
          <div className="splash-feature-title">{title}</div>
          <p className="splash-feature-desc">{text}</p>
        </div>
      ))}
    </section>
  )
}
