// Creators who have played Build-A-Player / Build-A-Bucket on camera.
// Verified October 7, 2026: every YouTube entry either links build-a-player.com
// in its description or plays the game by name (Build-A-Bucket is only ours).
// Videos under 1,000 views are left out.
// Items: { type: 'youtube' | 'tiktok', id | url, title, date, views, short, game: 'nfl' | 'nba' }
export const CREATORS_AS_OF = 'October 7, 2026'

export const CREATORS = [
  {
    id: 'house-call', name: 'House Call', url: 'https://www.youtube.com/channel/UCx236IQ7xAa8EJWERW_IXQw', blurb: 'NFL podcast · YouTube & TikTok (@housecallpod)',
    items: [
      { type: 'youtube', id: 'VzJJ0-FBnNs', title: 'Building A 99 Overall NFL Quarterback!', date: '2026-08-07', views: 1281293, short: true, game: 'nfl' },
      { type: 'youtube', id: 'lVGFZVC6qYA', title: 'NFL Build-A-Running Back!', date: '2026-08-09', views: 735445, short: true, game: 'nfl' },
      { type: 'youtube', id: 'Qlw27Vd5j2U', title: 'Building The Perfect 2026 NFL RB!', date: '2026-08-23', views: 427802, short: true, game: 'nfl' },
      { type: 'youtube', id: 'ix-x2lEr1aQ', title: 'We Played NFL Build-A-Player', date: '2026-08-10', views: 77979, short: false, game: 'nfl' },
      { type: 'tiktok', url: 'https://www.tiktok.com/@housecallpod/video/7675535836024261902', title: 'Trying to build the GOAT NFL QB on build a player!', date: null, views: null, short: true, game: 'nfl' },
      { type: 'tiktok', url: 'https://www.tiktok.com/@housecallpod/video/7671463897794153742', title: 'Building a 99 overall NFL quarterback!', date: null, views: null, short: true, game: 'nfl' },
    ],
  },
  {
    id: 'the-deep-3', name: 'The Deep 3', url: 'https://www.youtube.com/channel/UCmgMQUgO5nJxM5ORoz59MXg', blurb: 'NBA podcast',
    items: [
      { type: 'youtube', id: 'upzT0wOCudw', title: 'NBA Build A Bucket: Big Man Edition!', date: '2026-08-19', views: 673524, short: true, game: 'nba' },
      { type: 'youtube', id: 'Bq6E7VQvCK0', title: 'NBA Build A Bucket: Guards!', date: '2026-08-12', views: 658945, short: true, game: 'nba' },
      { type: 'youtube', id: 'BUOgGl2k9c4', title: 'NBA Build A Bucket: Budget Edition!', date: '2026-08-21', views: 387319, short: true, game: 'nba' },
      { type: 'youtube', id: 'EOmygYLMO4Q', title: 'We Played NBA Build-A-Bucket', date: '2026-08-12', views: 148553, short: false, game: 'nba' },
    ],
  },
  {
    id: 'kennytoo', name: 'KennyToo', url: 'https://www.youtube.com/channel/UCwZxrVDYtUtuLYqtzHa1yoA', blurb: 'Kenny Beecham',
    items: [
      { type: 'youtube', id: 'fikCWk1HfnI', title: 'I Tried To Build A New NBA Goat (Build-A-Bucket)', date: '2026-07-22', views: 171154, short: false, game: 'nba' },
    ],
  },
  {
    id: 'danny2k', name: 'Danny2K', url: 'https://www.youtube.com/channel/UCbTsb893rochfiVVtMPdkYw', blurb: null,
    items: [
      { type: 'youtube', id: 'IRd9YHEGmy0', title: 'Can I Create a 99 OVR on Build a Bucket?', date: '2026-07-16', views: 145559, short: false, game: 'nba' },
    ],
  },
  {
    id: 'bogey', name: 'Bogey', url: 'https://www.youtube.com/channel/UCCDcpuv13YbO6OTOVsGx9RA', blurb: 'Madden creator (@TheRealBogey)',
    items: [
      { type: 'youtube', id: '2FXNFCunfA8', title: 'I Played "Build-A-QB" And Created a New Goat', date: '2026-09-04', views: 60017, short: false, game: 'nfl' },
    ],
  },
  {
    id: 'couch-quarterbacks', name: 'Couch Quarterbacks', url: 'https://www.youtube.com/channel/UCC9a_nz3706nuP5nj7020Eg', blurb: 'Bengal & Wheelz',
    items: [
      { type: 'youtube', id: 'bEO24Wb3Zik', title: 'Can We Build the Perfect NFL Player', date: '2026-09-22', views: 25105, short: false, game: 'nfl' },
    ],
  },
  {
    id: 'cel-on-air', name: 'Cel On Air', url: 'https://www.youtube.com/channel/UCao13tvvjYlKfN6m6hwRr0A', blurb: 'Also live on Twitch (marcelashoward)',
    items: [
      { type: 'youtube', id: 'BXoOqhBvg7c', title: 'I Attempted To Build The Perfect NBA Player (Build-A-Bucket)', date: '2026-08-03', views: 6428, short: false, game: 'nba' },
    ],
  },
]
