#!/usr/bin/env node
// Fetches current NBA rosters from ESPN + applies hand-crafted ratings
// Run: node scripts/generate-nba-players.mjs

import { writeFileSync } from 'fs'
import { join } from 'path'

const SHORT_MAP = {
  'Atlanta Hawks':'ATL','Boston Celtics':'BOS','Brooklyn Nets':'BKN',
  'Charlotte Hornets':'CHA','Chicago Bulls':'CHI','Cleveland Cavaliers':'CLE',
  'Dallas Mavericks':'DAL','Denver Nuggets':'DEN','Detroit Pistons':'DET',
  'Golden State Warriors':'GSW','Houston Rockets':'HOU','Indiana Pacers':'IND',
  'LA Clippers':'LAC','Los Angeles Clippers':'LAC','Los Angeles Lakers':'LAL',
  'Memphis Grizzlies':'MEM','Miami Heat':'MIA','Milwaukee Bucks':'MIL',
  'Minnesota Timberwolves':'MIN','New Orleans Pelicans':'NOP',
  'New York Knicks':'NYK','Oklahoma City Thunder':'OKC','Orlando Magic':'ORL',
  'Philadelphia 76ers':'PHI','Phoenix Suns':'PHX','Portland Trail Blazers':'POR',
  'Sacramento Kings':'SAC','San Antonio Spurs':'SAS','Toronto Raptors':'TOR',
  'Utah Jazz':'UTA','Washington Wizards':'WAS',
}

