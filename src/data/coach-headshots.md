# Coach headshots

Fetched 2026-11-14 for Franchise mode. Names match `src/data/nfl-coaches.js`; the map is `coach-headshots.json`.

Rule followed: clean front-facing studio headshots only. No Wikipedia, no sideline/game/press-conference/Hall of Fame/fan photos.
Every file below was opened and looked at before it was kept. Photos are only resized (to fit inside 260x190, aspect kept,
no crop) and converted to webp with sharp.

## Sources

1. **ESPN**: `https://a.espncdn.com/i/headshots/nfl/coaches/65/<espn coach id>.png` (600x436 transparent cutout, the same
   framing as the player headshots). ESPN coach ids come from `sports.core.api.espn.com/v2/sports/football/leagues/nfl/coaches/<id>`.
   ESPN has this large photo for only a handful of coaches (all uploaded 2018-2019). For most others its `headshot` field
   points at a 65x90 thumbnail (`.../coaches/65/<id>.jpg`), too small to use, and most coordinators have no ESPN photo at all.
2. **Team site**: the team's official coaches page (`/team/coaches-roster/`), original upload of the card portrait on
   `static.clubs.nfl.com` (the team's own squared crop transform stripped). These are AP / team studio headshots on a
   plain backdrop. Most are 16:9 or 3:2, so they come out 260x146 to 260x173; square ones 190x190.

## Counts

| | HC | OC | DC |
|---|---|---|---|
| ESPN | 8 | 2 | 0 |
| Team site | 24 | 30 | 32 |
| Total (of 32) | 32 | 32 | 32 |

Free-agent coaches (`COACH_FREE_AGENTS`): 7 of 27, ESPN only (they have no team page).

## Notes

- ESPN photos are old (2018-2019) and several show the coach's previous team: Mike Vrabel (Titans), John Harbaugh (Ravens),
  Mike McCarthy (Packers), Dan Quinn (Falcons), Sean Payton (Saints). Frank Reich and Matt Nagy are older photos without their current team gear.
  Each of their current teams' sites has a current studio portrait if the up-to-date uniform matters more than the source order.
- Matt LaFleur (GB): the Packers' photo is a studio portrait on a mottled backdrop, a little more styled than the others.
- Tampa Bay has no defensive coordinator; George Edwards' photo is from his Buccaneers card (Pass Game Coordinator).
- Todd Wash (CAR) is listed by the Panthers as interim defensive coordinator.

## Per coach

| Coach | Job | Source | Image | Size |
|---|---|---|---|---|
| Mike LaFleur | ARI HC | Team site | https://static.clubs.nfl.com/image/upload/cardinals/oslbhmncmtr07ff5mnwu.jpg (from https://www.azcardinals.com/team/coaches-roster/) | 260x146 |
| Nathaniel Hackett | ARI OC | Team site | https://static.clubs.nfl.com/image/upload/cardinals/tchepdqw3hk9q7h6ihya.jpg (from https://www.azcardinals.com/team/coaches-roster/) | 260x146 |
| Nick Rallis | ARI DC | Team site | https://static.clubs.nfl.com/image/upload/cardinals/ugrljxo7lhbf7veqghbu.jpg (from https://www.azcardinals.com/team/coaches-roster/) | 260x146 |
| Kevin Stefanski | ATL HC | Team site | https://static.clubs.nfl.com/image/upload/falcons/hive6yboznqujosi0t6a.jpg (from https://www.atlantafalcons.com/team/coaches-roster/) | 260x173 |
| Tommy Rees | ATL OC | Team site | https://static.clubs.nfl.com/image/upload/falcons/basdki1ygra8efjkn2dl.jpg (from https://www.atlantafalcons.com/team/coaches-roster/) | 260x173 |
| Jeff Ulbrich | ATL DC | Team site | https://static.clubs.nfl.com/image/upload/falcons/lsbimbddujis4at4mzzp.jpg (from https://www.atlantafalcons.com/team/coaches-roster/) | 190x190 |
| Jesse Minter | BAL HC | Team site | https://static.clubs.nfl.com/image/upload/ravens/omofhdjcdppnx8ngmnlh.jpg (from https://www.baltimoreravens.com/team/coaches-roster/) | 254x190 |
| Declan Doyle | BAL OC | Team site | https://static.clubs.nfl.com/image/upload/ravens/kfl3lvkzgczyqlwohgci.jpg (from https://www.baltimoreravens.com/team/coaches-roster/) | 254x190 |
| Anthony Weaver | BAL DC | Team site | https://static.clubs.nfl.com/image/upload/ravens/ah2w85u3ixrodlktlchh.jpg (from https://www.baltimoreravens.com/team/coaches-roster/) | 254x190 |
| Joe Brady | BUF HC | Team site | https://static.clubs.nfl.com/image/upload/bills/am3magndb9gofrw30jfk.jpg (from https://www.buffalobills.com/team/coaches-roster/) | 260x173 |
| Pete Carmichael | BUF OC | Team site | https://static.clubs.nfl.com/image/upload/bills/ylnqoktf4cwsl4zkchdr.jpg (from https://www.buffalobills.com/team/coaches-roster/) | 260x173 |
| Jim Leonhard | BUF DC | Team site | https://static.clubs.nfl.com/image/upload/bills/rlbqbpyskcieb8rzklt7.jpg (from https://www.buffalobills.com/team/coaches-roster/) | 260x173 |
| Dave Canales | CAR HC | Team site | https://static.clubs.nfl.com/image/upload/panthers/gnjgelxbhaldo4iskf45.jpg (from https://www.panthers.com/team/coaches-roster/) | 260x173 |
| Brad Idzik | CAR OC | Team site | https://static.clubs.nfl.com/image/upload/panthers/ssrdghpsx2xwa5zffcok.jpg (from https://www.panthers.com/team/coaches-roster/) | 260x146 |
| Todd Wash | CAR DC | Team site | https://static.clubs.nfl.com/image/upload/panthers/smq1kdqidksdzftpzq99.jpg (from https://www.panthers.com/team/coaches-roster/) | 260x146 |
| Ben Johnson | CHI HC | Team site | https://static.clubs.nfl.com/image/upload/bears/bexkjvilhtogegqjqfjx.jpg (from https://www.chicagobears.com/team/coaches/) | 260x146 |
| Press Taylor | CHI OC | Team site | https://static.clubs.nfl.com/image/upload/bears/jywxbepne40raawidm6a.jpg (from https://www.chicagobears.com/team/coaches/) | 260x146 |
| Dennis Allen | CHI DC | Team site | https://static.clubs.nfl.com/image/upload/bears/y5plzlttfzrlr8lrik0f.jpg (from https://www.chicagobears.com/team/coaches/) | 260x146 |
| Zac Taylor | CIN HC | Team site | https://static.clubs.nfl.com/image/upload/bengals/auyolyq5eqipvfgpeq5h.jpg (from https://www.bengals.com/team/coaches-roster/) | 260x173 |
| Dan Pitcher | CIN OC | Team site | https://static.clubs.nfl.com/image/upload/bengals/nykqeor33cg0ik44iabv.jpg (from https://www.bengals.com/team/coaches-roster/) | 260x174 |
| Al Golden | CIN DC | Team site | https://static.clubs.nfl.com/image/upload/bengals/tc1mqepcdxyejdrk2jcm.jpg (from https://www.bengals.com/team/coaches-roster/) | 260x173 |
| Todd Monken | CLE HC | Team site | https://static.clubs.nfl.com/image/upload/browns/y0rhqhw644qqu6bcxxuc.jpg (from https://www.clevelandbrowns.com/team/coaches-roster/) | 260x146 |
| Travis Switzer | CLE OC | Team site | https://static.clubs.nfl.com/image/upload/browns/pa4o6y93miykxkphmexk.jpg (from https://www.clevelandbrowns.com/team/coaches-roster/) | 260x146 |
| Mike Rutenberg | CLE DC | Team site | https://static.clubs.nfl.com/image/upload/browns/kwhfjwwtwbtie5u8ji5r.jpg (from https://www.clevelandbrowns.com/team/coaches-roster/) | 260x146 |
| Brian Schottenheimer | DAL HC | Team site | https://static.clubs.nfl.com/image/upload/cowboys/x6xkpcqontxqwt8mdyr9.jpg (from https://www.dallascowboys.com/team/coaches-roster/) | 260x146 |
| Klayton Adams | DAL OC | Team site | https://static.clubs.nfl.com/image/upload/cowboys/pg1nmocflsxszn8wrnye.jpg (from https://www.dallascowboys.com/team/coaches-roster/) | 260x146 |
| Christian Parker | DAL DC | Team site | https://static.clubs.nfl.com/image/upload/cowboys/pez2mf6i9sj6poiihuva.png (from https://www.dallascowboys.com/team/coaches-roster/) | 260x146 |
| Sean Payton | DEN HC | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/17567.png | 260x189 |
| Davis Webb | DEN OC | Team site | https://static.clubs.nfl.com/image/private/f_auto/broncos/jyqa2i3yr2d4bhpei76w.jpg (from https://www.denverbroncos.com/team/coaches-roster/) | 260x146 |
| Vance Joseph | DEN DC | Team site | https://static.clubs.nfl.com/image/private/f_auto/broncos/aljefugdig4lmscpjzjv.jpg (from https://www.denverbroncos.com/team/coaches-roster/) | 260x146 |
| Dan Campbell | DET HC | Team site | https://static.clubs.nfl.com/image/upload/lions/wnlvnnw7pr8bcdf8yt7f.jpg (from https://www.detroitlions.com/team/coaches-roster/) | 260x146 |
| Drew Petzing | DET OC | Team site | https://static.clubs.nfl.com/image/upload/lions/wgkudg3q55jwroxbagfq.jpg (from https://www.detroitlions.com/team/coaches-roster/) | 260x146 |
| Kelvin Sheppard | DET DC | Team site | https://static.clubs.nfl.com/image/upload/lions/vprdzzqentpcid3rrd4i.jpg (from https://www.detroitlions.com/team/coaches-roster/) | 260x146 |
| Matt LaFleur | GB HC | Team site | https://static.clubs.nfl.com/image/private/f_auto/packers/xyxyorftpjauf43ogpmv.jpg (from https://www.packers.com/team/coaches-roster/) | 260x146 |
| Adam Stenavich | GB OC | Team site | https://static.clubs.nfl.com/image/upload/packers/bzjihgeok7dfkkjtsckt.png (from https://www.packers.com/team/coaches-roster/) | 260x146 |
| Jonathan Gannon | GB DC | Team site | https://static.clubs.nfl.com/image/upload/packers/cvjhk4b3tcqjmxtye7ca.png (from https://www.packers.com/team/coaches-roster/) | 260x146 |
| DeMeco Ryans | HOU HC | Team site | https://static.clubs.nfl.com/image/upload/texans/gzddlomivbtyuftuzrdi.png (from https://www.houstontexans.com/team/coaches-roster/) | 190x190 |
| Nick Caley | HOU OC | Team site | https://static.clubs.nfl.com/image/upload/texans/mfe89ryblg2qawelwnfa.png (from https://www.houstontexans.com/team/coaches-roster/) | 190x190 |
| Matt Burke | HOU DC | Team site | https://static.clubs.nfl.com/image/upload/texans/shdjaky9gbl37srbm7pn.png (from https://www.houstontexans.com/team/coaches-roster/) | 190x190 |
| Shane Steichen | IND HC | Team site | https://static.clubs.nfl.com/image/upload/colts/ryl3kamnc06bddbsbk6e.jpg (from https://www.colts.com/team/coaches-roster/) | 260x146 |
| Jim Bob Cooter | IND OC | Team site | https://static.clubs.nfl.com/image/upload/colts/eu7y2ysdprgliwjwpwt9.jpg (from https://www.colts.com/team/coaches-roster/) | 260x146 |
| Lou Anarumo | IND DC | Team site | https://static.clubs.nfl.com/image/upload/colts/iy4wfxmh6ijxu8diqjlf.jpg (from https://www.colts.com/team/coaches-roster/) | 260x146 |
| Liam Coen | JAX HC | Team site | https://static.clubs.nfl.com/image/upload/jaguars/flrzd3amfwdd3ga71dag.jpg (from https://www.jaguars.com/team/coaches-roster/) | 260x173 |
| Grant Udinski | JAX OC | Team site | https://static.clubs.nfl.com/image/upload/jaguars/rvhypeewchuulckrmh2g.jpg (from https://www.jaguars.com/team/coaches-roster/) | 260x173 |
| Anthony Campanile | JAX DC | Team site | https://static.clubs.nfl.com/image/upload/jaguars/a34vnsoax3xek289dlck.jpg (from https://www.jaguars.com/team/coaches-roster/) | 260x173 |
| Andy Reid | KC HC | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/17553.png | 260x189 |
| Eric Bieniemy | KC OC | Team site | https://static.clubs.nfl.com/image/private/f_auto/chiefs/sje0p8bmqimlyc3jrzrc.jpg (from https://www.chiefs.com/team/coaches-roster/) | 260x146 |
| Steve Spagnuolo | KC DC | Team site | https://static.clubs.nfl.com/image/private/f_auto/chiefs/q8xacaiuqnaojqqrertp.jpg (from https://www.chiefs.com/team/coaches-roster/) | 260x146 |
| Klint Kubiak | LV HC | Team site | https://static.clubs.nfl.com/image/upload/raiders/cemhaxoqp1pajpx8yjp7.jpg (from https://www.raiders.com/team/coaches-roster/) | 260x146 |
| Andrew Janocko | LV OC | Team site | https://static.clubs.nfl.com/image/upload/raiders/fm00ayizan3vlhbsz7pp.jpg (from https://www.raiders.com/team/coaches-roster/) | 260x146 |
| Rob Leonard | LV DC | Team site | https://static.clubs.nfl.com/image/upload/raiders/ekvlakdrktsi4gst1xac.jpg (from https://www.raiders.com/team/coaches-roster/) | 260x146 |
| Jim Harbaugh | LAC HC | Team site | https://static.clubs.nfl.com/image/upload/chargers/mkoyd76svgrapwhpujxp.jpg (from https://www.chargers.com/team/coaches-roster/) | 260x146 |
| Mike McDaniel | LAC OC | Team site | https://static.clubs.nfl.com/image/upload/chargers/xj1ifsjajstwchqhgcfl.jpg (from https://www.chargers.com/team/coaches-roster/) | 260x146 |
| Chris O'Leary | LAC DC | Team site | https://static.clubs.nfl.com/image/upload/chargers/dfqgwjxke1uzd1xixgch.jpg (from https://www.chargers.com/team/coaches-roster/) | 260x146 |
| Sean McVay | LAR HC | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/2499338.png | 260x189 |
| Nate Scheelhaase | LAR OC | Team site | https://static.clubs.nfl.com/image/upload/rams/iuveb79wsaaj1hank4bm.jpg (from https://www.therams.com/team/coaches-roster/) | 260x146 |
| Chris Shula | LAR DC | Team site | https://static.clubs.nfl.com/image/upload/rams/uqqyzwihyesgyhpgvrxx.jpg (from https://www.therams.com/team/coaches-roster/) | 260x146 |
| Jeff Hafley | MIA HC | Team site | https://static.clubs.nfl.com/image/upload/dolphins/cgnnqs8d7ngwnmssmhfa.jpg (from https://www.miamidolphins.com/team/coaches-roster/) | 260x146 |
| Bobby Slowik | MIA OC | Team site | https://static.clubs.nfl.com/image/upload/dolphins/ww5qxutszxderq24t0wo.jpg (from https://www.miamidolphins.com/team/coaches-roster/) | 260x173 |
| Sean Duggan | MIA DC | Team site | https://static.clubs.nfl.com/image/upload/dolphins/ipc38ygtepixa24prauv.jpg (from https://www.miamidolphins.com/team/coaches-roster/) | 260x173 |
| Kevin O'Connell | MIN HC | Team site | https://static.clubs.nfl.com/image/private/f_auto/vikings/hozn31ftfmnuslvaojle.jpg (from https://www.vikings.com/team/coaches-roster/) | 260x146 |
| Wes Phillips | MIN OC | Team site | https://static.clubs.nfl.com/image/private/f_auto/vikings/rzzjaguw0xrvmdepn8t8.jpg (from https://www.vikings.com/team/coaches-roster/) | 260x146 |
| Brian Flores | MIN DC | Team site | https://static.clubs.nfl.com/image/private/f_auto/vikings/njq3aeug6vj7r7oejdyj.jpg (from https://www.vikings.com/team/coaches-roster/) | 260x146 |
| Mike Vrabel | NE HC | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/1257.png | 260x189 |
| Josh McDaniels | NE OC | Team site | https://static.clubs.nfl.com/image/upload/patriots/bidlnwaxv8yq9fmel75c.png (from https://www.patriots.com/team/coaches-roster/) | 260x146 |
| Zak Kuhr | NE DC | Team site | https://static.clubs.nfl.com/image/upload/patriots/x3hgjac4pejjnrtz3rji.png (from https://www.patriots.com/team/coaches-roster/) | 260x146 |
| Kellen Moore | NO HC | Team site | https://static.clubs.nfl.com/image/upload/saints/ahvamdhwedu0nqkumb9h.jpg (from https://www.neworleanssaints.com/team/coaches-roster/) | 260x146 |
| Doug Nussmeier | NO OC | Team site | https://static.clubs.nfl.com/image/upload/saints/zxhcovmyv0kqer28r49d.jpg (from https://www.neworleanssaints.com/team/coaches-roster/) | 260x146 |
| Brandon Staley | NO DC | Team site | https://static.clubs.nfl.com/image/upload/saints/crs6v11guoqyiohtotlq.jpg (from https://www.neworleanssaints.com/team/coaches-roster/) | 260x146 |
| John Harbaugh | NYG HC | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/17587.png | 260x189 |
| Matt Nagy | NYG OC | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/13162.png | 260x189 |
| Dennard Wilson | NYG DC | Team site | https://static.clubs.nfl.com/image/upload/giants/yadslf0t6mioqiirws76.jpg (from https://www.giants.com/team/coaches-roster/) | 190x190 |
| Aaron Glenn | NYJ HC | Team site | https://static.clubs.nfl.com/image/upload/jets/o9oqdjxllj9fiqdgd1sx.png (from https://www.newyorkjets.com/team/coaches-roster/) | 260x173 |
| Frank Reich | NYJ OC | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/6532.png | 260x189 |
| Brian Duker | NYJ DC | Team site | https://static.clubs.nfl.com/image/upload/jets/xomu5ytr5be7dfhi8mll.png (from https://www.newyorkjets.com/team/coaches-roster/) | 260x173 |
| Nick Sirianni | PHI HC | Team site | https://static.clubs.nfl.com/image/private/f_auto/eagles/bqj3sr1r5pbs3w6epgrx.jpg (from https://www.philadelphiaeagles.com/team/coaches/) | 260x146 |
| Sean Mannion | PHI OC | Team site | https://static.clubs.nfl.com/image/upload/eagles/bpixaidvibwkawmetq0m.png (from https://www.philadelphiaeagles.com/team/coaches/) | 222x190 |
| Vic Fangio | PHI DC | Team site | https://static.clubs.nfl.com/image/upload/eagles/xbe3sxkbtqqqzpf38jet.jpg (from https://www.philadelphiaeagles.com/team/coaches/) | 260x146 |
| Mike McCarthy | PIT HC | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/17578.png | 260x189 |
| Brian Angelichio | PIT OC | Team site | https://static.clubs.nfl.com/image/upload/steelers/ddj4njduyy4gvhkbrfrf.jpg (from https://www.steelers.com/team/coaches-roster/) | 260x146 |
| Patrick Graham | PIT DC | Team site | https://static.clubs.nfl.com/image/upload/steelers/bxuatzdmh7bkklmqceny.jpg (from https://www.steelers.com/team/coaches-roster/) | 260x146 |
| Kyle Shanahan | SF HC | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/17533.png | 260x189 |
| Klay Kubiak | SF OC | Team site | https://static.clubs.nfl.com/image/upload/49ers/uz0xnl4gyjrp3uhzfaq3.png (from https://www.49ers.com/team/coaches-roster/) | 260x146 |
| Raheem Morris | SF DC | Team site | https://static.clubs.nfl.com/image/upload/49ers/at5ik7qtjdiwm42jrmun.jpg (from https://www.49ers.com/team/coaches-roster/) | 260x173 |
| Mike Macdonald | SEA HC | Team site | https://static.clubs.nfl.com/image/upload/seahawks/c9c4uivyfdcurorpmprs.jpg (from https://www.seahawks.com/team/coaches-roster/) | 190x190 |
| Brian Fleury | SEA OC | Team site | https://static.clubs.nfl.com/image/upload/seahawks/ai7cmquf01lmkcvxjjco.jpg (from https://www.seahawks.com/team/coaches-roster/) | 190x190 |
| Aden Durde | SEA DC | Team site | https://static.clubs.nfl.com/image/upload/seahawks/biagkcrccrzjcz45jge3.jpg (from https://www.seahawks.com/team/coaches-roster/) | 190x190 |
| Todd Bowles | TB HC | Team site | https://static.clubs.nfl.com/image/private/f_auto/buccaneers/jpogwxmoztyg1pusjnum.jpg (from https://www.buccaneers.com/team/coaches-roster/) | 260x146 |
| Zac Robinson | TB OC | Team site | https://static.clubs.nfl.com/image/upload/buccaneers/zutxtvcex1kejjw6uqq7.jpg (from https://www.buccaneers.com/team/coaches-roster/) | 260x146 |
| George Edwards | TB DC | Team site | https://static.clubs.nfl.com/image/private/f_auto/buccaneers/jc5dyd3vfqwan4pofyq9.jpg (from https://www.buccaneers.com/team/coaches-roster/) | 260x146 |
| Robert Saleh | TEN HC | Team site | https://static.clubs.nfl.com/image/upload/titans/fflteh2nl88z9oocmsnj.jpg (from https://www.tennesseetitans.com/team/coaches-roster/) | 260x146 |
| Brian Daboll | TEN OC | Team site | https://static.clubs.nfl.com/image/upload/titans/a9bztzhfpemeemalfxkn.jpg (from https://www.tennesseetitans.com/team/coaches-roster/) | 260x146 |
| Gus Bradley | TEN DC | Team site | https://static.clubs.nfl.com/image/upload/titans/m7yrk4kr4dboiqajfezt.jpg (from https://www.tennesseetitans.com/team/coaches-roster/) | 260x146 |
| Dan Quinn | WAS HC | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/2485644.png | 260x189 |
| David Blough | WAS OC | Team site | https://static.clubs.nfl.com/image/upload/commanders/p7huagfywwgrwcwsyfp5.jpg (from https://www.commanders.com/team/coaches-roster/) | 237x190 |
| Daronte Jones | WAS DC | Team site | https://static.clubs.nfl.com/image/upload/commanders/zq0bffhhxs8ghslzive6.jpg (from https://www.commanders.com/team/coaches-roster/) | 238x190 |
| Mike Tomlin | free agent (HC) | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/17582.png | 260x189 |
| Pete Carroll | free agent (HC) | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/17596.png | 260x189 |
| Doug Pederson | free agent (HC) | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/525.png | 260x189 |
| Jon Gruden | free agent (HC) | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/17731.png | 260x189 |
| Jason Garrett | free agent (HC) | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/509.png | 260x189 |
| Marvin Lewis | free agent (HC) | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/17549.png | 260x189 |
| Mike Zimmer | free agent (DC) | ESPN | https://a.espncdn.com/i/headshots/nfl/coaches/65/17611.png | 260x189 |

## Missing (drawn face in game)

- Sean McDermott (free agent (HC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Rex Ryan (free agent (HC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Jim Caldwell (free agent (HC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Antonio Pierce (free agent (HC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Ken Whisenhunt (free agent (OC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Pat Shurmur (free agent (OC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Jay Gruden (free agent (OC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Matt Canada (free agent (OC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Scott Turner (free agent (OC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Greg Olson (free agent (OC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Jim Schwartz (free agent (DC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Ejiro Evero (free agent (DC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Don Martindale (free agent (DC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Lovie Smith (free agent (DC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Jerod Mayo (free agent (DC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Greg Manusky (free agent (DC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Ed Donatell (free agent (DC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Gregg Williams (free agent (DC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Wade Phillips (free agent (DC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
- Mike Nolan (free agent (DC)): no ESPN studio headshot (only a 65x90 thumbnail or none); not on any team site
