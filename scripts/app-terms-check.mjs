// The app's copy without league trademarks (lib/appTerms.js): prints sample lines before and after. node scripts/app-terms-check.mjs
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const { appSafe } = await server.ssrLoadModule('/src/lib/appTerms.js')
const T = ['The Chiefs are on the clock', 'Kansas City Chiefs', 'Seahawks', 'Cardinals', 'He won the Super Bowl', 'Super Bowl champion', '3x Pro Bowler', 'Made 5 Pro Bowls', 'the NFL Draft', 'His NFL career', 'Best in the NBA', 'NBA Finals MVP', 'Reached the Final Four', 'March Madness', 'Heisman Trophy winner', 'Lombardi Trophy', 'Magic Johnson', 'Orlando Magic', 'Alabama Crimson Tide', 'Crimson Tide', 'Tigers', 'the Eagles\' defense', 'an NFL team', 'NFL', 'MVP', 'All-Pro', 'Rookie of the Year', 'Sam Darnold']
for (const t of T) console.log(JSON.stringify(t), '->', JSON.stringify(appSafe(t, 'football')))
for (const t of ['Lakers', 'Los Angeles Lakers', 'Magic Johnson', 'Duke Blue Devils', 'Heat', 'heat check', 'Final Four']) console.log(JSON.stringify(t), '->', JSON.stringify(appSafe(t, 'basketball')))
await server.close()