// speed, ath, size, shoot, handle, play, def, iq, ldr | starter, captain, short
const KNOWN = {
  // ── Superstars ───────────────────────────────────────────────────────────────
  'Stephen Curry':           { r:[9,8,5,11,10,9,6,10,9], s:true, c:true,  short:'Curry' },
  'Nikola Jokic':            { r:[4,5,9,8,8,11,7,11,9], s:true, c:true,  short:'Jokic' },
  'Giannis Antetokounmpo':   { r:[11,11,10,6,7,8,10,8,9], s:true, c:true, short:'Giannis' },
  'Shai Gilgeous-Alexander': { r:[9,9,8,9,10,9,8,9,8], s:true, c:true,  short:'SGA' },
  'Jayson Tatum':            { r:[8,9,8,10,8,8,8,8,8], s:true, c:true,  short:'Tatum' },
  'Victor Wembanyama':       { r:[9,10,11,8,8,7,11,8,7], s:true, c:true, short:'Wemby' },
  'Anthony Edwards':         { r:[10,11,8,9,9,7,8,7,8], s:true, c:true,  short:'Ant' },
  'Luka Doncic':             { r:[6,7,8,10,10,11,5,10,8], s:true, c:true, short:'Luka' },
  'Kevin Durant':            { r:[9,9,10,11,9,8,7,9,7], s:true, c:true,  short:'Durant' },
  'Donovan Mitchell':        { r:[9,9,6,9,8,8,7,8,8], s:true, c:true,  short:'Mitchell' },
  'Ja Morant':               { r:[11,11,6,7,9,9,6,7,7], s:true, c:true,  short:'Morant' },
  'Tyrese Haliburton':       { r:[8,7,7,8,9,10,6,9,8], s:true, c:true,  short:'Haliburton' },
  'Devin Booker':            { r:[8,8,7,10,8,8,6,8,8], s:true, c:true,  short:'Booker' },
  'De\'Aaron Fox':           { r:[11,9,7,7,9,8,7,7,7], s:true, c:true,  short:'Fox' },
  'LaMelo Ball':             { r:[8,7,8,8,9,10,5,8,6], s:true, c:true,  short:'LaMelo' },
  'Karl-Anthony Towns':      { r:[7,8,10,9,7,7,6,7,7], s:true, c:true,  short:'KAT' },
  'Paolo Banchero':          { r:[7,9,9,8,8,8,7,7,7], s:true, c:true,  short:'Banchero' },
  'Zion Williamson':         { r:[8,11,10,7,7,7,7,7,6], s:true, c:true, short:'Zion' },
  'Damian Lillard':          { r:[8,8,6,10,9,9,6,8,8], s:true, c:true,  short:'Lillard' },
  'Trae Young':              { r:[7,6,4,10,10,10,3,9,7], s:true, c:true, short:'Trae' },
  'Anthony Davis':           { r:[8,10,10,7,6,6,10,8,7], s:true, c:true, short:'A. Davis' },
  'Bam Adebayo':             { r:[8,10,9,6,6,7,10,8,8], s:true, c:true,  short:'Adebayo' },
  'Jaren Jackson Jr.':       { r:[7,8,10,8,5,5,10,7,6], s:true, c:true,  short:'JJJ' },
  'Scottie Barnes':          { r:[9,10,9,7,7,8,8,8,8], s:true, c:true,  short:'Barnes' },
  'Cooper Flagg':            { r:[8,9,9,7,7,7,8,8,7], s:true, c:true,  short:'Flagg' },
  'AJ Dybantsa':             { r:[8,9,8,7,7,7,7,7,7], s:true, c:false, short:'Dybantsa' },

  // ── Solid Stars ──────────────────────────────────────────────────────────────
  'Jaylen Brown':            { r:[9,10,8,8,7,6,8,7,7], s:true, c:false, short:'J. Brown' },
  'Draymond Green':          { r:[7,8,7,5,6,9,10,10,10], s:true, c:false, short:'Draymond' },
  'James Harden':            { r:[6,7,7,10,10,10,4,9,6], s:true, c:false, short:'Harden' },
  'Kawhi Leonard':           { r:[8,9,8,9,8,7,10,9,7], s:true, c:false, short:'Kawhi' },
  'Rudy Gobert':             { r:[5,8,11,4,4,4,11,8,7], s:true, c:false, short:'Gobert' },
  'Evan Mobley':             { r:[8,9,10,7,6,6,9,8,7], s:true, c:false, short:'Mobley' },
  'Franz Wagner':            { r:[8,8,8,8,7,8,7,8,7], s:true, c:false, short:'F. Wagner' },
  'Brandon Ingram':          { r:[8,8,9,8,7,7,6,7,6], s:true, c:false, short:'Ingram' },
  'Jalen Green':             { r:[10,9,7,9,9,7,6,7,6], s:true, c:false, short:'J. Green' },
  'Tyler Herro':             { r:[7,7,6,9,8,7,5,7,6], s:true, c:false, short:'Herro' },
  'Darius Garland':          { r:[8,7,5,8,9,9,5,8,7], s:true, c:false, short:'Garland' },
  'Cade Cunningham':         { r:[8,8,8,8,9,9,7,8,7], s:true, c:false, short:'Cunningham' },
  'Alperen Sengun':          { r:[6,7,9,7,6,7,7,8,6], s:true, c:false, short:'Sengun' },
  'Chet Holmgren':           { r:[7,7,10,8,6,6,9,8,6], s:true, c:false, short:'Holmgren' },
  'Zach LaVine':             { r:[9,10,7,9,8,7,5,7,6], s:true, c:false, short:'LaVine' },
  'Pascal Siakam':           { r:[8,9,9,8,7,7,7,7,7], s:true, c:false, short:'Siakam' },
  'Lauri Markkanen':         { r:[6,7,10,9,5,5,6,7,6], s:true, c:false, short:'Markkanen' },
  'Dejounte Murray':         { r:[8,8,7,7,8,8,8,7,7], s:true, c:false, short:'D. Murray' },
  'CJ McCollum':             { r:[8,7,6,9,8,7,5,8,6], s:true, c:false, short:'McCollum' },
  'RJ Barrett':              { r:[8,8,8,7,7,7,7,7,7], s:true, c:false, short:'Barrett' },
  'Kristaps Porzingis':      { r:[6,7,11,9,5,5,8,7,6], s:true, c:false, short:'Porzingis' },
  'Jrue Holiday':            { r:[8,8,7,7,7,7,9,8,7], s:true, c:false, short:'Holiday' },
  'Deandre Ayton':           { r:[6,8,10,7,5,5,7,6,5], s:true, c:false, short:'Ayton' },
  'Anfernee Simons':         { r:[8,8,6,9,8,7,5,7,5], s:true, c:false, short:'Simons' },
  'Scoot Henderson':         { r:[10,9,6,6,8,8,6,7,6], s:true, c:false, short:'Scoot' },
  'Marcus Smart':            { r:[7,8,6,6,7,7,9,8,7], s:true, c:false, short:'Smart' },
  'Desmond Bane':            { r:[7,7,7,9,7,6,7,7,6], s:true, c:false, short:'Bane' },
  'Coby White':              { r:[8,7,6,8,8,7,5,7,6], s:true, c:false, short:'C. White' },
  'Andrew Nembhard':         { r:[7,7,6,7,7,7,7,7,6], s:true, c:false, short:'Nembhard' },
  'Myles Turner':            { r:[5,7,10,7,4,4,9,7,6], s:true, c:false, short:'M. Turner' },
  'Devin Vassell':           { r:[8,8,7,8,7,6,7,7,6], s:true, c:false, short:'Vassell' },
  'Jeremy Sochan':           { r:[7,9,8,6,7,6,8,7,6], s:true, c:false, short:'Sochan' },
  'Bilal Coulibaly':         { r:[9,9,8,6,7,6,8,7,6], s:true, c:false, short:'Coulibaly' },
  'Kyle Kuzma':              { r:[7,8,8,7,6,5,5,6,5], s:true, c:false, short:'Kuzma' },
  'Immanuel Quickley':       { r:[7,7,6,8,7,7,6,7,6], s:true, c:false, short:'Quickley' },
  'Kyrie Irving':            { r:[9,9,6,10,11,8,6,8,5], s:true, c:false, short:'Kyrie' },
  'Paul George':             { r:[8,9,8,9,7,7,9,8,7], s:true, c:false, short:'PG' },
  'Klay Thompson':           { r:[7,8,7,10,6,5,8,7,7], s:true, c:false, short:'Klay' },
  'Nikola Vucevic':          { r:[4,6,9,7,5,5,6,7,5], s:true, c:false, short:'Vucevic' },
  'Keldon Johnson':          { r:[8,8,7,7,6,6,7,6,5], s:true, c:false, short:'K. Johnson' },
  'Shaedon Sharpe':          { r:[10,9,7,8,8,7,6,6,5], s:true, c:false, short:'Sharpe' },
  'Jabari Smith Jr.':        { r:[7,9,9,7,5,5,7,7,6], s:true, c:false, short:'J. Smith' },
  'Amen Thompson':           { r:[10,10,8,5,7,7,8,7,6], s:true, c:false, short:'A. Thompson' },
  'Cam Thomas':              { r:[7,7,7,9,8,7,5,7,6], s:true, c:false, short:'C. Thomas' },
  'Mikal Bridges':           { r:[8,8,8,8,6,6,8,7,6], s:true, c:false, short:'M. Bridges' },
  'Josh Hart':               { r:[7,8,7,6,6,6,7,7,6], s:true, c:false, short:'Hart' },
  'OG Anunoby':              { r:[8,9,8,7,6,5,9,7,6], s:true, c:false, short:'OG' },
  'Isaiah Hartenstein':      { r:[6,7,9,5,5,5,8,7,5], s:true, c:false, short:'Hartenstein' },
  'Josh Giddey':             { r:[8,7,8,6,7,8,6,7,6], s:true, c:false, short:'Giddey' },
  'Jaden Ivey':              { r:[9,9,7,7,8,7,6,6,5], s:true, c:false, short:'J. Ivey' },
  'Miles Bridges':           { r:[8,9,8,7,6,6,7,6,5], s:true, c:false, short:'Bridges' },
  'Jimmy Butler':            { r:[8,8,7,7,7,8,9,8,10], s:true, c:false, short:'Butler' },
  'Bobby Portis':            { r:[6,8,9,7,4,4,7,6,5], s:true, c:false, short:'Portis' },
  'Khris Middleton':         { r:[7,7,8,9,7,7,7,8,7], s:true, c:false, short:'Middleton' },
  'Brook Lopez':             { r:[5,7,10,7,4,4,8,7,6], s:true, c:false, short:'B. Lopez' },
  'Bradley Beal':            { r:[7,8,7,9,8,7,5,7,6], s:true, c:false, short:'Beal' },
  'Grayson Allen':           { r:[7,7,6,8,6,5,6,6,5], s:true, c:false, short:'G. Allen' },
  'Norman Powell':           { r:[8,8,7,9,7,6,6,6,5], s:true, c:false, short:'Powell' },
  'Ivica Zubac':             { r:[5,7,10,6,4,4,7,7,5], s:true, c:false, short:'Zubac' },
  'Brandon Miller':          { r:[8,8,8,8,7,6,6,7,6], s:true, c:false, short:'B. Miller' },
  'Mark Williams':           { r:[5,8,10,5,4,4,8,6,5], s:true, c:false, short:'M. Williams' },
  'LiAngelo Ball':           { r:[5,6,6,6,6,5,4,5,4], s:false, c:false, short:'LiAngelo' },
  'Toumani Camara':          { r:[8,8,8,6,6,6,7,7,5], s:true, c:false, short:'Camara' },
  'Santi Aldama':            { r:[7,7,9,7,5,5,6,7,5], s:true, c:false, short:'Aldama' },
  'John Collins':            { r:[7,9,9,7,5,5,6,6,5], s:true, c:false, short:'Collins' },
  'Collin Sexton':           { r:[8,8,5,8,8,7,5,7,6], s:true, c:false, short:'Sexton' },
  'Lauri Markkanen':         { r:[6,7,10,9,5,5,6,7,6], s:true, c:false, short:'Markkanen' },
  'Jordan Clarkson':         { r:[7,7,6,8,7,6,4,6,5], s:false, c:false, short:'Clarkson' },
  'Zach Collins':            { r:[5,7,9,6,4,4,6,6,4], s:false, c:false, short:'Z. Collins' },
  'Keyonte George':          { r:[8,8,6,7,8,7,5,6,5], s:true, c:false, short:'K. George' },
  'Taylor Hendricks':        { r:[7,8,9,6,5,5,7,6,5], s:true, c:false, short:'Hendricks' },
  'Nikola Jovic':            { r:[6,7,9,7,5,6,5,7,5], s:true, c:false, short:'N. Jovic' },
  'Jaime Jaquez Jr.':        { r:[7,8,7,7,6,6,7,7,6], s:true, c:false, short:'Jaquez' },
  'Wendell Carter Jr.':      { r:[5,7,9,5,4,4,7,7,5], s:true, c:false, short:'W. Carter' },
  'Cole Anthony':            { r:[7,7,6,7,7,7,5,6,5], s:false, c:false, short:'Cole Anthony' },
  'Markelle Fultz':          { r:[7,7,6,6,7,7,5,6,5], s:false, c:false, short:'Fultz' },
  'Deni Avdija':             { r:[7,8,8,6,6,7,7,7,6], s:true, c:false, short:'Avdija' },
  'Jalen Suggs':             { r:[8,8,7,6,7,7,7,7,6], s:true, c:false, short:'Suggs' },
  'Ty Jerome':               { r:[7,6,6,8,7,7,5,7,5], s:false, c:false, short:'Jerome' },
  'Luguentz Dort':           { r:[7,8,7,6,6,6,9,6,5], s:true, c:false, short:'Dort' },
  'Isaiah Joe':              { r:[7,7,6,8,6,6,5,6,4], s:false, c:false, short:'I. Joe' },
  'Kenrich Williams':        { r:[7,7,7,5,5,5,7,6,5], s:false, c:false, short:'K. Williams' },
  'Aaron Nesmith':           { r:[8,8,7,7,6,5,7,6,5], s:true, c:false, short:'Nesmith' },
  'Obi Toppin':              { r:[8,9,8,7,5,5,5,5,4], s:false, c:false, short:'Toppin' },
  'Jalen Brunson':           { r:[7,7,6,9,8,9,6,8,7], s:true, c:false, short:'Brunson' },
  'Donte DiVincenzo':        { r:[7,7,6,8,6,6,6,6,5], s:false, c:false, short:'DiVincenzo' },
  'Julius Randle':           { r:[7,8,9,7,6,7,6,6,6], s:true, c:false, short:'Randle' },
  'Mitchell Robinson':       { r:[5,9,10,3,3,3,8,5,4], s:false, c:false, short:'Robinson' },
  'Tyrese Maxey':            { r:[9,8,6,8,8,7,6,7,6], s:true, c:false, short:'Maxey' },
  'Tobias Harris':           { r:[7,7,8,7,6,6,6,7,6], s:false, c:false, short:'T. Harris' },
  'Kelly Oubre Jr.':         { r:[7,8,7,7,6,5,7,6,5], s:false, c:false, short:'Oubre' },
  'Joel Embiid':             { r:[6,8,11,9,7,7,9,8,7], s:true, c:true, short:'Embiid' },
  'Domantas Sabonis':        { r:[5,7,10,7,7,8,7,8,7], s:true, c:false, short:'Sabonis' },
  'Harrison Barnes':         { r:[7,7,8,7,6,5,6,6,5], s:false, c:false, short:'H. Barnes' },
  'Kevin Huerter':           { r:[7,7,7,8,6,6,5,6,5], s:false, c:false, short:'Huerter' },
  'Keon Ellis':              { r:[8,8,7,7,7,6,8,6,5], s:false, c:false, short:'K. Ellis' },
  'Alex Caruso':             { r:[8,8,7,6,6,6,9,7,6], s:true, c:false, short:'Caruso' },
  'Nikola Jovic':            { r:[6,7,9,7,5,6,5,7,5], s:true, c:false, short:'N. Jovic' },
}

