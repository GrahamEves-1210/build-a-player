// A nation's flag as an emoji, by its FIFA code (soccer: the World Cup wheel, the nation pickers).
// England, Scotland and Wales have their own subdivision flags. Northern Ireland has no official one (no emoji:
// the name carries it). The defunct nations never appear as their own rows: FIFA's record and the data put West
// Germany under GER, the Soviet Union under RUS, Yugoslavia under SRB and Czechoslovakia under CZE, so they show
// the successor's flag.
const ISO2 = {
  ALB: 'AL', ALG: 'DZ', ANG: 'AO', ARG: 'AR', AUS: 'AU', AUT: 'AT', BEL: 'BE', BEN: 'BJ', BFA: 'BF', BHR: 'BH',
  BIH: 'BA', BOL: 'BO', BRA: 'BR', BUL: 'BG', CAN: 'CA', CHI: 'CL', CHN: 'CN', CIV: 'CI', CMR: 'CM', COD: 'CD',
  COL: 'CO', COM: 'KM', CPV: 'CV', CRC: 'CR', CRO: 'HR', CUW: 'CW', CZE: 'CZ', DEN: 'DK', DOM: 'DO', ECU: 'EC',
  EGY: 'EG', EQG: 'GQ', ESP: 'ES', FIN: 'FI', FRA: 'FR', GAB: 'GA', GAM: 'GM', GEO: 'GE', GER: 'DE', GHA: 'GH',
  GRE: 'GR', GUA: 'GT', GUI: 'GN', GUY: 'GY', HAI: 'HT', HON: 'HN', HUN: 'HU', IDN: 'ID', IND: 'IN', IRL: 'IE',
  IRN: 'IR', IRQ: 'IQ', ISL: 'IS', ISR: 'IL', ITA: 'IT', JAM: 'JM', JOR: 'JO', JPN: 'JP', KGZ: 'KG', KOR: 'KR',
  KOS: 'XK', KSA: 'SA', KUW: 'KW', LBN: 'LB', MAR: 'MA', MAS: 'MY', MEX: 'MX', MKD: 'MK', MLI: 'ML', MNE: 'ME',
  MOZ: 'MZ', NCA: 'NI', NED: 'NL', NGA: 'NG', NOR: 'NO', NZL: 'NZ', OMA: 'OM', PAN: 'PA', PAR: 'PY', PER: 'PE',
  PLE: 'PS', POL: 'PL', POR: 'PT', PRK: 'KP', QAT: 'QA', ROU: 'RO', RSA: 'ZA', RUS: 'RU', SEN: 'SN', SLV: 'SV',
  SRB: 'RS', SUI: 'CH', SUR: 'SR', SVK: 'SK', SVN: 'SI', SWE: 'SE', SYR: 'SY', THA: 'TH', TJK: 'TJ', TOG: 'TG',
  TRI: 'TT', TUN: 'TN', TUR: 'TR', UAE: 'AE', UGA: 'UG', UKR: 'UA', URU: 'UY', USA: 'US', UZB: 'UZ', VEN: 'VE',
  VIE: 'VN', ZAM: 'ZM', ZIM: 'ZW',
  // (old codes an old save may still carry)
  FRG: 'DE', URS: 'RU', YUG: 'RS', SCG: 'RS', TCH: 'CZ',
}
const SUB = { ENG: 'gbeng', SCO: 'gbsct', WAL: 'gbwls' }
const tagged = s => String.fromCodePoint(0x1F3F4, ...[...s].map(c => 0xE0000 + c.charCodeAt(0)), 0xE007F)
const regional = cc => String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
export const flagEmoji = code => (SUB[code] ? tagged(SUB[code]) : ISO2[code] ? regional(ISO2[code]) : '')

// Windows has no flag emoji (it shows the two letters). There, and only there, a Twemoji flags font (78 KB, flags
// only) is loaded the first time a soccer screen asks; the flag spans list it first (.flag-emoji, app-game.css).
// The check and the font are from country-flag-emoji-polyfill 0.1.8 (MIT).
let polyfilled = false
export function ensureFlagFont() {
  if (polyfilled || typeof document === 'undefined') return
  polyfilled = true
  try {
    const c = document.createElement('canvas'); c.width = c.height = 1
    const x = c.getContext('2d', { willReadFrequently: true })
    x.textBaseline = 'top'; x.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.scale(0.01, 0.01)
    const px = (t, col) => { x.clearRect(0, 0, 100, 100); x.fillStyle = col; x.fillText(t, 0, 0); return x.getImageData(0, 0, 1, 1).data.join(',') }
    const colour = t => { const w = px(t, '#fff'), b = px(t, '#000'); return w === b && !b.startsWith('0,0,0,') }
    if (!colour('\u{1F60A}') || colour('\u{1F1E8}\u{1F1ED}')) return
    const st = document.createElement('style')
    st.textContent = `@font-face{font-family:"Twemoji Country Flags";unicode-range:U+1F1E6-1F1FF,U+1F3F4,U+E0062-E0063,U+E0065,U+E0067,U+E006C,U+E006E,U+E0073-E0074,U+E0077,U+E007F;src:url('https://cdn.jsdelivr.net/npm/country-flag-emoji-polyfill@0.1.8/dist/TwemojiCountryFlags.woff2') format('woff2');font-display:swap}`
    document.head.appendChild(st)
  } catch {}
}
