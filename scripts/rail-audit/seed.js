// Runs in the page (the scenarios evaluate it): saves written straight into localStorage with the game's own code, so
// a scenario can open a Career in the middle of a season, at an injury, in the offseason, retired..., or a finished
// build, without playing its way there. Nothing here touches the network (a guest's saves are local).
window.__RASeed = (() => {
  const mods = async () => {
    const [C, R] = await Promise.all([import('/src/lib/career.js'), import('/src/lib/rng.js')])
    return { C, seeded: R.seeded }
  }
  // a build the way a player would have made one: a real player's rating at every trait
  const buildFor = (S, pos, r) => {
    const pool = S.pool[pos].filter(p => p.attrs)
    const b = {}
    for (const t of S.types[pos]) {
      let p = pool[Math.floor(r() * pool.length)]
      for (let j = 0; j < 5; j++) { const q = pool[Math.floor(r() * pool.length)]; if ((q.attrs?.[t] ?? 0) > (p.attrs?.[t] ?? 0)) p = q }
      b[t] = { type: t, val: p.attrs?.[t] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, height: p.height ?? null, weight: p.weight ?? null, pos: p.pos }
    }
    return b
  }
  // a career played forward (the way the Career screen drives it) until `want`:
  //   combine · drafted · preseason · week · moment · injury · bye · playoffs · book · offseason · offers · preseason2 · retired
  const drive = (C, c0, want) => {
    let c = c0, D = null
    const getD = () => (D ??= C.resumeSeason(c))
    const hit = tag => tag === want
    const done = () => (hit('retired') ? C.retire(c) : c)
    if (hit('combine')) return c
    c = C.skipCombine(c); c = C.runDraft(c)
    if (hit('drafted')) return c
    for (let y = 0; y < 24; y++) {
      if (hit('preseason') && y === 0) return { ...c, phase: 'preseason', step: null }
      ;[c, D] = C.startSeason(c)
      let guard = 0
      while (c.active.k < getD().total && guard++ < 600) {
        if (C.byeNow?.(c)) { if (hit('bye')) return c; c = C.byeRest(c, getD()); continue }
        if (c.active.injury) { if (hit('injury')) return c; const [n] = C.resolveInjury(c, getD(), false, false); c = n; continue }
        if (c.active.moment) { if (hit('moment') && c.active.k >= 1) return c; const [n] = C.chooseMoment(c, getD(), c.active.moment.options[0]); c = n; continue }
        if (hit('week') && c.active.k === 3) return c
        const [n] = C.advanceWeek(c, getD()); c = n
      }
      guard = 0
      while ((c.active.moment || c.active.injury) && guard++ < 20) {
        if (c.active.injury) { const [n] = C.resolveInjury(c, getD(), false, false); c = n } else { const [n] = C.chooseMoment(c, getD(), c.active.moment.options[0]); c = n }
      }
      if (hit('regular-done')) return c
      c = C.finishRegular(c, getD()); D = null
      if (hit('playoffs') && c.phase === 'season' && c.active?.po && c.active.po.stage !== 'done') return c
      guard = 0
      while (c.phase === 'season' && c.active?.po && c.active.po.stage !== 'done' && guard++ < 40) c = C.playoffRound(c, null)
      if (c.phase === 'season') { if (hit('book')) return c; c = C.bookSeason(c) }
      if (hit('offseason')) return c
      if (C.mustRetire(c)) return done()
      if (hit('offers') && c.offers?.length) return c
      for (let i = 0; i < 6; i++) { const ts = c.types.filter(t => C.canUpgrade(c, t)); if (!ts.length) break; c = C.spendDev(c, ts[0]) }
      if (c.offers?.length) c = C.signOffer(c, c.offers[0])
      else if (Array.isArray(c.offers)) return done()
      if (c.contract.left <= 0) return done()
      c = C.nextSeason(c)
      if (hit('preseason2')) return c
    }
    return done()
  }
  return {
    // careers(sport, pos, ['moment', 'injury', ...]): one save slot each, in order; returns what each ended up as
    careers: async (sport, pos, wants) => {
      const { C, seeded } = await mods()
      if (C.ensureSport) await C.ensureSport(sport)
      const S = C.SPORT[sport]
      const out = []
      for (const [slot, want] of wants.entries()) {
        const r = seeded(`rail-audit-${sport}-${pos}-${want}`)
        const games = want === 'combine' ? 'advanced' : 'off'
        let c = C.newCareer({ sport, uid: null, pos, build: buildFor(S, pos, r), name: ['Cole Norwood', 'Deon Price', 'Mack Tully', 'Jay Ellis', 'Rico Banks'][slot % 5], slot, owner: 'Guest', games })
        try { c = drive(C, c, want) } catch (e) { out.push(`${want}: failed (${String(e.message).slice(0, 80)})`); continue }
        C.saveCareer(c)
        out.push(`${want}: phase ${c.phase}, year ${c.year ?? '?'}${c.active?.moment ? ', moment' : ''}${c.active?.injury ? ', injury' : ''}${c.active?.po ? ', playoffs' : ''}${c.offers?.length ? ', offers' : ''}`)
      }
      return out
    },
    // a made-up signed-in player, for the screens only an account sees. Used with the page offline (__ra_offline: the
    // audit answers every request itself), so this is not a sign-in: no server ever hears of it
    account: async (username = 'RailAudit') => {
      const { supabase } = await import('/src/lib/supabase.js')
      if (!supabase) return 'no supabase client in this build'
      const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
      const now = Math.floor(Date.now() / 1000), id = '00000000-0000-4000-8000-00000000a0d1'
      const user = { id, aud: 'authenticated', role: 'authenticated', email: 'rail-audit@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { username, display_name: username }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      const session = { access_token: `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: id, role: 'authenticated', aud: 'authenticated', exp: now + 86400, iat: now })}.audit`, token_type: 'bearer', expires_in: 86400, expires_at: now + 86400, refresh_token: 'rail-audit', user }
      localStorage.setItem(supabase.auth.storageKey, JSON.stringify(session))
      return supabase.auth.storageKey
    },
    // a finished football build in the build screen's own save (Home's CONTINUE resumes it)
    build: async (pos = 'qb', mode = 'classic') => {
      const { C, seeded } = await mods()
      const build = buildFor(C.SPORT.nfl, pos, seeded(`rail-audit-build-${pos}`))
      localStorage.setItem('bap_progress', JSON.stringify({ gameMode: mode, position: pos, build }))
      return Object.keys(build).length
    },
  }
})()
