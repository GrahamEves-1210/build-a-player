import LegalShell, { Sec, P, Mail, Ext } from './LegalShell'

// What the game is, where to learn more, and the fine print
const MODES = [
  ['Seasons', 'Build a player, then play a season: current rosters or the all-time greats.'],
  ['Career', 'One player from the combine and draft to the Hall of Fame.'],
  ['Takeover', 'A road trip through 12 cities, beating the best player in each.'],
  ['Daily Challenge', 'The same spins for everyone, one run a day.'],
  ['Compete and Trait Auction', 'Build live against real players for the best overall.'],
  ['Blacktop', 'Live 3v3 and 1v1 basketball against real players.'],
]

export default function AboutPage({ onBack }) {
  return (
    <LegalShell eyebrow="ABOUT" title="Build-A-Player" onBack={onBack} wide>
      <Sec id="a-what">
        <div className="lg-about-hero">
          <img src="/bap-mark.webp" alt="Build-A-Player" className="lg-about-mark" />
          <P>Build one football or basketball player out of pieces of many real ones. Spin for a team and a player, keep one part of his game, and repeat until your player is complete. Then find out what you made.</P>
        </div>
      </Sec>

      <Sec id="a-modes" title="Ways to play">
        <div className="lg-modes">
          {MODES.map(([t, d]) => <div key={t} className="lg-mode"><b>{t}</b><span>{d}</span></div>)}
        </div>
      </Sec>

      <Sec id="a-wiki" title="Learn more">
        <P>The <a className="about-link" href="/wiki">Build-A-Player Wiki</a> explains every mode and mechanic, from spins and overall ratings to how seasons and careers are simulated, and lists every player rating in the game. Its <a className="about-link" href="/wiki/creators">Creators</a> page collects the YouTubers and streamers who have played.</P>
      </Sec>

      <Sec id="a-support" title="From the maker">
        <P>Enjoy Build-A-Player? Check out my college basketball game, <Ext href="https://32-0game.com">32-0game.com</Ext>. If you'd like to support the game, <Ext href="https://buymeacoffee.com/32and0">leave a tip here</Ext>. Ideas, bugs or questions: <Mail />.</P>
      </Sec>

      <Sec id="a-disclaimer" title="Disclaimer">
        <p className="about-disclaimer">Build-A-Player is an independent fan project and is not affiliated with, endorsed by, or sponsored by the National Football League, NFL Properties LLC, the National Basketball Association, or any of their teams, players' associations or players.</p>
        <p className="about-disclaimer">League and team names, logos, player names and images belong to their respective owners. No commercial relationship with the NFL, the NBA or their teams is implied.</p>
      </Sec>

      <div className="about-footer-links lg-links">
        <a className="about-text-link" href="/wiki">Wiki</a>
        <a className="about-text-link" href="/privacy">Privacy Policy</a>
        <a className="about-text-link" href="/terms">Terms of Service</a>
      </div>

      <a href="https://www.playwire.com/contact-direct-sales" rel="noopener" target="_blank" className="splash-site-footer-playwire" style={{ margin: '18px auto 0' }}>
        <img src="https://www.playwire.com/hubfs/Powered-by-Playwire-Badges/Ads-Powered-by-playwire-2021-standalone-small-white-300px.png" alt="Ads Powered by Playwire" width="140" height="39" loading="lazy" />
      </a>
    </LegalShell>
  )
}
