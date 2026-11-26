import HAIR_OF from '../data/soccer-hair.json'
import { soccerFaceKey } from './soccerFace'
// Whose hair the striker figure draws as short tight curls (components/StrikerFigureOverlay.jsx). The art's hair is
// a combed quiff, comb lines and all, which looks wrong on a player with Afro-textured hair: his is drawn over the
// art's as close-cropped tight curls. Decided from each player's photo (2026-11-25, every player whose sampled skin
// tone is in the darker half): a deep skin tone (the data's `skin` below SKIN_CURL) means curls unless he is in STRAIGHT;
// a lighter sample (a photo's light lifts it) means curls only when he is in CURLS. A new player with no entry goes by
// his skin tone alone.
export const SKIN_CURL = 100
export const CURLS = new Set([
  "Caleb Yirenkyi", "Tim Iroegbunam", "Habib Diarra", "Marcus Thuram", "Pablo Rosario", "David Moses",
  "Breel Embolo", "Bukayo Saka", "Noni Madueke", "Alisson Santana", "Melayro Bogarde", "Édgar Yoel Bárcenas", "Rayan",
  "Iñaki Williams", "Randal Kolo Muani", "Ibrahima Baldé", "Aboubakary Koïta", "Samuel Adeniran", "José Fajardo",
  "Yusuf Abdurisag", "Mohamed Kanno", "Gaoussou Diarra", "Mohamed-Ali Cho", "Lamine Yamal", "Junior Mwanga",
  "Nestory Irankunda", "Lucas Ferreira", "Orphé Mbina", "Evidence Makgopa", "Igor Paixão", "Désiré Doué",
  "Victor Osimhen", "Alex Iwobi", "Han-Noah Massengo", "Christopher Nkunku", "Taiwo Awoniyi", "Alexander Isak",
  "Raphael Onyedika", "Dermane Karim", "Jhon Arias", "Gonzalo Plata", "Ruben Providence", "Antoine Semenyo",
  "Tyrhys Dolan", "Rahim Ibrahim", "Thalente Mbatha", "Kylian Mbappé", "Serhou Guirassy", "Pape Diop",
  "Danley Jean Jacques", "Michael Folorunsho", "Ibrahim Mbaye", "Bradley Barcola", "Cher Ndour", "Assim Madibo",
  "Andy Diouf", "Ethan Nwaneri", "Jürgen Locadia", "Carlos Harvey", "Hugo Ekitiké", "Noah Sadiki", "Bil Nsongo",
  "Willem Geubbels", "Jamie Leweling", "Mohamed Toure", "Kevin Pina", "Ryan Mendes", "Jordan Ayew", "Oscar Bobb",
  "Lassana Coulibaly", "Mahdi Camara", "Wilson Isidor", "Kevin Schade", "Danny Namaso", "Geny Catamo", "Emersonn",
  "Lassine Sinayoko", "Luis Suárez", "Romário", "Carlos Valderrama", "Leandro Bacuna", "Jamal Musiala",
  "Axel Witsel", "Michael Olise", "Linton Maina", "Paris Brunner", "Angel Gomes", "Kaheem Parris", "Tyler Adams",
  "Raphinha", "Donyell Malen", "Deroy Duarte", "Youri Tielemans", "Antonio Nusa", "Leroy Sané", "Marlon Gomes",
  "Danilo Santos", "Iliman Ndiaye", "Matheus Cunha", "Diego Moreira", "Éderson", "Armand Laurienté", "Luis Díaz",
  "Francis-Ikechukwu Onyeka", "Naouirou Ahamada", "Tahith Chong", "Elye Wahi", "Marcus Tavernier", "Igor Thiago",
  "Cody Gakpo", "Tajon Buchanan", "Cristian Cásseres Jr.", "Ronaldo", "Rivaldo", "Paolo Guerrero", "Malik Tillman",
  "Weston McKennie", "Juninho Bacuna", "Boubacar Kamara", "Evanilson", "Pierre-Emerick Aubameyang", "Junior Adamu",
  "Cameron Archer", "Kévin Danois", "Mason Greenwood", "Edmílson Junior", "Felix Nmecha", "Warren Zaïre-Emery",
  "Gabriel Sara", "Joy-Lance Mickels", "Gjivai Zechiël", "Livano Comenencia", "Josh King", "Noah Okafor",
  "Oumar Ngom", "Morgan Rogers", "Bryan Mbeumo", "Arthur Atta", "Franck Honorat", "Derry Scherhant",
  "Corentin Tolisso", "Morgan Gibbs-White", "Dan Ndoye", "Dominic Solanke", "Antony", "Dailon Livramento",
  "Dominic Calvert-Lewin", "Nathan Saliba", "Ethan Mbappé", "Ethan Ampadu", "Arnaut Danjuma", "Kwasi Sibo",
  "Sofiane Diop", "Ludovic Ajorque",
])
export const STRAIGHT = new Set(["Rodrigo Mora", "Alessio Cacciamani", "Kaishu Sano"])
const lumOf = hex => {
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) return null
  const n = i => parseInt(hex.slice(i, i + 2), 16)
  return 0.299 * n(1) + 0.587 * n(3) + 0.114 * n(5)
}
// chip: a build chip (or a player): its name (qbFull, else name) and its skinColor (else skin)
export function curlyHair(chip) {
  const name = chip?.qbFull ?? chip?.name
  if (name && CURLS.has(name)) return true
  if (name && STRAIGHT.has(name)) return false
  const l = lumOf(chip?.skinColor ?? chip?.skin)
  return l != null && l < SKIN_CURL
}

// His hair's colour (the striker figure's hair and sideburn), read off his photo by scripts/soccer/hair-colors.py
// into data/soccer-hair.json (photo key -> one of the names below, 'bald' for a shaved or bald head). No photo, no
// entry: the figure keeps the art's own dark hair. Grey is drawn as the dark it was (the players are drawn at ~21).
// each a flat mid tone of that hair: the art's own light and shade are laid over it (StrikerFigureOverlay.jsx)
export const HAIR = {
  black: '#1c1613', darkbrown: '#35251a', brown: '#523724', lightbrown: '#745135', darkblond: '#957046',
  blond: '#bd975c', platinum: '#d8c9a2', auburn: '#73341f', ginger: '#ad5a2c',
}
// chip: a build chip (its photo URL, else its name and team); -> a HAIR name, 'bald', or null (no photo)
export function hairOf(chip) {
  const k = chip?.photo?.match(/headshots\/(.+)\.webp$/)?.[1]
    ?? soccerFaceKey({ name: chip?.qbFull ?? chip?.name, team: chip?.team, espn: chip?.espn })
  return (k && HAIR_OF[k]) || null
}