// Position-based defaults for unlisted players
// [speed, ath, size, shoot, handle, play, def, iq, ldr]
const POS_DEF = {
  PG:  { r:[7,7,5,6,7,7,5,6,5], s:false, c:false },
  SG:  { r:[7,7,6,7,6,6,5,6,5], s:false, c:false },
  SF:  { r:[7,7,7,6,5,5,6,6,5], s:false, c:false },
  PF:  { r:[6,7,8,5,4,4,6,6,5], s:false, c:false },
  C:   { r:[4,6,9,4,3,3,7,6,5], s:false, c:false },
  G:   { r:[7,7,5,6,7,6,5,6,5], s:false, c:false },
  F:   { r:[7,7,8,6,5,5,6,6,5], s:false, c:false },
  FC:  { r:[5,7,9,5,4,4,6,6,5], s:false, c:false },
  GF:  { r:[7,7,7,6,6,6,6,6,5], s:false, c:false },
  DEFAULT: { r:[7,7,7,6,6,6,6,6,5], s:false, c:false },
}

function toAttrs(r) {
  return { speed:r[0], athleticism:r[1], size:r[2], shooting:r[3], handles:r[4], playmaking:r[5], defense:r[6], iq:r[7], leadership:r[8] }
}

function shortName(fullName) {
  const parts = fullName.split(' ')
  return parts.length > 1 ? parts[parts.length - 1] : parts[0]
}

