// One-time: ESPN headshots for the kickers (data/ks.js) and the all-time kickers ESPN has a player photo for (data/k-legends.js).
// ESPN's own player photos only (no Wikipedia), the same source and crop as the other espn_ headshots.
// Current ids are from ESPN's 2026 team rosters, matched on name and team (Nov 10, 2026). Legend ids were matched by hand
// and every photo looked at: none is a coach, a namesake or a blank. Many show him in a later team's jersey (Vinatieri in
// Colts blue, Koo as a Giant, Dawson as a Cardinal, Bailey as a Viking, Prater as a Bill, Janikowski as a Seahawk, Folk as a Falcon).
// No ESPN player photo, so they show initials: every kicker before the 1990s, plus Andersen, Stover, Christie, Butler, Elam,
// Murray, Jacke, Vanderjagt, Biasucci, Hollis, Lowery, Wilkins, Stoyanovich, Gary Anderson, Norm Johnson, Gramatica, Del Greco, Lohmiller.
// Never overwrites a photo already in public/headshots; none of these names is anyone else's in headshots.json.
// node scripts/fetch-k-headshots.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'headshots')
const MAP = path.join(ROOT, 'src', 'data', 'headshots.json')

// [name in ks.js, ESPN id]
const CURRENT = [
  ["Chad Ryland", '4363538'], ["Jake Moody", '4372066'], ["Tyler Loop", '4697745'], ["Tyler Bass", '3917232'],
  ["Ryan Fitzgerald", '4568263'], ["Cairo Santos", '17427'], ["Evan McPherson", '4360234'], ["Andre Szmyt", '4258620'],
  ["Brandon Aubrey", '3953687'], ["Wil Lutz", '2985659'], ["Jake Bates", '4689936'], ["Trey Smack", '4869461'],
  ["Ka'imi Fairbairn", '2971573'], ["Spencer Shrader", '4571557'], ["Cam Little", '4686361'], ["Harrison Butker", '3055899'],
  ["Matt Gay", '4249087'], ["Cameron Dicker", '4362081'], ["Brandon McManus", '16339'], ["Joshua Karty", '4566192'],
  ["Zane Gonzalez", '3043234'], ["Will Reichard", '4567104'], ["Andy Borregales", '4569923'], ["Charlie Smyth", '5208518'],
  ["Dominic Zvada", '5082424'], ["Jason Sanders", '3124679'], ["Jake Elliott", '3050478'], ["Chris Boswell", '17372'],
  ["Eddy Pineiro", '4034949'], ["Jason Myers", '2473037'], ["Chase McLaughlin", '3150744'], ["Joey Slye", '3124084'],
  ["Drew Stevens", '5081335'],
]
// [name in k-legends.js, ESPN id] (the active kickers who are also legends are in CURRENT)
const LEGENDS = [
  ["Neil Rackers", '2300'], ["Jay Feely", '2548'], ["Matt Bryant", '4333'], ["Younghoe Koo", '3049899'],
  ["Justin Tucker", '15683'], ["Rian Lindell", '2489'], ["John Kasay", '139'], ["Graham Gano", '12460'],
  ["Robbie Gould", '9354'], ["Shayne Graham", '3504'], ["Phil Dawson", '1440'], ["Dan Bailey", '14322'],
  ["Matt Prater", '11122'], ["Jason Hanson", '286'], ["Mason Crosby", '10636'], ["Ryan Longwell", '1328'],
  ["Kris Brown", '1981'], ["Adam Vinatieri", '1097'], ["Josh Scobee", '5662'], ["Josh Lambo", '2998120'],
  ["Sebastian Janikowski", '2148'], ["Daniel Carlson", '3051909'], ["John Carney", '43'], ["Nate Kaeding", '5590'],
  ["Greg Zuerlein", '14993'], ["Olindo Mare", '1170'], ["Stephen Gostkowski", '9704'], ["Lawrence Tynes", '3413'],
  ["Nick Folk", '10621'], ["David Akers", '1716'], ["Jeff Reed", '4399'], ["Steven Hauschka", '11923'],
  ["Connor Barth", '11737'], ["Rob Bironas", '9235'], ["Dustin Hopkins", '15965'],
]

const headshots = JSON.parse(fs.readFileSync(MAP, 'utf8'))
let added = 0
for (const [name, id] of [...CURRENT, ...LEGENDS]) {
  const file = path.join(OUT, `espn_${id}.webp`)
  if (!fs.existsSync(file)) {
    const url = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${id}.png&w=350&h=254&scale=crop`
    const res = await fetch(url, { headers: { 'User-Agent': 'build-a-player-data-check' } })
    const buf = Buffer.from(await res.arrayBuffer())
    if (res.status !== 200 || buf.length < 6000) { console.log(`no photo: ${name} (espn ${id})`); continue }
    await sharp(buf).webp({ quality: 75 }).toFile(file)
  }
  if (name && !headshots[name]) { headshots[name] = `espn_${id}`; added++ }
}
fs.writeFileSync(MAP, JSON.stringify(headshots, null, 2) + '\n')
console.log(`${added} added to headshots.json`)
