// Every screen a player can reach on the website, as scripts: each scenario starts from a clean browser profile on
// its path (with its saves seeded), walks its screens and calls ctx.audit(name) on each one.
// A new screen, sheet or mode gets a line here; `node scripts/rail-audit.mjs --list` prints what there is.
import { sheet, walk, crawl, screen, seed, playBuild, sleep } from './flow.mjs'
import { MODES } from './scenarios-modes.mjs'

// Home: what the crawler leaves alone (the modes and the dock have scenarios of their own; rows of the same kind)
const HOME_SKIP = /^(ag-way|ag-start|ag-sport-btn|ag-resume|ps-tile|ntag-link|ag-tab|ag-play|ag-howto|ag-player-chip|coin-pill)\|/
// lists: one or two rows stand for the rest
const ROWS = /^(ntag-link|ps-tile|ps-col|lb-row|sc-card|splash-site-footer-link|pp-banner|ag-tab|ag-play|ag-round-btn)\|/
const menu = async ctx => { await ctx.eval(`window.dispatchEvent(new CustomEvent('bap:menu'))`); await sleep(900) }
const auth = async ctx => { await ctx.eval(`window.dispatchEvent(new CustomEvent('bap:auth'))`); await sleep(900) }

// the season sim (football): which screen of it this is, by its progress dots and what is on it
const SIM_MARKS = [['.simp-dot:nth-child(1).simp-dot-active', 'season start'], ['.simp-dot:nth-child(2).simp-dot-active', 'regular season'], ['.simp-dot:nth-child(3).simp-dot-active', 'playoffs'],
  ['.simp-dot:nth-child(4).simp-dot-active', 'GOAT status'], ['.simp-dot:nth-child(5).simp-dot-active', 'final report'], ['.sm-moment', 'key moment'], ['.simp-cta--pin', 'pinned advance'], ['.mvp-overlay', 'award']]
const SIM_PRI = ['.sm-option', '.mvp-overlay button', '.simp-cta', '.simp-next-btn', /^(continue|next|see |view |enter playoffs|season summary|final report|goat)/i]