// Step 1 — fetch team IDs
const teamsRes = await fetch('https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=32')
const teamsData = await teamsRes.json()
const teams = teamsData.sports[0].leagues[0].teams.map(t => ({
  id: t.team.id,
  name: t.team.displayName,
  short: SHORT_MAP[t.team.displayName] ?? t.team.abbreviation,
}))

console.log(`Found ${teams.length} teams`)

// Step 2 — fetch all rosters
const allPlayers = []
for (const team of teams) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`
  const res = await fetch(url)
  if (!res.ok) { console.error(`FAILED ${team.short}: ${res.status}`); continue }
  const data = await res.json()
  const athletes = data.athletes ?? []
  const players = athletes.flatMap(g => g.items ?? g.athletes ?? [g]).filter(p => p?.fullName)
  for (const p of players) {
    allPlayers.push({ name: p.fullName, team: team.short, pos: p.position?.abbreviation ?? 'F' })
  }
  console.log(`✓ ${team.short.padEnd(4)} — ${players.length} players`)
}

console.log(`\nTotal players: ${allPlayers.length}`)

// Step 3 — build player objects
const output = allPlayers.map(p => {
  const known = KNOWN[p.name]
  if (known) {
    return {
      name: p.name,
      short: known.short,
      team: p.team,
      starter: known.s,
      captain: known.c,
      attrs: toAttrs(known.r),
    }
  }
  // Position-based default
  const pos = POS_DEF[p.pos] ?? POS_DEF.DEFAULT
  return {
    name: p.name,
    short: shortName(p.name),
    team: p.team,
    starter: pos.s,
    captain: pos.c,
    attrs: toAttrs(pos.r),
  }
})

// Step 4 — write file
const header = `// Auto-generated by scripts/generate-nba-players.mjs
// ${new Date().toISOString().slice(0,10)} — ${output.length} players from ESPN live rosters

