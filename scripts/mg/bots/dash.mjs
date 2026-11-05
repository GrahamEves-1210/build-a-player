// A human at the Dash: waits on the gun (sometimes doesn't), reacts to it, then runs in rhythm: each
// press is aimed at the moment the next foot lights, or as soon as his thumbs can if that's later.
// A slip is the same thumb twice, and it costs a beat to find the rhythm again.
// human.mash = true ignores the rhythm and hammers both thumbs flat out.
//
// Run this file directly for the regression checks and the floor by grade:
//   node scripts/mg/bots/dash.mjs [runs]
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
export default function makeBot(g, human, r) {
  const form = 1 + gauss(r) * 0.07                 // today's thumbs
  const jumpy = human.slip * 1.5                   // the chance of going on a twitch, per set
  let foot = r() < 0.5 ? 0 : 1
  let goSeen = false, first = Infinity, setSeen = -1, jumpAt = Infinity, aim = Infinity, aimFor = -1, hitch = 0, nextMash = Infinity
  const press = side => [{ kind: 'down', zone: side ? 'R' : 'L', x: 0, y: 0 }]
  return () => {
    if (g.done) return
    if (g.phase === 'set') {
      if (setSeen !== g.falses) { setSeen = g.falses; jumpAt = r() < jumpy ? g.t + 300 + r() * 1200 : Infinity }
      if (g.t >= jumpAt && g.t >= g.fsAt + 720) { jumpAt = Infinity; return press(foot) }
      return
    }
    if (!goSeen) {
      goSeen = true
      const lapse = r() < 0.16 ? 70 + r() * 170 : 0
      first = g.goAt + Math.max(130, human.react + gauss(r) * human.reactSd) + lapse
    }
    if (g.firstPress == null) {
      if (g.t < first) return
      nextMash = g.t + 1000 / human.rate
      foot = 1 - foot
      return press(foot)
    }
    const run = (g.t - g.goAt) / 1000
    const rate = human.rate * form * (1 - Math.min(0.1, run * 0.016))
    if (human.mash) {
      if (g.t < nextMash) return
      nextMash = g.t + Math.max(30, (1000 / rate) * (1 + gauss(r) * 0.08))
      foot = 1 - foot
      return press(foot)
    }
    // one press per stride, aimed when the stride is over
    if (aimFor !== g.strideN) {
      aimFor = g.strideN
      aim = g.strideAt + Math.max(g.needMs * 0.9, 1000 / rate) + gauss(r) * human.timing * 0.5 + hitch
      hitch = 0
    }
    if (g.t < aim) return
    aim = g.t + 1000 / rate          // if that one was wasted, he comes again next beat
    if (r() < human.slip) { hitch = 1000 / rate * 1.5; return press(foot) }  // the thumb he just used
    foot = g.last == null ? foot : 1 - g.last
    return press(foot)
  }
}

// (the browser plays this file too: nothing node-only at the top level)
if (typeof process !== 'undefined' && /bots[\\/]dash\.mjs$/.test(process.argv?.[1] ?? '')) {
  const { make } = await import('../../../src/lib/mg/dash.js')
  const { STEP } = await import('../../../src/lib/mg/kit.js')
  const { seeded } = await import('../../../src/lib/rng.js')
  const runs = Number(process.argv[2]) || 4000
  // 1. A press 0-100 ms after the gun is never a false start, whether it's the first set or a re-set
  let bad = 0, checked = 0, reset = 0
  for (const game of ['forty', 'sprint']) for (let i = 0; i < runs; i++) {
    const seed = `reg-${game}-${i}`, r = seeded(seed + 'b')
    const g = make({ v: 1 + (i % 11), seed, game })
    const after = r() * 100
    const withReset = i % 2 === 1
    if (withReset) { for (let k = 0; k < 40; k++) g.tick(STEP); g.input({ kind: 'down', zone: 'L' }); reset++ }
    const before = g.falses
    let n = 0
    while (g.phase === 'set' && n++ < 2000) g.tick(STEP)
    const go = g.t
    while (g.t - go < after) g.tick(STEP)
    g.input({ kind: 'down', zone: i % 3 ? 'L' : 'R' })
    g.input({ kind: 'down', zone: i % 3 ? 'R' : 'L' })
    if (g.falses !== before || g.phase !== 'run') bad++
    checked++
  }
  console.log(`false starts after the gun: ${bad} of ${checked} runs (${reset} of them after a re-set)`)
  if (bad) process.exitCode = 1

  // 2. The floor by grade
  const H = {
    perfect: { react: 170, reactSd: 12, timing: 4, rate: 13, slip: 0 },
    mash13: { react: 215, reactSd: 25, timing: 12, rate: 13, slip: 0, mash: true },
    mash16: { react: 215, reactSd: 25, timing: 12, rate: 16, slip: 0, mash: true },
    real12: { react: 300, reactSd: 50, timing: 30, rate: 12, slip: 0.015 },
  }
  for (const game of ['forty', 'sprint']) {
    console.log(game)
    for (const [name, human] of Object.entries(H)) {
      const cells = [1, 3, 5, 7, 9, 11].map(v => {
        let sum = 0, best = 99
        const N = 60
        for (let i = 0; i < N; i++) {
          const seed = `floor-${game}-${v}-${name}-${i}`
          const g = make({ v, seed, game }), step = makeBot(g, human, seeded(seed + 'x'))
          let f = 0
          while (!g.done && f++ < 8000) { const a = step(); if (a) for (const x of a) g.input(x); g.tick(STEP) }
          const s = g.done.raw.secs; sum += s; if (s < best) best = s
        }
        return `g${v} ${(sum / N).toFixed(2)} (${best.toFixed(2)})`
      })
      console.log('  ' + name.padEnd(8) + cells.join(' | '))
    }
  }
}
