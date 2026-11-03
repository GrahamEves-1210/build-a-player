// The online rating: how much a result moves it. Pure, shared by the game (lib/progress.js
// shows the change the moment a game ends) and the live server, which books the real
// rating (live/src/rating.js → supabase online_ratings, written by the server only).
// Fixed amounts, not opponent-weighted; never below 100; everyone starts at 800.

export const START_RATING = 800
export const MIN_RATING = 100
// Compete and the Trait Auction: by place; a pool of mostly bots counts for less
export const COMPETE_RATING = { 1: 24, 2: 12, 3: 4, 4: -6, 5: -12 }
// Leaving a live game: last place and a bigger hit
export const FORFEIT_RATING = -20
export const competeScale = humans => 0.5 + 0.5 * Math.min(1, Math.max(0, humans - 1) / 4)
export const competeDelta = ({ place, humans = 1, forfeit = false }) =>
  Math.round((forfeit ? FORFEIT_RATING : COMPETE_RATING[place] ?? -12) * competeScale(humans))
// Blacktop (1v1, 2v2, 3v3 on the live server): a win, a loss, the MVP; practice moves nothing
export const blacktopDelta = ({ won, mvp = false, forfeit = false, bots = false }) =>
  (bots ? 0 : forfeit ? FORFEIT_RATING : (won ? 20 : -12) + (mvp ? 5 : 0))