export const NBA_TEAMS = [
  { short: 'ATL', name: 'Atlanta Hawks',           color: '#E03A3E', color2: '#C1D32F' },
  { short: 'BOS', name: 'Boston Celtics',          color: '#007A33', color2: '#BA9653' },
  { short: 'BKN', name: 'Brooklyn Nets',           color: '#000000', color2: '#FFFFFF' },
  { short: 'CHA', name: 'Charlotte Hornets',       color: '#1D1160', color2: '#00788C' },
  { short: 'CHI', name: 'Chicago Bulls',           color: '#CE1141', color2: '#000000' },
  { short: 'CLE', name: 'Cleveland Cavaliers',     color: '#6F263D', color2: '#FFB81C' },
  { short: 'DAL', name: 'Dallas Mavericks',        color: '#00538C', color2: '#002B5E' },
  { short: 'DEN', name: 'Denver Nuggets',          color: '#0E2240', color2: '#FEC524' },
  { short: 'DET', name: 'Detroit Pistons',         color: '#C8102E', color2: '#1D42BA' },
  { short: 'GSW', name: 'Golden State Warriors',   color: '#1D428A', color2: '#FFC72C' },
  { short: 'HOU', name: 'Houston Rockets',         color: '#CE1141', color2: '#000000' },
  { short: 'IND', name: 'Indiana Pacers',          color: '#002D62', color2: '#FDBB30' },
  { short: 'LAC', name: 'LA Clippers',             color: '#C8102E', color2: '#1D428A' },
  { short: 'LAL', name: 'Los Angeles Lakers',      color: '#552583', color2: '#FDB927' },
  { short: 'MEM', name: 'Memphis Grizzlies',       color: '#5D76A9', color2: '#12173F' },
  { short: 'MIA', name: 'Miami Heat',              color: '#98002E', color2: '#F9A01B' },
  { short: 'MIL', name: 'Milwaukee Bucks',         color: '#00471B', color2: '#EEE1C6' },
  { short: 'MIN', name: 'Minnesota Timberwolves',  color: '#0C2340', color2: '#236192' },
  { short: 'NOP', name: 'New Orleans Pelicans',    color: '#0C2340', color2: '#C8102E' },
  { short: 'NYK', name: 'New York Knicks',         color: '#006BB6', color2: '#F58426' },
  { short: 'OKC', name: 'Oklahoma City Thunder',   color: '#007AC1', color2: '#EF3B24' },
  { short: 'ORL', name: 'Orlando Magic',           color: '#0077C0', color2: '#C4CED4' },
  { short: 'PHI', name: 'Philadelphia 76ers',      color: '#006BB6', color2: '#ED174C' },
  { short: 'PHX', name: 'Phoenix Suns',            color: '#1D1160', color2: '#E56020' },
  { short: 'POR', name: 'Portland Trail Blazers',  color: '#E03A3E', color2: '#000000' },
  { short: 'SAC', name: 'Sacramento Kings',        color: '#5A2D81', color2: '#63727A' },
  { short: 'SAS', name: 'San Antonio Spurs',       color: '#000000', color2: '#C4CED4' },
  { short: 'TOR', name: 'Toronto Raptors',         color: '#CE1141', color2: '#000000' },
  { short: 'UTA', name: 'Utah Jazz',               color: '#002B5C', color2: '#00471B' },
  { short: 'WAS', name: 'Washington Wizards',      color: '#002B5C', color2: '#E31837' },
]

