// The throwing moments play out what the mini game showed (lib/mg/throw.js raw: gain, past, pts):
//   third-long caught short of the sticks → a completion for those yards, short of the first down
//   third-long past the sticks            → a first down by that many yards past the sticks
//   bomb checked down                     → a short completion, not an overthrow
//   bash scripts/franchise/run.sh scripts/franchise/throw-moments.mjs
import * as FR from '../../src/lib/franchise/index'

const problems = []
const seen = { short: 0, past: 0, check: 0, deep: 0 }
for (const [team, seed] of [['KC', 11], ['BUF', 12], ['DET', 13], ['CIN', 14], ['BAL', 15], ['PHI', 16]]) {
  let F = FR.createFranchise({ team, gmName: 'Throws', seed })
  for (let wk = 0; wk < 18; wk++) {
    F = FR.delegateWeek(F)
    F = FR.startGame(F, { mode: 'moments' })
    if (F.flash && F.flash.ok === false) { F = FR.advanceWeek(F); continue }
    for (let n = 0; n < 80; n++) {
      F = FR.nextStop(F)
      const v = FR.gameView(F), stop = v.stop
      if (!stop || stop.kind === 'final') break
      if (stop.kind === 'call') { F = FR.resolveStop(F, 'sim'); continue }
      const g = stop.game, before = v.log.length, dist = v.dist
      let raw = null, win = false, want = null
      if (g === 'third-long') {
        const k = (seen.short + seen.past) % 2
        if (k === 0) { raw = { made: 0, of: 1, gain: Math.max(0, dist - 3) }; want = 'short'; seen.short++ }
        else { raw = { made: 1, of: 1, gain: 9 + 4, past: 4 }; win = true; want = 'past'; seen.past++ }
      } else if (g === 'bomb') {
        const k = (seen.check + seen.deep) % 2
        if (k === 0) { raw = { made: 0, of: 1, gain: 6 }; want = 'check'; seen.check++ }
        else { raw = { made: 1, of: 1, gain: 31, past: 31 }; win = true; want = 'deep'; seen.deep++ }
      }
      F = FR.resolveStop(F, raw ? { win, score: win ? 0.8 : 0.25, raw } : 'sim')
      if (!raw) continue
      const play = FR.gameView(F).log.slice(before).find(p => p.kind !== 'note') ?? FR.gameView(F).log[before]
      const yds = play?.yds ?? null, text = play?.text ?? ''
      const toGoal = 100 - v.spot
      if (want === 'short' && !(yds === Math.min(raw.gain, toGoal) && /short of the sticks/.test(text))) problems.push(`third-long short: wanted ${raw.gain} short, got ${yds}: ${text}`)
      if (want === 'past' && !(yds === Math.min(dist + 4, toGoal))) problems.push(`third-long past: wanted ${dist + 4}, got ${yds}: ${text}`)
      if (want === 'check' && !(yds === Math.min(6, toGoal) && /checks it down/.test(text))) problems.push(`bomb checkdown: wanted 6, got ${yds}: ${text}`)
      if (want === 'deep' && !(yds === Math.min(31, toGoal))) problems.push(`bomb: wanted 31, got ${yds}: ${text}`)
    }
    if (FR.gameView(F)?.status !== 'final') F = FR.skipGame(F)
    F = FR.finishGame(F)
  }
}
console.log('seen', JSON.stringify(seen))
for (const p of problems.slice(0, 20)) console.log('  ' + p)
console.log('PROBLEMS: ' + problems.length)
