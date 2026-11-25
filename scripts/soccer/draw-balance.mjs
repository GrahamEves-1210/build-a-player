// Draw the shot (soccer.js) against the keys: each soccer shooting game played by the keyboard bot (scripts/mg/bots/
// <engine>.mjs) and by a bot that draws its shots (<engine>-draw.mjs), the same humans and grades. Goal rates in %.
//   node scripts/soccer/draw-balance.mjs [game ...] [--runs=300]
import { GAMES } from '../../src/lib/minigames.js'
import { ENGINES } from '../../src/lib/mg/index.js'
import { HUMANS, loadBot, playOnce } from '../mg/balance.mjs'
import { existsSync } from 'node:fs'
const VS = [1, 3, 5, 8, 11]
const args = process.argv.slice(2)
const runs = Number(args.find(a => a.startsWith('--runs='))?.slice(7)) || 300
const games = args.filter(a => !a.startsWith('--'))
const list = games.length ? games : ['penalty', 'one-on-one', 'free-kick', 'two-on-one', 'finishing']
void GAMES
console.log(`goal % (finishing: passes) for each human at grades ${VS.join(' ')}, ${runs} runs a cell`)
for (const game of list) {
  const E = ENGINES[game]
  for (const kind of ['keys', 'draw']) {
    const file = kind === 'keys' ? E.botName : `${E.botName}-draw`
    if (!existsSync(`scripts/mg/bots/${file}.mjs`)) { console.log(game.padEnd(12), kind, 'no bot'); continue }
    const bot = await loadBot(file)
    const row = []
    let all = 0, n = 0, stuck = 0
    const kinds = {}
    for (const [name, human] of Object.entries(HUMANS)) {
      const cells = VS.map(v => {
        let hit = 0
        for (let i = 0; i < runs; i++) {
          const res = playOnce(E, bot, game, v, human, `${game}-${v}-${name}-${i}`)
          if (res.stuck) { stuck++; continue }
          if (res.hit) hit++
          const w = res.note ?? '?'; kinds[w] = (kinds[w] ?? 0) + 1
        }
        all += hit; n += runs
        return String(Math.round((hit / runs) * 100)).padStart(3)
      })
      row.push(`${name} ${cells.join(' ')}`)
    }
    console.log(`${game.padEnd(11)} ${kind.padEnd(4)} ${row.join(' | ')} | all ${Math.round((all / n) * 100)}%${stuck ? ` STUCK ${stuck}` : ''}`)
    if (process.env.WHY) console.log('   ', Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, c]) => `${k} ${Math.round((c / n) * 100)}%`).join(' · '))
  }
}
