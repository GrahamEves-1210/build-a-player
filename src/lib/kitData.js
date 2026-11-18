// The NFL's home kits as the app's jersey cards draw them (lib/jerseyArt.js): colours, collar, sleeve trim and the
// sleeve pattern, never a logo or a wordmark. Every other league (NBA, college) is drawn from its two team colours.
//
//   body   jersey colour          num   number colour        line  number outline (null: none)
//   collar collar trim            sleeve [kind, ...colours]  badge [oval fill, letters] (default: body, number)
//
// Sleeve kinds: stripes (bands above the cuff, listed from the cuff up), tiger (Bengals), loops (Colts shoulder
// loops), horn (Vikings / Rams horn over the shoulder), bolt (Chargers), none.
export const NFL_KITS = {
  ARI: { body: '#97233F', num: '#FFFFFF', line: '#000000', collar: '#000000', sleeve: ['stripes', '#000000'] },
  ATL: { body: '#16181B', num: '#FFFFFF', line: '#A71930', collar: '#A71930', sleeve: ['stripes', '#A71930'], badge: ['#A71930', '#FFFFFF'] },
  BAL: { body: '#241773', num: '#FFFFFF', line: '#000000', collar: '#000000', sleeve: ['stripes', '#000000', '#9E7C0C'] },
  BUF: { body: '#00338D', num: '#FFFFFF', line: '#C60C30', collar: '#C60C30', sleeve: ['stripes', '#FFFFFF', '#C60C30', '#FFFFFF'] },
  CAR: { body: '#16181B', num: '#0085CA', line: '#FFFFFF', collar: '#0085CA', sleeve: ['stripes', '#0085CA', '#BFC0BF'], badge: ['#0085CA', '#FFFFFF'] },
  CHI: { body: '#0B162A', num: '#FFFFFF', line: '#C83803', collar: '#C83803', sleeve: ['stripes', '#C83803', '#FFFFFF', '#C83803'], badge: ['#0B162A', '#C83803'] },
  CIN: { body: '#FB4F14', num: '#FFFFFF', line: '#000000', collar: '#000000', sleeve: ['tiger', '#000000'] },
  CLE: { body: '#311D00', num: '#FFFFFF', line: '#FF3C00', collar: '#FF3C00', sleeve: ['stripes', '#FF3C00', '#FFFFFF', '#FF3C00'], badge: ['#311D00', '#FF3C00'] },
  DAL: { body: '#F4F5F6', num: '#003594', line: '#041E42', collar: '#003594', sleeve: ['stripes', '#041E42', '#003594'], badge: ['#041E42', '#C8CDD0'] },
  DEN: { body: '#FB4F14', num: '#002244', line: '#FFFFFF', collar: '#002244', sleeve: ['stripes', '#002244'] },
  DET: { body: '#0076B6', num: '#FFFFFF', line: '#B0B7BC', collar: '#E3E7EA', sleeve: ['stripes', '#E3E7EA', '#B0B7BC'], badge: ['#FFFFFF', '#0076B6'] },
  GB: { body: '#203731', num: '#FFFFFF', line: null, collar: '#FFB612', sleeve: ['stripes', '#FFB612', '#FFFFFF', '#FFB612'], badge: ['#203731', '#FFB612'] },
  HOU: { body: '#03202F', num: '#FFFFFF', line: '#A71930', collar: '#A71930', sleeve: ['stripes', '#A71930'], badge: ['#03202F', '#A71930'] },
  IND: { body: '#002C5F', num: '#FFFFFF', line: null, collar: '#FFFFFF', sleeve: ['loops', '#FFFFFF'] },
  JAX: { body: '#006778', num: '#FFFFFF', line: '#101820', collar: '#101820', sleeve: ['stripes', '#D7A22A', '#101820'] },
  KC: { body: '#E31837', num: '#FFFFFF', line: null, collar: '#FFFFFF', sleeve: ['stripes', '#FFFFFF', '#FFB81C', '#FFFFFF'], badge: ['#E31837', '#FFB81C'] },
  LV: { body: '#16181B', num: '#FFFFFF', line: '#A5ACAF', collar: '#A5ACAF', sleeve: ['none'], badge: ['#16181B', '#A5ACAF'] },
  LAC: { body: '#0080C6', num: '#FFFFFF', line: null, collar: '#FFFFFF', sleeve: ['bolt', '#FFC20E'], badge: ['#0080C6', '#FFC20E'] },
  LAR: { body: '#003594', num: '#FFA300', line: '#FFFFFF', collar: '#FFA300', sleeve: ['horn', '#FFA300', '#FFFFFF'], badge: ['#003594', '#FFA300'] },
  MIA: { body: '#008E97', num: '#FFFFFF', line: '#FC4C02', collar: '#FFFFFF', sleeve: ['stripes', '#FC4C02', '#FFFFFF'] },
  MIN: { body: '#4F2683', num: '#FFFFFF', line: '#FFC62F', collar: '#FFFFFF', sleeve: ['horn', '#FFC62F', '#FFFFFF'], badge: ['#4F2683', '#FFC62F'] },
  NE: { body: '#002244', num: '#FFFFFF', line: '#C60C30', collar: '#C60C30', sleeve: ['none'], badge: ['#002244', '#C60C30'] },
  NO: { body: '#16181B', num: '#D3BC8D', line: '#FFFFFF', collar: '#D3BC8D', sleeve: ['stripes', '#D3BC8D'], badge: ['#16181B', '#D3BC8D'] },
  NYG: { body: '#0B2265', num: '#FFFFFF', line: '#A71930', collar: '#A71930', sleeve: ['none'] },
  NYJ: { body: '#125740', num: '#FFFFFF', line: null, collar: '#FFFFFF', sleeve: ['stripes', '#FFFFFF', '#125740', '#FFFFFF'] },
  PHI: { body: '#004C54', num: '#FFFFFF', line: '#000000', collar: '#000000', sleeve: ['stripes', '#000000', '#A5ACAF', '#000000'], badge: ['#004C54', '#C8CDD0'] },
  PIT: { body: '#16181B', num: '#FFB612', line: null, collar: '#FFB612', sleeve: ['stripes', '#FFB612', '#16181B', '#FFB612'], badge: ['#16181B', '#FFB612'] },
  SF: { body: '#AA0000', num: '#FFFFFF', line: '#000000', collar: '#FFFFFF', sleeve: ['stripes', '#FFFFFF', '#000000', '#FFFFFF'], badge: ['#AA0000', '#B3995D'] },
  SEA: { body: '#002244', num: '#FFFFFF', line: '#69BE28', collar: '#A5ACAF', sleeve: ['stripes', '#69BE28', '#A5ACAF'], badge: ['#002244', '#69BE28'] },
  TB: { body: '#D50A0A', num: '#FFFFFF', line: '#34302B', collar: '#34302B', sleeve: ['stripes', '#34302B', '#FFFFFF', '#34302B'] },
  TEN: { body: '#0C2340', num: '#FFFFFF', line: '#4B92DB', collar: '#C8102E', sleeve: ['stripes', '#4B92DB', '#C8102E'], badge: ['#0C2340', '#4B92DB'] },
  WAS: { body: '#5A1414', num: '#FFFFFF', line: '#FFB612', collar: '#FFB612', sleeve: ['stripes', '#FFB612', '#FFFFFF', '#FFB612'], badge: ['#5A1414', '#FFB612'] },
}
