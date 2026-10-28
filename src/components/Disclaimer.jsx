// The fan-project line (App Store 5.2: the leagues' teams, players and marks): under the
// home screen and the build screen. The website footer says it too (SiteFooter).
export default function Disclaimer({ sport = 'nfl', className = '' }) {
  return (
    <p className={`bap-disclaimer${className ? ` ${className}` : ''}`}>
      {sport === 'bucket'
        ? 'Fan-made NBA player builder by Playmaker Games, an independent studio. Not affiliated with the NBA, the NBPA, or any of their teams or players.'
        : 'Fan-made NFL player builder by Playmaker Games, an independent studio. Not affiliated with the NFL, the NFLPA, or any of their teams or players.'}
    </p>
  )
}