export const BUCKET_CATEGORIES = [
  { id: 'physical', label: 'Physical', types: ['speed', 'athleticism', 'size'] },
  { id: 'skill',    label: 'Skill',    types: ['shooting', 'handles', 'playmaking'] },
  { id: 'mental',   label: 'Mental',   types: ['defense', 'iq', 'leadership'] },
]

export const BUCKET_TYPES      = ['speed', 'athleticism', 'size', 'shooting', 'handles', 'playmaking', 'defense', 'iq', 'leadership']
export const BUCKET_LITE_TYPES = ['speed', 'athleticism', 'size', 'shooting']

export const BUCKET_ATTR = {
  'speed':       { label: 'Speed',            shortLabel: 'SPD',  category: 'physical', hex: '#f87171' },
  'athleticism': { label: 'Athleticism',      shortLabel: 'ATH',  category: 'physical', hex: '#fb923c' },
  'size':        { label: 'Size/Frame',       shortLabel: 'SIZE', category: 'physical', hex: '#fbbf24' },
  'shooting':    { label: 'Shooting',         shortLabel: 'SHT',  category: 'skill',    hex: '#34d399' },
  'handles':     { label: 'Ball Handling',    shortLabel: 'HND',  category: 'skill',    hex: '#60a5fa' },
  'playmaking':  { label: 'Playmaking',       shortLabel: 'PLY',  category: 'skill',    hex: '#a78bfa' },
  'defense':     { label: 'Defense',          shortLabel: 'DEF',  category: 'mental',   hex: '#38bdf8' },
  'iq':          { label: 'Basketball IQ',   shortLabel: 'IQ',   category: 'mental',   hex: '#e879f9' },
  'leadership':  { label: 'Leadership/Clutch', shortLabel: 'LDR', category: 'mental',   hex: '#f472b6' },
}

`

const playerLines = output.map(p => {
  const a = p.attrs
  return `  { name: ${JSON.stringify(p.name)}, short: ${JSON.stringify(p.short)}, team: '${p.team}', starter: ${p.starter}, captain: ${p.captain},\n    attrs: { speed:${a.speed}, athleticism:${a.athleticism}, size:${a.size}, shooting:${a.shooting}, handles:${a.handles}, playmaking:${a.playmaking}, defense:${a.defense}, iq:${a.iq}, leadership:${a.leadership} } },`
}).join('\n')

const footer = `
export function pickThreePlayers(exclude = []) {
  const pool = NBA_PLAYERS.filter(p => !exclude.includes(p.name))
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}
`

const content = `${header}export const NBA_PLAYERS = [\n${playerLines}\n]\n${footer}`

const outPath = join(process.cwd(), 'src', 'data', 'nba-players.js')
writeFileSync(outPath, content, 'utf8')
console.log(`\nWrote ${output.length} players to src/data/nba-players.js`)
