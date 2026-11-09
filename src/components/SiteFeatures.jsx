// The website's "what is this" strip under the home menu and the build screens: four parts,
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
    { Icon: IconSpin, title: 'Build a player', text: "Spin a team, land on a real player and take one trait from him. Josh Allen's arm, Saquon's legs, whatever the wheel gives you. Keep going until every slot is full." },
    { Icon: IconTrophy, title: 'Play the season', text: 'He plays 17 games and the playoffs, and you find out if he wins MVP or a Super Bowl. Or start a Career and play him from draft day until he retires.' },
    { Icon: IconLive, title: 'Beat real people', text: 'Compete puts five people in a pool with the same spins, and the highest overall wins. In the Trait Auction you get $100 to outbid two other people for traits.' },
    { Icon: IconClimb, title: 'Climb the leaderboards', text: 'Games earn XP and coins toward your level and the Builder Pass. Your best builds stay on your profile, and the top ones go on the leaderboards.' },
  ],
  bucket: [
    { Icon: IconSpin, title: 'Build a player', text: "Spin a team, land on a real player and take one trait from him. Steph's jumper, Kyrie's handles, whatever the wheel gives you. Keep going until every slot is full." },
    { Icon: IconTrophy, title: 'Play the season', text: 'He plays 82 games and the playoffs, and you find out if he wins MVP or a ring. Or start a Career and play him from draft day until he retires.' },
    { Icon: IconLive, title: 'Beat real people', text: 'Blacktop is live 1v1, 2v2 and 3v3, played to 11. Compete puts five people in a pool with the same spins, and the highest overall wins.' },
    { Icon: IconClimb, title: 'Climb the leaderboards', text: 'Games earn XP and coins toward your level and the Builder Pass. Your best builds stay on your profile, and the top ones go on the leaderboards.' },
  ],
  soccer: [
    { Icon: IconSpin, title: 'Build a striker', text: "Spin a club, land on one of its real players and take one trait from him. Haaland's finishing, Messi's dribbling, whatever the wheel gives you. Keep going until every slot is full." },
    { Icon: IconTrophy, title: 'Play the season', text: "He plays a full league season, the cup and Europe, and you find out if he wins the Golden Boot, the title or the Ballon d'Or." },
    { Icon: IconLive, title: 'Play the World Cup', text: 'Spin the World Cup pool instead and build him from the 48 nations of 2026. Then take a nation through the group and the knockouts.' },
    { Icon: IconClimb, title: 'Climb the leaderboards', text: 'Games earn XP and coins toward your level and the Builder Pass. Your best builds stay on your profile, and the top ones go on the leaderboards.' },
  ],
  baseball: [
    { Icon: IconSpin, title: 'Build a player', text: "Spin an MLB team, land on one of its hitters or pitchers and take one trait from him. Judge's power, Skenes's fastball, whatever the wheel gives you. Keep going until every slot is full." },
    { Icon: IconTrophy, title: 'Play the season', text: 'He plays 162 games and the postseason, and you find out if he wins the MVP, the Cy Young or the World Series.' },
    { Icon: IconLive, title: 'Draft the legends', text: 'Spin the All-Time pool instead and build him from the franchise greats. Then play the season with any of the 30 clubs.' },
    { Icon: IconClimb, title: 'Climb the leaderboards', text: 'Games earn XP and coins toward your level and the Builder Pass. Your best builds stay on your profile, and the top ones go on the leaderboards.' },
  ],
}

export default function SiteFeatures({ sport = 'nfl', className = '' }) {
  const list = FEATURES[sport === 'bucket' || sport === 'soccer' || sport === 'baseball' ? sport : 'nfl']
  return (
    <section className={`splash-features${sport === 'bucket' ? ' splash-features--bucket' : sport === 'soccer' ? ' splash-features--soccer' : sport === 'baseball' ? ' splash-features--baseball' : ''} ${className}`} aria-label="How it plays">
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
