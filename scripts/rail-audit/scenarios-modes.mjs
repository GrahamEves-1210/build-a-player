// The game modes: Career, Squad Builder, Salary Cap, Depth Chart, Compete and the Trait Auction, Blacktop, College
// Football, the basketball and kicker seasons, the mini games, and the classic look. See scenarios.mjs.
import { sheet, walk, crawl, screen, seed, playBuild, sleep } from './flow.mjs'

// the dock and the way home are every screen's: the crawler leaves them (and rows of the same kind) alone
const SKIP = /^(ag-tab|ag-play|ag-round-btn|ntag-link|ps-tile|splash-site-footer-link|pp-banner|cr-slot-x|sc-card|dc-back-btn)\|/
// what tells one step of a Career from the next: the blocks on the screen, and the open cards
const CAREER_MARKS = [['.sm-moment', 'decision card'], ['@struct', '.ag-screen-body'], ['@struct', '.ag-screen-body > .cr-sec']]
// a Career moves on with its gold button, a card's options, or a plain button when that is all there is
const CAREER_PRI = ['.sm-option', '.ag-screen .ag-btn--gold:not(:disabled)', '.ag-screen .ag-btn:not(.ag-btn--ghost):not(:disabled)']
const NAMES = ['Cole Norwood', 'Deon Price', 'Mack Tully', 'Jay Ellis', 'Rico Banks']   // (seed.js names its saves by slot)
const openCareer = async (ctx, i) => {
  await ctx.click('.ag-mc--career', 1200)
  if (!await ctx.waitFor('.cr-slot-main', 12000)) return false
  return ctx.eval(`(async () => { const b = [...document.querySelectorAll('.cr-slot-main')].find(x => x.innerText.includes(${JSON.stringify(NAMES[i])})); if (!b) return false; b.click(); await new Promise(r => setTimeout(r, 2200)); return true })()`)
}
// each seeded save: open it, audit it (the first one's tabs and sheets too), then play on from it for a while
const careers = (sport, pos, wants, steps = 5) => async ctx => {
  let made = await seed(ctx, `careers(${JSON.stringify(sport)}, ${JSON.stringify(pos)}, ${JSON.stringify(wants)})`)
  if (!Array.isArray(made)) { await ctx.open(ctx.path); made = await seed(ctx, `careers(${JSON.stringify(sport)}, ${JSON.stringify(pos)}, ${JSON.stringify(wants)})`) ?? [] }
  for (const [i, want] of wants.entries()) {
    const name = `Career (${pos}) ${want}`
    if (/failed/.test(made[i] ?? 'failed')) { ctx.miss(name, `the save could not be made: ${made[i]}`); continue }
    const go = async () => { await ctx.open(ctx.path); return openCareer(ctx, i) }
    if (!await go()) { ctx.miss(name, 'its save is not on the Career screen'); continue }
    await ctx.audit(name)
    if (i === 0 || want === 'retired') { await crawl(ctx, name, { enter: go, skip: SKIP, depth: 2, perClass: 4, max: 18 }); if (!await go()) continue }
    // (the combine's READY opens a full-screen mini game, where the site takes the ads away: that is its own scenario)
    if (want !== 'combine') await walk(ctx, name, { pri: CAREER_PRI, markers: CAREER_MARKS, max: steps, patience: 9000, wait: 900 })
  }
}

