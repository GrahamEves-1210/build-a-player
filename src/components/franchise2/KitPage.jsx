import { useState } from 'react'
import { realOf } from '../../lib/franchise2/league'
import { nflHeadshot } from '../../utils/simulation'
import { Chyron, Ticker, Scorebug, LowerThird, BigNum, BigRec, Stamp, Meter, TeamSlab, Versus, Tape, Go, Tag, Flip, Spin, Banner, Bumper, Section, Fact } from './kit'

// DEV ONLY: every piece of the kit on one page, with real men and real teams (?fkit on the dev server, then FRANCHISE).
const man = (pos, name) => { const r = realOf(pos, name); return { name, pos, num: r?.num ?? null, ovr: r?.o ?? 80, photo: r?.h ? nflHeadshot(r.h) : null } }
const TICK = [
  { k: 'score', a: 'KC', as: 27, h: 'LV', hs: 20, tag: 'FINAL' },
  { k: 'score', a: 'BUF', as: 17, h: 'MIA', hs: 24, tag: 'FINAL' },
  { k: 'news', tag: 'INJURY', s: 'CIN', text: 'Ja\'Marr Chase (hamstring) out 2 weeks' },
  { k: 'score', a: 'PHI', as: 31, h: 'DAL', hs: 28, tag: 'F/OT' },
  { k: 'news', tag: 'TRADE', s: 'NYJ', text: 'Jets acquire a 2027 3rd-round pick from the Giants' },
  { k: 'news', tag: 'CLINCHED', s: 'DET', text: 'Lions clinch the NFC North' },
  { k: 'score', a: 'SF', as: 13, h: 'SEA', hs: 10, tag: 'FINAL' },
]

