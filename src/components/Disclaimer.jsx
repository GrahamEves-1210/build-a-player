// The fan-project line (App Store 5.2: the leagues' teams, players and marks): under the
// home screen and the build screen. The website footer says it too (SiteFooter).
export default function Disclaimer({ sport = 'nfl', className = '' }) {
  return (
    <p className={`bap-disclaimer${className ? ` ${className}` : ''}`}>
      {sport === 'cbb'
        ? 'Fan-made college basketball player builder by Playmaker Games, an independent studio. Not affiliated with, endorsed by, or sponsored by the NCAA, any college conference, or any university. School names and logos belong to their owners.'
        : sport === 'cfb'
        ? 'Fan-made college football player builder by Playmaker Games, an independent studio. Not affiliated with, endorsed by, or sponsored by the NCAA, any college conference, or any university. School names and logos belong to their owners.'
        : sport === 'baseball'
        ? 'Fan-made baseball player builder by Playmaker Games, an independent studio. Not affiliated with, endorsed by, or sponsored by Major League Baseball, the MLBPA, or any of their teams or players.'
        : sport === 'soccer'
        ? 'Fan-made soccer player builder by Playmaker Games, an independent studio. Not affiliated with FIFA, UEFA, any league or club, FIFPRO, or any players.'
        : sport === 'bucket'
        ? 'Fan-made NBA player builder by Playmaker Games, an independent studio. Not affiliated with the NBA, the NBPA, or any of their teams or players.'
        : 'Fan-made NFL player builder by Playmaker Games, an independent studio. Not affiliated with the NFL, the NFLPA, or any of their teams or players.'}
    </p>
  )
}
