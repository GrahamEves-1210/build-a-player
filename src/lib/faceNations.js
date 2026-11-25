// SOCCER CAREER: who a made-up man from each country looks like (owner 11-25: "make randomizer match country
// demographic more for face creation"). His face's random look (FacePick's RANDOM, a new career's first face) is drawn
// from his nationality's mix of backgrounds (faces.js: b w m p l and MORE's bd h wn we ws n s a e i), weighted the way
// the country's own footballers look: its population, with the share its national team and league draw from a group
// that plays the game in numbers (France's, England's, the Netherlands' and Belgium's Black and North African players;
// Ecuador's Afro-Ecuadorians; Fiji's Indo-Fijians). Every one of FIFA's 211 nations (data/soccer-nations.js) is here.
//   nationMix(short)   [background, weight] for faces.js lookOf / defaultFace, or null (not a known country)
//
// b   Black (the Caribbean, Southern and East African, the diaspora in Europe and the Americas)
// bd  West African, Sahel and Central African (darker skin)   h  Horn of Africa
// w   Northern and Western European, British, Anglo (drawn as faces.js wc: footballers' cuts)   wn Nordic and Baltic
// we  Central and Eastern European, Balkan                    ws Southern European, Mediterranean
// n   North African, Arab, Turkish, Persian, Caucasus         s  South Asian
// a   East Asian (and Central Asian Kazakh, Kyrgyz, Mongol)    e  Southeast Asian
// l   Latino, mestizo                                         i  Indigenous American
// p   Polynesian (Māori, Samoan, Tongan)                      m  mixed
const MIXES = `
ENG w62 b20 m12 s3 n3 · SCO w88 b5 m4 s3 · WAL w88 b6 m6 · NIR w95 b3 m2 · IRL w82 wn6 b8 m4
FRA w40 ws6 b32 n12 m10 · GER w58 we8 n12 b14 m8 · NED w55 b22 m10 n10 e3 · BEL w55 b25 n12 m8 · LUX w55 ws27 b10 m8
SUI w55 we12 ws8 b14 m6 n5 · AUT w64 we18 b8 m5 n5 · LIE w90 we10 · ESP ws80 b8 m6 n4 l2 · POR ws72 b16 m10 l2
ITA ws75 w15 b6 m4 · GRE ws90 we8 b2 · CYP ws80 n20 · MLT ws90 n10 · AND ws85 w15 · SMR ws90 w10 · GIB ws60 w30 n10
NOR wn84 b7 m4 n5 · SWE wn62 w8 we8 b10 n8 m4 · DEN wn78 w6 b6 n6 m4 · FIN wn88 we8 b2 m2 · ISL wn97 w3 · FRO wn97 w3
EST wn60 we40 · LVA we70 wn30 · LTU we75 wn25
POL we94 w6 · CZE we80 w15 b3 m2 · SVK we95 w5 · HUN we90 w8 m2 · SVN we85 w10 ws5 · CRO we75 ws25 · BIH we90 ws10
SRB we85 ws15 · MNE we80 ws20 · MKD we75 ws20 n5 · ALB ws55 we45 · KOS we60 ws40 · BUL we75 ws25 · ROU we80 ws15 m5
MDA we90 ws10 · UKR we96 w4 · BLR we95 w5 · RUS we88 w5 a3 n4 · KAZ a60 we30 n10
GEO ws60 we40 · ARM n55 ws45 · AZE n60 ws40 · TUR n45 ws40 we15 · ISR ws40 n35 we20 b5
BRA w30 l22 m28 b20 · ARG ws50 w25 l22 m3 · URU ws50 w20 l18 b6 m6 · CHI l60 ws25 i10 w5 · PAR l70 w20 i10
COL l55 b20 m15 w10 · VEN l55 m20 w15 b10 · ECU l45 b30 i15 m10 · PER l50 i30 b8 m7 ws5 · BOL i50 l45 w5
MEX l75 i12 ws10 m2 b1 · USA w45 b22 l20 m10 a3 · CAN w50 b18 m12 s6 a6 ws5 n3
CRC l70 w15 b10 m5 · PAN l50 b30 m20 · HON l60 b25 m10 i5 · GUA l55 i40 b5 · SLV l85 i10 w5 · NCA l75 b15 i10
BLZ l45 b30 m20 i5 · CUB m40 l25 b25 ws10 · DOM m50 b35 l15 · PUR l50 m30 b15 w5 · HAI b65 bd30 m5
JAM b85 m10 bd5 · TRI b50 m25 s25 · GUY s40 b35 m25 · SUR b45 m25 s20 e10 · CUW b70 m25 l5 · ARU m45 l35 b15 w5
BER b60 m20 w20 · CAY b35 m35 w25 l5 · BAH b85 w8 m7 · BRB b88 m8 w4 · VIN b80 m15 w5 · LCA b85 m15 · SKN b90 m10
GRN b85 m15 · MSR b90 m10 · ATG b88 m12 · DMA b85 m12 i3 · VIR b75 m15 l10 · TCA b88 m12 · VGB b85 m15 · AIA b90 m10
MAR n92 b5 m3 · ALG n95 b3 m2 · TUN n96 b4 · LBY n92 b8 · EGY n93 b7 · MTN n50 bd40 b10
SEN bd85 b15 · MLI bd80 b15 n5 · GAM bd85 b15 · GUI bd80 b20 · GNB bd75 b25 · BFA bd80 b20 · NIG bd70 b15 n15
CHA bd70 b15 n15 · SDN bd55 h30 n15 · SSD bd95 b5 · CIV bd55 b45 · GHA bd50 b50 · NGA bd50 b50 · TOG bd60 b40
BEN bd60 b40 · SLE bd70 b30 · LBR bd65 b35 · CMR bd55 b45 · GAB bd55 b45 · EQG bd55 b45 · CGO bd60 b40 · COD bd60 b40
CTA bd75 b25 · STP b60 m35 bd5 · CPV m60 b35 bd5 · ANG b55 bd35 m10
ETH h88 bd12 · ERI h90 bd10 · SOM h95 bd5 · DJI h85 n10 bd5 · KEN bd55 b40 h5 · UGA bd55 b45 · TAN bd55 b40 n5
RWA b55 bd30 h15 · BDI b55 bd35 h10 · ZAM b55 bd45 · MWI bd55 b45 · MOZ b55 bd40 m5 · ZIM b55 bd45
BOT b65 bd35 · NAM b60 bd25 m10 w5 · RSA b50 bd28 m10 w8 s4 · LES b65 bd35 · SWZ b65 bd35
MAD m40 e30 b30 · COM b45 m35 n20 · MRI s55 m30 b15 · SEY m55 b40 s5
KSA n85 b10 m5 · QAT n80 b10 s10 · UAE n80 b10 s10 · KUW n85 b10 s5 · BHR n85 b10 s5 · OMA n80 b15 s5 · YEM n80 h10 b10
IRQ n100 · SYR n100 · JOR n100 · PLE n100 · LBN n70 ws30 · IRN n90 ws10
UZB n55 a35 we10 · TKM n70 a25 we5 · TJK n80 a15 we5 · KGZ a65 n20 we15 · AFG n55 s25 a20
IND s100 · PAK s85 n15 · BAN s100 · SRI s100 · NEP s60 a40 · BHU a60 s40 · MDV s80 n20
JPN a97 m3 · KOR a100 · PRK a100 · CHN a100 · TPE a100 · HKG a90 w5 s5 · MAC a95 ws5 · MNG a100
THA e85 a15 · VIE e70 a30 · LAO e90 a10 · CAM e100 · MYA e85 a10 s5 · MAS e60 a25 s15 · SGP a65 e20 s15
IDN e80 m10 w5 a5 · BRU e100 · PHI e75 m15 w5 a5 · TLS e70 m30 · GUM e55 p25 w10 m10
AUS w60 ws12 a8 b8 m6 n6 · NZL w60 p20 m10 a5 b5
NCL b40 p25 w25 m10 · VAN b70 p20 m10 · PNG b75 p15 m10 · SOL b80 p15 m5 · FIJ b40 s30 p25 m5
TAH p80 m15 w5 · SAM p95 m5 · TGA p95 m5 · COK p90 m10 · ASA p95 m5
`
const BY = new Map()
for (const row of MIXES.trim().split(/\s*[·\n]\s*/)) {
  const [short, ...parts] = row.trim().split(/\s+/)
  if (short) BY.set(short, parts.map(x => { const g = x.replace(/\d+$/, ''); return [g === 'w' ? 'wc' : g, +x.match(/\d+$/)[0]] }))
}
export const nationMix = short => BY.get(short) ?? null
export const MIXED_NATIONS = BY