export default function KitPage({ onHome }) {
  const [score, setScore] = useState(17)
  const [stamp, setStamp] = useState(0)
  const [flip, setFlip] = useState(false)
  const [spin, setSpin] = useState(0)
  const [bump, setBump] = useState(false)
  const [rec, setRec] = useState({ w: 6, l: 3 })
  const nix = man('qb', 'Bo Nix'), sutton = man('wr', 'Courtland Sutton'), surtain = man('db', 'Patrick Surtain II'), mahomes = man('qb', 'Patrick Mahomes')
  return (
    <div className="fk fk-root fk-kit">
      {bump && <Bumper team="DEN" kicker="4TH QUARTER · 2:14" title="KEY MOMENT" onDone={() => setBump(false)} />}
      <div className="fk-kit-top"><b>FRANCHISE KIT</b><button onClick={onHome}>CLOSE</button></div>

      <h3>CHYRON</h3>
      <Chyron team="DEN" tag="WK 7" title="Broncos at Chiefs" sub="SUN 1:00 PM · ARROWHEAD STADIUM" />
      <Chyron team="KC" title="This week" right="6-1" />
      <Chyron tone="ink" size="s" title="Around the league" sub="WEEK 6 FINALS" />
      <Chyron team="PIT" size="l" tag="AFC" title="North standings" />
      <Chyron tone="gold" size="l" tag="LX" title="Super Bowl" sub="FEB 8, 2026 · LEVI'S STADIUM" />

      <h3>SCOREBUG</h3>
      <Scorebug a="DEN" h="KC" as={score} hs={20} per="4TH" clock="2:14" dd="3RD & 6" poss="a" flash={score > 17 ? { s: 'DEN', text: 'TOUCHDOWN BRONCOS', key: score } : null} />
      <div style={{ height: 34 }} />
      <Scorebug a="DEN" h="KC" as={27} hs={20} final="FINAL" />
      <Scorebug a="BUF" h="MIA" recA="5-2" recH="4-3" per="1ST" clock="15:00" label="WK 8" />
      <div className="fk-kit-row"><Go ghost onClick={() => setScore(s => s + 7)}>TOUCHDOWN</Go></div>

      <h3>TICKER</h3>
      <Ticker items={TICK} />
      <Ticker items={TICK.slice(0, 4)} team="DEN" label="WEEK 6" />

      <h3>LOWER-THIRD</h3>
      <LowerThird {...nix} team="DEN" line="22/31 · 268 YDS · 2 TD" />
      <LowerThird {...sutton} team="DEN" size="s" />
      <LowerThird {...surtain} team="DEN" stat={{ v: 2, label: 'INT' }} />
      <LowerThird name="Marcus Hale" pos="rb" num={28} ovr={84} team="DEN" mine="Graham" line="18 CAR · 104 YDS" />
      <LowerThird {...mahomes} team="KC" size="l" line="AFC PLAYER OF THE WEEK" />

      <h3>BIG NUMBERS</h3>
      <div className="fk-kit-row">
        <BigRec w={rec.w} l={rec.l} size={72} label="RECORD" />
        <BigNum v={86} size={72} label="TEAM OVR" />
        <BigNum v={3} size={72} label="STREAK" tone="w" />
      </div>
      <div className="fk-kit-row"><Fact v="27.4" label="PTS / GAME" /><Fact v="1ST" label="AFC WEST" /><Fact v="W3" label="STREAK" tone="w" /></div>
      <div className="fk-kit-row"><Go ghost onClick={() => setRec(r => ({ ...r, w: r.w + 1 }))}>ADD A WIN</Go></div>

      <h3>STAMP</h3>
      <div className="fk-kit-row" key={stamp}>
        <Stamp kind="w" big>W</Stamp><Stamp kind="l" big delay={120}>L</Stamp><Stamp kind="gem" delay={240}>GEM</Stamp><Stamp kind="bust" delay={300}>BUST</Stamp><Stamp kind="solid" delay={360}>SOLID</Stamp><Stamp kind="gold" delay={420}>CHAMPS</Stamp>
      </div>
      <div className="fk-kit-row"><Go ghost onClick={() => setStamp(n => n + 1)}>AGAIN</Go></div>

      <h3>METER</h3>
      <Meter label="CHEMISTRY" v={68} team="DEN" />
      <Meter label="OFFENSE" v={7.6} max={12} show="B+" tone="ink" />
      <Meter label="BUDGET USED" v={91} tone="l" segs={20} show="$231M" />

      <h3>TEAM SLAB</h3>
      <TeamSlab s="DEN" rec={{ w: 6, l: 3 }} sub="AFC WEST · 2ND" />
      <TeamSlab s="LV" rec="3-6" side="r" size="s" />
      <TeamSlab s="PIT" rec="7-2" size="l" sub="AFC NORTH" />
      <Versus a="DEN" h="KC" recA={{ w: 6, l: 3 }} recH={{ w: 7, l: 2 }} foot={<><span>KC -3.5</span><span>O/U 46.5</span></>} />
      <Tape label="OFFENSE" a={8.1} h={9.4} fa="B+" fh="A-" teamA="DEN" teamH="KC" />
      <Tape label="PTS ALLOWED" a={17.2} h={21.8} teamA="DEN" teamH="KC" lower />

      <h3>BUTTONS, TAGS</h3>
      <Go sub="VS CHIEFS">PLAY WEEK</Go>
      <Go ghost>SIM TO PLAYOFFS</Go>
      <div className="fk-kit-row"><Tag tone="inj">OUT 2 WKS</Tag><Tag tone="new">ROOKIE</Tag><Tag tone="team" >STARTER</Tag><Tag tone="line">BYE</Tag><Tag tone="w">W3</Tag><Tag tone="gold">SB LX</Tag></div>

      <h3>REVEALS</h3>
      <div className="fk-kit-row">
        <Flip open={flip} className="fk-kit-flip" back={<div className="fk-kit-card is-back">ROUND 1 · PICK 22</div>} front={<div className="fk-kit-card"><Spin v={84} run={flip} grade="B+" size={56} /></div>} />
        <Spin key={spin} v={91} run={spin > 0} grade="A" />
      </div>
      <div className="fk-kit-row"><Go ghost onClick={() => setFlip(f => !f)}>FLIP</Go><Go ghost onClick={() => setSpin(n => n + 1)}>SPIN</Go><Go ghost onClick={() => setBump(true)}>BUMPER</Go></div>
      <div className="fk-kit-row fk-kit-wall">
        <Banner year={2026} team="DEN" title="AFC WEST CHAMPIONS" rec="12-5" />
        <Banner year={2027} team="DEN" title="SUPER BOWL LXII CHAMPIONS" rec="14-3" gold delay={150} />
        <Banner year={2028} team="DEN" title="DIVISIONAL ROUND" rec="10-7" delay={300} />
      </div>

      <h3>SECTION</h3>
      <Section team="DEN" tag="WK 7" title="Key players" sub="BRONCOS">
        <LowerThird {...nix} team="DEN" size="s" />
        <LowerThird {...sutton} team="DEN" size="s" />
      </Section>
      <div style={{ height: 60 }} />
    </div>
  )
}