const homeOf = () => async ctx => {
  await ctx.audit('Home')
  await crawl(ctx, 'Home', { skip: HOME_SKIP, soft: async () => { await ctx.nav('home', 900) } })
  await ctx.fresh(ctx.path, ctx.storage)
  await sheet(ctx, 'Home > Sign in', () => auth(ctx), { back: '.auth-close', also: async () => {
    if (await ctx.click(/^Create Account$/, 600)) await ctx.audit('Home > Sign in > Create account')
    if (await ctx.click(/^Sign In$/, 400) && await ctx.click(/^Forgot password/, 600)) await ctx.audit('Home > Sign in > Forgot password')
  } })
  await ctx.fresh(ctx.path, ctx.storage)
  await sheet(ctx, 'Home > A player\'s profile', '.ntag-link', { back: 'esc', wait: 1800 })
  await ctx.fresh(ctx.path, ctx.storage)
  // the hold-for-modes fan over the dock's middle button
  const fan = await ctx.eval(`(async () => { const b = document.querySelector('.ag-play'); if (!b) return false; const r = b.getBoundingClientRect(); const o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: 'touch', isPrimary: true }; b.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 2600)); const open = !!document.querySelector('.ag-fan'); if (!open) b.dispatchEvent(new PointerEvent('pointerup', o)); return open })()`)
  if (fan) await ctx.audit('Home > Hold for modes'); else ctx.miss('Home > Hold for modes', 'the hold did not open the fan')
  await ctx.fresh(ctx.path, ctx.storage)
  // the tutorial, step by step
  if (await ctx.click('.ag-howto', 900)) await walk(ctx, 'Tutorial', { pri: ['.tut-welcome-go', '.tut-bubble-btn', '.tut-next', /^(next|got it|done|finish|let's go|start)/i], markers: [['.tut-welcome-go', 'welcome'], ['.tut-coach', 'coach mark'], ['.tut-tour', 'tour']], max: 16, perName: 12, patience: 5000 })
}
const dockOf = list => async ctx => {
  for (const [to, name, opts] of list) {
    await ctx.fresh(ctx.path, ctx.storage)
    await screen(ctx, name, async () => { await ctx.nav(to, 1400) }, { skip: ROWS, ...opts })
  }
}

export const SCENARIOS = [
  { group: 'home', name: 'football Home and everything it opens', path: '/', run: homeOf() },
  { group: 'home', name: 'basketball Home and everything it opens', path: '/bucket', run: homeOf() },
  { group: 'dock', name: 'football: Shop, Daily, Ranks, Pass, Cards, Achievements, Locker, Patch notes, Online, Practice, Pro', path: '/', run: dockOf([
    ['shop', 'Shop'], ['daily', 'Daily'], ['leaderboard', 'Ranks'], ['pass', 'Builder Pass'], ['cards', 'Cards (guest)'], ['achievements', 'Achievements'], ['locker', 'Locker'],
    ['whatsnew', 'Patch notes'], ['online', 'Online'], ['mglab', 'Practice (mini games list)', { depth: 1 }], ['pro', 'BAP Pro'], ['profile', 'Profile (guest: sign-in sheet)', { crawl: false }]]) },
  { group: 'dock', name: 'basketball: Shop, Daily, Ranks, Online, Practice', path: '/bucket', run: dockOf([
    ['shop', 'Shop (basketball)'], ['daily', 'Daily (basketball)'], ['leaderboard', 'Ranks (basketball)'], ['online', 'Online (basketball)'], ['mglab', 'Practice (basketball)', { depth: 1 }]]) },
  { group: 'pages', name: 'About, Privacy, Terms, Wiki, direct links', path: '/', run: async ctx => {
    for (const [path, name] of [['/?about', 'About'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/wiki', 'Wiki'], ['/leaderboard', 'Leaderboard (direct link)'], ['/depth-chart', 'Depth Chart (direct link)'], ['/salary', 'Salary Cap (direct link)'],
      ['/profile', 'Profile link as a guest'], ['/simulate', 'Simulate link with no season'], ['/minigame', 'Mini game link with no game'], ['/bucket/leaderboard', 'Leaderboard (basketball, direct link)']]) {
      await ctx.open(path); await sleep(600); await ctx.audit(name)
    }
    await ctx.open('/wiki'); await sleep(600)
    await crawl(ctx, 'Wiki', { enter: async () => { await ctx.open('/wiki'); await sleep(600) }, depth: 1, perClass: 3, max: 14 })
  } },
  { group: 'build', name: 'football build: empty, the spin, a result, placing, sandbox, menus, complete, share, team picker', path: '/', run: async ctx => {
    await ctx.click('.ag-start', 1500)
    await ctx.audit('Build (empty)')
    if (await ctx.click('.drop-bar:not(.is-open)', 900)) await ctx.audit('Build > Spin sheet open')
    if (await ctx.click('.spin-btn', 400) && await ctx.waitFor('.attr-chip', 12000)) { await sleep(600); await ctx.audit('Build > Spin result (pick a slot)') } else ctx.miss('Build > Spin result', 'the spin did not finish')
    if (await ctx.click('.attr-chip', 900)) await ctx.audit('Build > One trait placed')
    await sheet(ctx, 'Build > Position menu', '.tab-pill', { back: '.tab-pill' })
    await sheet(ctx, 'Build > More', '.nav-more-btn', { back: '.ag-menu-overlay .ag-round-btn' })
    await sheet(ctx, 'Build > Sandbox', '.ag-sandbox-main', { back: ['.cr-close', /^(cancel|close|back)$/i, 'esc'] })
    if (await playBuild(ctx)) {
      await ctx.audit('Build (complete)')
      await sheet(ctx, 'Build > Share', '.share-build-btn', { back: ['.share-close', /^close$/i, 'esc'], wait: 1500 })
      await sheet(ctx, 'Build > Simulate > Team picker (spin)', '.sim-btn', { wait: 1200, also: async () => { if (await ctx.click(/^Pick$/, 700)) await ctx.audit('Build > Simulate > Team picker (pick)') } })
    } else ctx.miss('Build (complete)', 'the build could not be finished by spinning')
  } },
  { group: 'build', name: 'football: the other positions\' build screens', path: '/', run: async ctx => {
    for (const pos of ['RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K']) {
      await ctx.fresh('/', ctx.storage)
      const re = new RegExp(`^(NEW )?${pos}$`)
      if (!await ctx.click(re, 500)) { await ctx.click('.ag-pos--to-def', 500); if (!await ctx.click(re, 500)) { ctx.miss(`Build ${pos}`, 'no such position chip on Home'); continue } }
      await ctx.click('.ag-start', 1500)
      await ctx.audit(`Build ${pos} (empty)`)
      await ctx.click('.drop-bar:not(.is-open)', 900)
      if (await ctx.click('.spin-btn', 400) && await ctx.waitFor('.attr-chip', 12000)) { await sleep(600); await ctx.audit(`Build ${pos} > Spin result`) }
    }
  } },
  { group: 'build', name: 'basketball build: empty, the spin, a result, complete, team picker', path: '/bucket', run: async ctx => {
    await ctx.click('.ag-start', 1500)
    await ctx.audit('Build (basketball, empty)')
    if (await ctx.click('.drop-bar:not(.is-open)', 900)) await ctx.audit('Build (basketball) > Spin sheet open')
    if (await playBuild(ctx, { onFirst: async () => { await sleep(500); await ctx.audit('Build (basketball) > Spin result') } })) {
      await ctx.audit('Build (basketball, complete)')
      await sheet(ctx, 'Build (basketball) > Simulate > Team picker', '.sim-btn', { wait: 1200 })
    } else ctx.miss('Build (basketball, complete)', 'the build could not be finished by spinning')
  } },
  { group: 'sim', name: 'football season, start to finish (QB): every advance, key moments, playoffs, the award, GOAT status, the final report', path: '/', run: async ctx => {
    await seed(ctx, `build('qb')`)
    await ctx.open('/')
    await ctx.click('.ag-resume', 1500)
    await ctx.click('.sim-btn', 1200)
    await ctx.click(/^Pick$/, 600)
    await ctx.click('.tpm-team-btn', 2500)
    const end = await walk(ctx, 'Season (QB)', { pri: SIM_PRI, markers: SIM_MARKS, perName: 2, max: 70, patience: 60000, until: '.simp-dot:last-child.simp-dot-active' })
    await sleep(1500)
    await ctx.audit('Season (QB): final report')
    await crawl(ctx, 'Season (QB): final report', { enter: async () => {}, depth: 2, skip: /^(splash-site-footer|pp-banner|simp-back)/ })
    if (end !== 'until') ctx.miss('Season (QB): the whole season', `the walk ended early (${end})`)
  } },
  ...MODES,
]