export const MODES = [
  // ── Career ──────────────────────────────────────────────────────────────────
  { group: 'career', name: 'football Career: the save list, a new career (name, position, games), the build', path: '/', run: async ctx => {
    await ctx.click('.ag-mc--career', 1800)
    await ctx.audit('Career: no saves yet')
    if (await ctx.click('.cr-slot--empty', 1000)) {
      await ctx.audit('Career: new career form')
      await crawl(ctx, 'Career: new career form', { enter: async () => { await ctx.open('/'); await ctx.click('.ag-mc--career', 1800); await ctx.click('.cr-slot--empty', 1000) }, skip: SKIP, depth: 1, perClass: 3 })
      // on to the build screen it sends you to
      if (await ctx.click('.ag-screen .ag-btn--gold:not(:disabled)', 1500)) await ctx.audit('Career: new career > next step')
      if (await ctx.has('.sim-btn')) { if (await playBuild(ctx)) { await ctx.audit('Career: build complete (GO TO THE COMBINE)'); if (await ctx.click('.sim-btn', 2000)) await ctx.audit('Career: after the build') } }
    } else ctx.miss('Career: new career form', 'no NEW CAREER button')
  } },
  { group: 'career', name: 'football Career (QB): combine, draft, a decision card, an injury, the bye', path: '/', run: careers('nfl', 'qb', ['combine', 'drafted', 'moment', 'injury', 'bye']) },
  { group: 'career', name: 'football Career (QB): preseason, a game week, the playoffs, the offseason, contract offers', path: '/', run: careers('nfl', 'qb', ['preseason', 'week', 'playoffs', 'offseason', 'offers'], 14) },
  { group: 'career', name: 'football Career: retired (legacy), a second-year preseason; a defender and a kicker mid-season', path: '/', run: async ctx => {
    await careers('nfl', 'wr', ['retired', 'preseason2'], 6)(ctx)
    await ctx.fresh('/', ctx.storage)
    await careers('nfl', 'db', ['week', 'offseason'], 6)(ctx)
    await ctx.fresh('/', ctx.storage)
    await careers('nfl', 'k', ['week', 'moment'], 6)(ctx)
  } },
  { group: 'career', name: 'basketball Career (guard): draft, a decision card, an injury, the playoffs, the offseason', path: '/bucket', run: careers('bucket', 'guard', ['drafted', 'moment', 'injury', 'playoffs', 'offseason']) },
  { group: 'career', name: 'basketball Career (big): preseason, a game week, contract offers, retired', path: '/bucket', run: careers('bucket', 'big', ['preseason', 'week', 'offers', 'retired'], 8) },

  // ── Squad Builder ───────────────────────────────────────────────────────────
  ...[['/', 'football'], ['/bucket', 'basketball']].map(([path, sport]) => ({ group: 'squad', name: `${sport} Squad Builder: the intro, picking positions, a build, the squad`, path, run: async ctx => {
    const go = async () => { await ctx.click('.ag-mc--squad', 1800) }
    await screen(ctx, `Squad Builder (${sport})`, go, { skip: SKIP, depth: 2, perClass: 3, max: 16 })
    await ctx.fresh(path, ctx.storage); await go()
    await ctx.click('.sq-tile-add', 700)
    await ctx.audit(`Squad Builder (${sport}): one position picked`)
    await ctx.click('.tk-intro-go:not(:disabled)', 1500)
    if (await ctx.has('.sim-btn')) {
      await ctx.audit(`Squad Builder (${sport}): a player's build`)
      if (await playBuild(ctx)) {
        await ctx.audit(`Squad Builder (${sport}): build complete`)
        if (await ctx.click('.sim-btn', 2000)) await walk(ctx, `Squad Builder (${sport}) after the build`, { pri: ['.tpm-team-btn', '.nba-tpk-team', '.sm-option', '.ag-screen .ag-btn--gold:not(:disabled)', '.ag-screen .ag-btn:not(.ag-btn--ghost):not(:disabled)'], markers: [['.tpm-overlay', 'team picker'], ['.sm-moment', 'decision card'], ['@struct', '.ag-screen-body']], max: 14, patience: 9000 })
      }
    } else ctx.miss(`Squad Builder (${sport}): a player's build`, 'the walk did not reach a build screen')
  } })),

  // ── Salary Cap ──────────────────────────────────────────────────────────────
  ...[['/', 'football'], ['/bucket', 'basketball']].map(([path, sport]) => ({ group: 'salary', name: `${sport} Salary Cap: the board, its sheets, picking a full team, locking in`, path, run: async ctx => {
    const go = async () => { await ctx.click('.ag-mc--salary', 2200) }
    await screen(ctx, `Salary Cap (${sport})`, go, { skip: SKIP, depth: 2, perClass: 3, max: 14 })
    await ctx.fresh(path, ctx.storage); await go()
    // pick players until the board is full (the cheapest first: the cap), auditing as the bar at the bottom changes
    for (let i = 0; i < 14; i++) {
      const more = await ctx.eval(`(() => { const cards = [...document.querySelectorAll('.sc-card:not(.sc-card--picked):not(:disabled)')].filter(c => c.getBoundingClientRect().height > 0); const c = cards[cards.length - 1 - (${i} % 3)]; if (!c) return false; c.scrollIntoView({ block: 'center' }); c.click(); return true })()`)
      await sleep(500)
      if (i === 0 || i === 4) await ctx.audit(`Salary Cap (${sport}): ${i + 1} picked`)
      if (!more || await ctx.has(/^(lock in|simulate|confirm)/i)) break
    }
    await ctx.audit(`Salary Cap (${sport}): picks made`)
    await walk(ctx, `Salary Cap (${sport})`, { pri: [/^(lock in|confirm|simulate|sim season|continue|next)/i, '.sm-option', '.simp-cta', '.bsim-cta'], markers: [['@struct', '.sc-screen'], ['.simp-page', 'season'], ['.bsim-page', 'season'], ['.simp-dot-active', 'sim']], max: 8, patience: 12000 })
  } })),

  // ── The Depth Chart ─────────────────────────────────────────────────────────
  { group: 'depth', name: 'The Depth Chart: the board, its sheets, a round', path: '/', run: async ctx => {
    const go = async () => { await ctx.click('.ag-mc--depth', 2000) }
    await screen(ctx, 'Depth Chart', go, { skip: SKIP, depth: 2, perClass: 3, max: 12 })
    await ctx.fresh('/', ctx.storage); await go()
    await walk(ctx, 'Depth Chart', { pri: ['.dc-submit-btn:not(:disabled)', '.dc-prompt-backdrop button', /^(start|submit|next|play again|continue)/i], markers: [['.dc-prompt-backdrop', 'prompt'], ['.dc-lb-backdrop', 'leaderboard'], ['@struct', '.dc-screen']], max: 8, patience: 6000, perName: 2 })
  } },

  // ── Compete and the Trait Auction (lobbies only: nothing is joined) ─────────
  ...[['/', 'football'], ['/bucket', 'basketball']].map(([path, sport]) => ({ group: 'compete', name: `${sport} Compete and Trait Auction lobbies`, path, run: async ctx => {
    const go = async () => { await ctx.click('.ag-mc--compete', 2000) }
    await screen(ctx, `Compete (${sport})`, go, { skip: /^(ag-tab|ag-play|ag-round-btn|ntag-link|cp-go)\|/, depth: 2, perClass: 4, max: 18 })
    await ctx.fresh(path, ctx.storage); await go()
    if (await ctx.click(/^TRAIT AUCTION$/, 1200)) { await ctx.audit(`Trait Auction lobby (${sport})`); await crawl(ctx, `Trait Auction lobby (${sport})`, { enter: async () => { await ctx.fresh(path, ctx.storage); await go(); await ctx.click(/^TRAIT AUCTION$/, 1200) }, skip: /^(ag-tab|ag-play|ag-round-btn|ntag-link|cp-go|cp-mode)\|/, depth: 2, perClass: 4, max: 14 }) }
    else ctx.miss(`Trait Auction lobby (${sport})`, 'no TRAIT AUCTION switch on Compete')
  } })),

  // ── Blacktop ────────────────────────────────────────────────────────────────
  { group: 'blacktop', name: 'Blacktop: the hub and its menus (nothing is joined)', path: '/bucket', run: async ctx => {
    const go = async () => { await ctx.click('.ag-mc--blacktop, .ag-way[class*="blacktop"], .ag-way[class*="bt"]', 2200) || await ctx.click(/^BLACKTOP/, 2200) }
    await screen(ctx, 'Blacktop hub', go, { skip: SKIP, depth: 2, perClass: 4, max: 20 })
  } },
  { group: 'blacktop', name: 'Blacktop dev previews: the live game, watching, the HUD, the final, the lobby looks', path: '/bucket', run: async ctx => {
    for (const look of ['live', 'watch', 'nowatch', 'hud', 'hud&open=1', 'final']) { await ctx.open(`/bucket?btlook=${look}`); await sleep(2500); await ctx.audit(`Blacktop game preview: ${look}`) }
    for (const look of ['hub', 'hub&empty=1', 'queue', 'full', 'chat', 'teamchat', 'v1menu', 'v1host', 'v1searching', 'v1found', 'matchup', 'leave', 'oppleft', 'v1hud']) { await ctx.open(`/bucket?btlobby=${look}`); await sleep(2200); await ctx.audit(`Blacktop lobby preview: ${look}`) }
  } },

  // ── College Football ────────────────────────────────────────────────────────
  { group: 'cfb', name: 'College Football: the mode screen, the spin, a build, the season, the draft', path: '/', run: async ctx => {
    const go = async () => { await ctx.click('.ag-mc--cfb', 2200) }
    await screen(ctx, 'College Football', go, { skip: /^(ag-tab|ag-play|ag-round-btn|cfb-pos)\|/, depth: 2, perClass: 3, max: 12 })
    await ctx.fresh('/', ctx.storage); await go()
    await ctx.click('.cfb-pos', 1800)
    await ctx.audit('College Football: build (empty)')
    if (!await playBuild(ctx, { onFirst: async () => { await sleep(500); await ctx.audit('College Football: spin result') } })) { ctx.miss('College Football: the season', 'the build could not be finished by spinning'); return }
    await ctx.audit('College Football: build (complete)')
    await ctx.click('.sim-btn', 2000)
    await ctx.audit('College Football: scholarship offers')
    if (await ctx.click('button.cfbr-board-row', 800)) await ctx.audit('College Football: offers, a school picked (commit bar)')
    await ctx.click('button.cfbr-commit:not(:disabled), button.cfbs-next:not(:disabled)', 2500)
    const dots = n => [`.simp-dot:nth-child(${n}).simp-dot-active`, `season screen ${n}`]
    const end = await walk(ctx, 'College Football', { pri: ['.sm-option', '.mvp-overlay button', '.simp-cta'], markers: [1, 2, 3, 4, 5, 6, 7, 8].map(dots).concat([['.sm-moment', 'key moment'], ['.simp-cta--pin', 'pinned advance'], ['.mvp-overlay', 'award']]), max: 40, patience: 60000, until: '.simp-dot:last-child.simp-dot-active' })
    await sleep(1200)
    await ctx.audit('College Football: final report')
    if (end !== 'until') ctx.miss('College Football: the whole season', `the walk ended early (${end})`)
    // the draft, and the ways on from the final report
    if (await ctx.click(/^ENTER THE NFL DRAFT/, 1500)) { await ctx.audit('College Football: the NFL draft'); await crawl(ctx, 'College Football: the NFL draft', { enter: async () => {}, depth: 1, perClass: 3, max: 8, skip: /^(splash-site-footer-link|pp-banner|ag-icon-btn|simp-)/ }); await ctx.eval('window.__RA.closeTop()'); await sleep(600) }
    else ctx.miss('College Football: the NFL draft', 'no ENTER THE NFL DRAFT on the final report')
    if (await ctx.click(/^Transfer$/, 1500)) await ctx.audit('College Football: transfer')
  } },

  // ── the other seasons ───────────────────────────────────────────────────────
  { group: 'sim', name: 'basketball season, start to finish (guard)', path: '/bucket', run: async ctx => {
    await ctx.click('.ag-start', 1500)
    if (!await playBuild(ctx)) { ctx.miss('Season (basketball)', 'the build could not be finished by spinning'); return }
    await ctx.click('.sim-btn', 1200)
    await ctx.click(/^Pick$/, 600)
    await ctx.click('.tpm-team-btn, .nba-tpk-team, [class*="tpk"] button', 2500)
    await walk(ctx, 'Season (basketball)', { pri: ['.sm-option', '.mvp-overlay button', '.bsim-cta', '.simp-cta', '.bsim-next', /^(sim|simulate|continue|next|see |view |enter playoffs|season summary|final report|goat)/i],
      markers: [['.sm-moment', 'key moment'], ['.mvp-overlay', 'award'], ['.bsim-team-modal', 'team modal'], ['@struct', '.bsim-page'], ['@struct', '.bsim-col'], ['.simp-dot-active', 'dots']], perName: 1, max: 60, patience: 60000 })
    await ctx.audit('Season (basketball): where it ends')
  } },
  ...[['k', 'kicker'], ['wr', 'wide receiver'], ['db', 'defensive back']].map(([pos, label]) => ({ group: 'sim', name: `football season (${label}): the season start and the regular season`, path: '/', run: async ctx => {
    await seed(ctx, `build(${JSON.stringify(pos)})`)
    await ctx.open('/')
    if (!await ctx.click('.ag-resume', 1500)) { ctx.miss(`Season (${pos})`, 'the seeded build did not come back on Home'); return }
    await ctx.audit(`Build ${pos.toUpperCase()} (complete)`)
    await ctx.click('.sim-btn', 1200)
    await ctx.click(/^Pick$/, 600)
    await ctx.click('.tpm-team-btn', 2500)
    await walk(ctx, `Season (${pos})`, { pri: ['.sm-option', '.mvp-overlay button', '.simp-cta'], markers: [['.simp-dot:nth-child(1).simp-dot-active', 'season start'], ['.simp-dot:nth-child(2).simp-dot-active', 'regular season'], ['.simp-dot:nth-child(3).simp-dot-active', 'playoffs'], ['.sm-moment', 'key moment'], ['.simp-cta--pin', 'pinned advance'], ['.mvp-overlay', 'award']], perName: 1, max: 14, patience: 45000, until: '.simp-dot:nth-child(3).simp-dot-active' })
  } })),

  // ── mini games (the site takes the ads away while one is open) ──────────────
  { group: 'minigame', name: 'Practice: a mini game open (football and basketball)', path: '/', run: async ctx => {
    for (const [path, name] of [['/', 'football'], ['/bucket', 'basketball']]) {
      await ctx.open(path); await ctx.nav('mglab', 1500)
      if (!await ctx.click('.pr-row', 2500)) { ctx.miss(`Mini game (${name})`, 'no game in the Practice list'); continue }
      await ctx.audit(`Mini game (${name}): get ready`)
      if (await ctx.click('.ag-btn--gold', 2500)) await ctx.audit(`Mini game (${name}): playing`)
    }
  } },

  // ── signed in (a made-up account, the page offline: see seed.js account) ────
  ...[['/', 'football'], ['/bucket', 'basketball']].map(([path, sport]) => ({ group: 'account', name: `${sport}, signed in: Home, Profile and what it opens, Cards, Achievements, Locker, account settings`, path, storage: { __ra_offline: '1' }, run: async ctx => {
    const key = await seed(ctx, 'account()')
    await ctx.open(path); await sleep(1500)
    if (!await ctx.eval(`!document.querySelector('.coin-pill--signin')`)) { ctx.miss(`Signed in (${sport})`, `the made-up session was not taken (${key})`); return }
    await ctx.audit(`Signed in (${sport}): Home`)
    if (await ctx.has('.username-prompt, [class*="username-prompt"], [class*="uname"]')) await ctx.audit(`Signed in (${sport}): username prompt`)
    for (const [to, name] of [['profile', 'Profile'], ['cards', 'Cards'], ['achievements', 'Achievements'], ['locker', 'Locker'], ['shop', 'Shop'], ['daily', 'Daily'], ['pass', 'Builder Pass']]) {
      await ctx.open(path); await sleep(1200)
      await screen(ctx, `Signed in (${sport}): ${name}`, async () => { await ctx.nav(to, 1800) }, { skip: SKIP, depth: 2, perClass: 4, max: 20, enter: async () => { await ctx.open(path); await sleep(1200); await ctx.nav(to, 1800) } })
    }
    await ctx.open(path); await sleep(1200)
    await ctx.eval(`window.dispatchEvent(new CustomEvent('bap:menu'))`); await sleep(900)
    if (await ctx.click(/^SETTINGS/, 900)) { await ctx.audit(`Signed in (${sport}): Settings`); await crawl(ctx, `Signed in (${sport}): Settings`, { enter: async () => { await ctx.open(path); await sleep(1200); await ctx.eval(`window.dispatchEvent(new CustomEvent('bap:menu'))`); await sleep(900); await ctx.click(/^SETTINGS/, 900) }, depth: 2, perClass: 5, max: 24 }) }
  } })),

  // ── the classic look (Settings > Classic look): the old pages on --ad-h ─────
  { group: 'classic', name: 'classic look: Home, the build, a season start (football and basketball)', path: '/', storage: { bap_classic_look: '1' }, run: async ctx => {
    await ctx.audit('Classic Home (football)')
    await crawl(ctx, 'Classic Home (football)', { skip: /^(splash-site-footer-link|pp-banner|splash-minigame-btn|splash-mode|ntag-link)\|/, depth: 1, perClass: 3, max: 12 })
    await ctx.fresh('/', ctx.storage)
    if (await ctx.click('.splash-mode-classic, .splash-play-btn, [class*="splash-mode"]', 1500) || await ctx.click(/^(play|classic|current)/i, 1500)) {
      await ctx.audit('Classic build (empty)')
      for (const tab of ['.mobile-tab-bar button:nth-child(1)', '.mobile-tab-bar button:nth-child(2)']) if (await ctx.click(tab, 700)) await ctx.audit(`Classic build: tab ${tab.slice(-2, -1)}`)
      if (await playBuild(ctx)) { await ctx.audit('Classic build (complete)'); await ctx.click('.sim-btn', 1200); await ctx.click(/^Pick$/, 600); await ctx.click('.tpm-team-btn', 2500); await walk(ctx, 'Classic season', { pri: ['.sm-option', '.mvp-overlay button', '.simp-cta'], markers: [['.simp-dot:nth-child(1).simp-dot-active', 'season start'], ['.simp-dot:nth-child(2).simp-dot-active', 'regular season'], ['.simp-dot:nth-child(3).simp-dot-active', 'playoffs'], ['.simp-dot:nth-child(4).simp-dot-active', 'GOAT status'], ['.simp-dot:nth-child(5).simp-dot-active', 'final report'], ['.mvp-overlay', 'award']], max: 30, patience: 60000, until: '.simp-dot:last-child.simp-dot-active' }); await sleep(1200); await ctx.audit('Classic season: final report') }
      else ctx.miss('Classic build (complete)', 'the build could not be finished by spinning')
    } else ctx.miss('Classic build', 'no way into the build from the classic Home')
    await ctx.fresh('/bucket', ctx.storage)
    await ctx.audit('Classic Home (basketball)')
    if (await ctx.click('.splash-mode-classic', 1500)) { await ctx.audit('Classic build (basketball, empty)'); if (await playBuild(ctx)) await ctx.audit('Classic build (basketball, complete)') }
  } },
]
