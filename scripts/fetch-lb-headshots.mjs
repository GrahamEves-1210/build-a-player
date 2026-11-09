// One-time: ESPN headshots for the current linebackers (data/lbs.js).
// ESPN's own player photos only (no Wikipedia), the same source and crop as the other espn_ headshots.
// Every id is from ESPN's 2026 team rosters, matched on name and team (Nov 2026), so no name-search mix-ups.
// Never overwrites a photo already in public/headshots; a player ESPN has no photo for is left out and shows initials.
// node scripts/fetch-lb-headshots.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'headshots')
const MAP = path.join(ROOT, 'src', 'data', 'headshots.json')

// [name in lbs.js, ESPN id]
const PLAYERS = [
  // ARI
  ["Mack Wilson Sr.", '4040983'], ["Jack Gibbens", '4249739'], ["Cody Simon", '4429071'], ["Karson Sharar", '4709695'],
  // ATL
  ["Divine Deablo", '4037626'], ["Christian Harris", '4567099'], ["Kendal Daniels", '4595343'], ["Harold Perkins Jr.", '4685502'],
  // BAL
  ["Roquan Smith", '3915189'], ["Trenton Simpson", '4430831'], ["Teddye Buchanan", '4698244'], ["Jay Higgins IV", '4565350'],
  // BUF
  ["Terrel Bernard", '4259166'], ["Dorian Williams", '4568624'], ["Kaleb Elarms-Orr", '4594321'], ["Joe Andreessen", '4366349'],
  // CAR
  ["Bobby Okereke", '3117253'], ["Devin Lloyd", '4243256'], ["Tyrel Dodson", '4035232'], ["Jackson Kuwatch", '4875592'],
  // CHI
  ["T.J. Edwards", '3121544'], ["Devin Bush", '4036261'], ["Noah Sewell", '4430822'], ["D'Marco Jackson", '4241007'],
  // CIN
  ["Barrett Carter", '4431519'], ["Demetrius Knight Jr.", '4427729'], ["Oren Burks", '3051746'],
  // CLE
  ["Carson Schwesinger", '4876017'], ["Quincy Williams", '3110565'], ["Easton Mascarenas-Arnold", '5085888'], ["Winston Reid", '4251125'],
  // DAL
  ["DeMarvion Overshown", '4362088'], ["Dee Winters", '4428914'], ["Jaishawn Barham", '4685266'], ["Shemar James", '4685400'],
  // DEN
  ["Alex Singleton", '2612151'], ["Justin Strnad", '3919548'], ["Jordan Turner", '4693373'], ["Karene Reid", '4875336'],
  // DET
  ["Jack Campbell", '4569465'], ["Derrick Barnes", '4260409'], ["Malcolm Rodriguez", '4241411'], ["Trevor Nowaske", '5144894'],
  // GB
  ["Isaiah McDuffie", '4239947'], ["Nick Niemann", '4036141'], ["Ty'Ron Hopper", '4567406'], ["Zaire Franklin", '3124005'],
  // HOU
  ["Azeez Al-Shaair", '3919117'], ["Henry To'oTo'o", '4426350'], ["Jake Hansen", '4033812'], ["Wade Woodaz", '4837286'],
  // IND
  ["Akeem Davis-Gaither", '3917142'], ["Jaylon Carlies", '4601021'], ["C.J. Allen", '4870598'], ["Austin Ajiake", '4374171'],
  // JAX
  ["Foyesade Oluokun", '3050073'], ["Jahlani Tavai", '3124587'], ["Ventrell Miller", '4240610'], ["Branson Combs", '4572704'],
  // KC
  ["Nick Bolton", '4362759'], ["Drue Tranquill", '3129310'], ["Jeffrey Bassa", '4602389'], ["Jack Cochrane", '4249766'],
  // LV
  ["Quay Walker", '4379416'], ["Nakobe Dean", '4426340'], ["Tommy Eichenberg", '4429560'], ["Cody Lindenberg", '4685126'],
  // LAC
  ["Daiyan Henley", '4241597'], ["Del'Shawn Phillips", '4240528'], ["Troy Dye", '4038946'], ["Marlowe Wax", '4431467'],
  // LAR
  ["Nate Landman", '4243181'], ["Omar Speights", '4428550'], ["Shaun Dolac", '4693848'], ["Grant Stuard", '4240255'],
  // MIA
  ["Jordyn Brooks", '4043130'], ["Willie Gay Jr.", '4259804'], ["Jacob Rodriguez", '4566094'], ["Shaka Heyward", '4360413'],
  // MIN
  ["Blake Cashman", '3728281'], ["Ivan Pace Jr.", '4430280'], ["Eric Wilson", '3056916'], ["Jake Golday", '4877652'],
  // NE
  ["Robert Spillane", '3129446'], ["Christian Elliss", '4245273'], ["Darius Muasau", '4428072'], ["Namdi Obiazor", '5085407'],
  // NO
  ["Kaden Elliss", '3124890'], ["Pete Werner", '4241993'], ["Danny Stutsman", '4683215'], ["Jaylan Ford", '4566088'],
  // NYG
  ["Arvell Reese", '4950400'], ["Micah McFadden", '4371961'], ["Zaire Barnes", '4362234'], ["Malik Harrison", '4040615'],
  // NYJ
  ["Jamien Sherwood", '4361331'], ["Demario Davis", '14958'], ["Trevin Wallace", '4683815'], ["Jaden Keller", '4700756'],
  // PHI
  ["Zack Baun", '3917657'], ["Jihaad Campbell", '4685287'], ["Jeremiah Trotter Jr.", '4432777'], ["Smael Mondon Jr.", '4431573'],
  // PIT
  ["Patrick Queen", '4242207'], ["Payton Wilson", '4361652'], ["Cole Holcomb", '3116689'],
  // SF
  ["Fred Warner", '3138826'], ["Dre Greenlaw", '3916903'], ["Tatum Bethune", '4426698'], ["Garret Wallow", '4241807'],
  // SEA
  ["Ernest Jones IV", '4362851'], ["Drake Thomas", '4428659'], ["Tyrice Knight", '4686540'], ["Chazz Surratt", '4037521'],
  // TB
  ["Alex Anzalone", '3043107'], ["SirVocea Dennis", '4429511'], ["Josiah Trotter", '4870998'],
  // TEN
  ["Cody Barton", '3926229'], ["Anthony Hill Jr.", '4870805'], ["Cedric Gray", '4429834'], ["James Williams Sr.", '4431613'],
  // WAS
  ["Frankie Luvu", '3127273'], ["Sonny Styles", '5081807'], ["Jordan Magee", '4568617'], ["Kain Medrano", '4427984'],
]

let added = 0, fetched = 0
const got = []
for (const [name, id] of PLAYERS) {
  const file = path.join(OUT, `espn_${id}.webp`)
  if (!fs.existsSync(file)) {
    const url = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${id}.png&w=350&h=254&scale=crop`
    const res = await fetch(url, { headers: { 'User-Agent': 'build-a-player-data-check' } })
    const buf = Buffer.from(await res.arrayBuffer())
    if (res.status !== 200 || buf.length < 6000) { console.log(`no photo: ${name} (espn ${id})`); continue }
    await sharp(buf).webp({ quality: 75 }).toFile(file)
    fetched++
  }
  got.push([name, id])
}
// read the map right before writing it, so nothing added meanwhile is lost
const headshots = JSON.parse(fs.readFileSync(MAP, 'utf8'))
for (const [name, id] of got) if (!headshots[name]) { headshots[name] = `espn_${id}`; added++ }
else if (headshots[name] !== `espn_${id}`) console.log(`name taken by another photo, set headshot: 'espn_${id}' on the row: ${name}`)
fs.writeFileSync(MAP, JSON.stringify(headshots, null, 2) + '\n')
console.log(`${fetched} photos fetched, ${added} added to headshots.json`)
