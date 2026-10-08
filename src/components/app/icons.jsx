// Filled, chunky game-UI icons for the iOS/Android app shell (24×24 grid).
// `currentColor` is the main fill; a few icons use a second tone via `accent`.
// Inner detail marks use --ag-ink (white by default; set to the button colour
// where the icon itself is white, so the details still read).
const INK = { fill: 'var(--ag-ink, #fff)' }
const INK_S = { stroke: 'var(--ag-ink, #fff)' }

const S = ({ size = 24, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>{children}</svg>
)

export const IconHome = p => (
  <S {...p}><path fill="currentColor" d="M2.6 11.1 11 3.6a1.5 1.5 0 0 1 2 0l8.4 7.5c.5.5.2 1.4-.5 1.4H19v7.6c0 .8-.7 1.4-1.4 1.4H14.6v-5.4c0-.7-.5-1.2-1.2-1.2h-2.8c-.7 0-1.2.5-1.2 1.2v5.4H6.4c-.8 0-1.4-.6-1.4-1.4v-7.6H3.1c-.7 0-1-.9-.5-1.4z"/></S>
)

export const IconTrophy = p => (
  <S {...p}>
    <path fill="currentColor" d="M6.5 2.5h11c.6 0 1 .4 1 1v.9h2.1c.5 0 .9.4.9.9v1.6a4.6 4.6 0 0 1-4.3 4.6 6.1 6.1 0 0 1-3.9 3.3v2.3h2.4c.7 0 1.3.6 1.3 1.3v2.6H7v-2.6c0-.7.6-1.3 1.3-1.3h2.4v-2.3a6.1 6.1 0 0 1-3.9-3.3A4.6 4.6 0 0 1 2.5 6.9V5.3c0-.5.4-.9.9-.9h2.1v-.9c0-.6.4-1 1-1zM4.4 6.3v.6a2.7 2.7 0 0 0 1.8 2.6 6 6 0 0 1-.7-2.8v-.4zm15.2 0h-1.1v.4c0 1-.2 1.9-.7 2.8a2.7 2.7 0 0 0 1.8-2.6z"/>
    <path fill="rgba(255,255,255,.45)" d="M9 5h2v5.5a3 3 0 0 1-2-2.7z"/>
  </S>
)

export const IconPlay = p => (
  <S {...p}><path fill="currentColor" d="M8.2 4.3c-1-.6-2.2.1-2.2 1.3v12.8c0 1.2 1.2 1.9 2.2 1.3l10.6-6.4c1-.6 1-2 0-2.6z"/></S>
)

export const IconProfile = p => (
  <S {...p}>
    <circle cx="12" cy="8" r="4.6" fill="currentColor"/>
    <path fill="currentColor" d="M3.4 20.2c.9-4 4.4-6.6 8.6-6.6s7.7 2.6 8.6 6.6c.2.7-.4 1.3-1.1 1.3H4.5c-.7 0-1.3-.6-1.1-1.3z"/>
  </S>
)

export const IconMenu = p => (
  <S {...p}>
    <rect x="3" y="3" width="8" height="8" rx="2.4" fill="currentColor"/>
    <rect x="13" y="3" width="8" height="8" rx="2.4" fill="currentColor" opacity=".72"/>
    <rect x="3" y="13" width="8" height="8" rx="2.4" fill="currentColor" opacity=".72"/>
    <rect x="13" y="13" width="8" height="8" rx="2.4" fill="currentColor"/>
  </S>
)

export const IconFootball = p => (
  <S {...p}>
    <path fill="currentColor" d="M20.7 3.3c-5-1.1-10.6.4-13.8 3.6S2.2 15.6 3.3 20.7c5.1 1.1 10.7-.4 13.9-3.6s4.6-8.7 3.5-13.8z"/>
    <path style={INK_S} strokeWidth="1.6" strokeLinecap="round" fill="none" d="M9 15l6-6M10.6 10.6l1.4 1.4M12 9.2l1.4 1.4M9.2 12l1.4 1.4"/>
  </S>
)

export const IconBasketball = p => (
  <S {...p}>
    <circle cx="12" cy="12" r="9.5" fill="currentColor"/>
    <path stroke="rgba(0,0,0,.45)" strokeWidth="1.4" fill="none" d="M2.5 12h19M12 2.5v19M5.3 5.3c2.6 2.4 2.6 11 0 13.4M18.7 5.3c-2.6 2.4-2.6 11 0 13.4"/>
  </S>
)

export const IconCrown = p => (
  <S {...p}>
    <path fill="currentColor" d="M3.2 7.6c-.1-.7.7-1.1 1.2-.7l3.9 3.2 2.9-5.6c.3-.6 1.3-.6 1.6 0l2.9 5.6 3.9-3.2c.5-.4 1.3 0 1.2.7l-1.6 10.1c-.1.6-.6 1-1.2 1H6c-.6 0-1.1-.4-1.2-1z"/>
    <rect x="5.5" y="19.6" width="13" height="2.2" rx="1.1" fill="currentColor"/>
    <circle cx="12" cy="13.6" r="1.6" fill="rgba(255,255,255,.6)"/>
  </S>
)

export const IconBolt = p => (
  <S {...p}><path fill="currentColor" d="M13.6 1.9c.4-.6 1.3-.2 1.2.5l-1.2 7.4h5.3c.6 0 1 .7.6 1.2l-9.1 11.1c-.4.6-1.3.2-1.2-.5l1.2-7.4H5.1c-.6 0-1-.7-.6-1.2z"/></S>
)

export const IconClipboard = p => (
  <S {...p}>
    <rect x="4" y="3.5" width="16" height="18.5" rx="3" fill="currentColor"/>
    <rect x="8" y="2" width="8" height="4" rx="1.6" style={INK}/>
    <path style={INK_S} strokeWidth="1.8" strokeLinecap="round" d="M8 10.5h8M8 14h8M8 17.5h5"/>
  </S>
)

export const IconCoin = p => (
  <S {...p}>
    <circle cx="12" cy="12" r="9.5" fill="currentColor"/>
    <circle cx="12" cy="12" r="7" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.3"/>
    <path style={INK} d="M12.8 6.5v1.1c1.2.2 2.1.9 2.4 2l-1.6.5c-.2-.6-.7-1-1.6-1-.9 0-1.4.4-1.4 1 0 .5.4.8 1.6 1.1l.8.2c1.9.5 2.6 1.3 2.6 2.6 0 1.4-1 2.3-2.8 2.5v1.1h-1.4v-1.1c-1.5-.2-2.5-1-2.7-2.3l1.7-.4c.1.8.8 1.2 1.8 1.2s1.6-.4 1.6-1-.4-.8-1.7-1.1l-.8-.2c-1.7-.4-2.5-1.2-2.5-2.5 0-1.3.9-2.2 2.4-2.4V6.5z"/>
  </S>
)

export const IconVersus = p => (
  <S {...p}>
    <path fill="currentColor" d="M4.2 3.4 9 4l7.8 7.8-2.7 2.7L6.3 6.7zM19.8 3.4 15 4l-3.1 3.1 2.7 2.7 3.1-3.1z"/>
    <path fill="currentColor" d="m5.6 13.3 2.1 2.1-2.8 2.8 1 1 2.8-2.8 2.1 2.1 1.4-1.4-5.2-5.2zM18.4 13.3l-2.1 2.1 2.8 2.8-1 1-2.8-2.8-2.1 2.1-1.4-1.4 5.2-5.2z" opacity=".8"/>
  </S>
)

export const IconLock = p => (
  <S {...p}>
    <rect x="4.5" y="10" width="15" height="11.5" rx="3" fill="currentColor"/>
    <path fill="none" stroke="currentColor" strokeWidth="2.4" d="M8 10V7.5a4 4 0 0 1 8 0V10"/>
    <circle cx="12" cy="15.6" r="1.7" fill="rgba(0,0,0,.4)"/>
  </S>
)

export const IconQuestion = p => (
  <S {...p}>
    <circle cx="12" cy="12" r="9.8" fill="currentColor"/>
    <path style={INK} d="M11.9 6.2c2.2 0 3.7 1.3 3.7 3.1 0 1.3-.7 2.1-1.8 2.8-.8.5-1 .8-1 1.5v.4h-2v-.6c0-1.2.5-1.9 1.5-2.5.9-.5 1.2-.9 1.2-1.5 0-.7-.6-1.2-1.6-1.2s-1.7.6-1.8 1.5l-2.1-.2c.2-2 1.7-3.3 3.9-3.3zm-1.2 9.3h2.3v2.3h-2.3z"/>
  </S>
)

export const IconInfo = p => (
  <S {...p}>
    <circle cx="12" cy="12" r="9.8" fill="currentColor"/>
    <rect x="10.8" y="10.4" width="2.4" height="7.4" rx="1.2" style={INK}/>
    <circle cx="12" cy="7.3" r="1.5" style={INK}/>
  </S>
)

export const IconChat = p => (
  <S {...p}>
    <path fill="currentColor" d="M5 3.5h14a3 3 0 0 1 3 3v8.5a3 3 0 0 1-3 3h-6.3l-4.6 3.6c-.6.5-1.6 0-1.6-.8V18H5a3 3 0 0 1-3-3V6.5a3 3 0 0 1 3-3z"/>
    <circle cx="8" cy="10.8" r="1.4" style={INK}/><circle cx="12" cy="10.8" r="1.4" style={INK}/><circle cx="16" cy="10.8" r="1.4" style={INK}/>
  </S>
)

export const IconDiscord = p => (
  <S {...p}><path fill="currentColor" d="M20.3 4.4a19.8 19.8 0 0 0-4.9-1.5l-.6 1.3a18.3 18.3 0 0 0-5.5 0L8.7 2.9a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2a13 13 0 0 1-2-.9l.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4c-.6.4-1.3.7-2 .9l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.5-13.7zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></S>
)

export const IconX = p => (
  <S {...p}><path fill="currentColor" d="M18.2 2.3h3.3l-7.2 8.3 8.5 11.2h-6.6l-5.2-6.8-6 6.8H1.7l7.7-8.8L1.3 2.3H8l4.7 6.2zm-1.2 17.5h1.8L7.1 4.1H5.1z"/></S>
)

export const IconShield = p => (
  <S {...p}><path fill="currentColor" d="M12 2.2 4 5.3v6.1c0 5 3.4 9.1 8 10.4 4.6-1.3 8-5.4 8-10.4V5.3z"/><path fill="none" style={INK_S} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m8.6 12 2.3 2.3 4.6-4.6"/></S>
)

export const IconDoc = p => (
  <S {...p}><path fill="currentColor" d="M6 2h8.5L20 7.5V19a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z"/><path fill="rgba(255,255,255,.5)" d="M14.5 2v4a1.5 1.5 0 0 0 1.5 1.5h4z"/><path style={INK_S} strokeWidth="1.7" strokeLinecap="round" d="M7 12.5h9M7 16h6"/></S>
)

export const IconClose = p => (
  <S {...p}><path stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></S>
)

export const IconSpin = p => (
  <S {...p}><path fill="currentColor" d="M12 3a9 9 0 0 1 8.3 5.5l1.4-.6c.6-.2 1.1.4.8 1l-2.2 4.1c-.2.4-.7.5-1.1.3l-4-2.3c-.6-.3-.5-1.2.1-1.4l1.6-.6A6.2 6.2 0 0 0 5.8 12a1.4 1.4 0 1 1-2.8 0A9 9 0 0 1 12 3zm0 18a9 9 0 0 1-8.3-5.5l-1.4.6c-.6.2-1.1-.4-.8-1l2.2-4.1c.2-.4.7-.5 1.1-.3l4 2.3c.6.3.5 1.2-.1 1.4l-1.6.6A6.2 6.2 0 0 0 18.2 12a1.4 1.4 0 1 1 2.8 0A9 9 0 0 1 12 21z"/></S>
)

export const IconBuild = p => (
  <S {...p}><path fill="currentColor" d="M21.2 6.4 18 9.6l-3.6-3.6 3.2-3.2a5.6 5.6 0 0 0-7.1 7.4L2.6 18a2.4 2.4 0 1 0 3.4 3.4l7.8-7.9a5.6 5.6 0 0 0 7.4-7.1z"/></S>
)

export const IconStar = p => (
  <S {...p}><path fill="currentColor" d="m12 2.6 2.7 5.6 6.1.9c.6.1.8.8.4 1.2l-4.4 4.3 1 6.1c.1.6-.5 1-1 .7L12 18.6l-5.5 2.8c-.5.3-1.1-.1-1-.7l1-6.1-4.4-4.3c-.4-.4-.2-1.1.4-1.2l6.1-.9z"/></S>
)

export const IconCalendar = p => (
  <S {...p}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="3" fill="currentColor"/>
    <rect x="6.5" y="2.5" width="2.4" height="4.5" rx="1.2" fill="currentColor"/>
    <rect x="15.1" y="2.5" width="2.4" height="4.5" rx="1.2" fill="currentColor"/>
    <rect x="3" y="8.5" width="18" height="1.6" style={INK} opacity=".35"/>
    <path style={INK} d="m12 11.6 1.3 2.6 2.8.4-2 2 .5 2.8-2.6-1.4-2.6 1.4.5-2.8-2-2 2.8-.4z"/>
  </S>
)

export const IconCards = p => (
  <S {...p}>
    <rect x="2.6" y="5.4" width="11.5" height="15.6" rx="2.2" transform="rotate(-10 8.4 13.2)" fill="currentColor" opacity=".55"/>
    <rect x="8.5" y="3" width="12.5" height="17" rx="2.4" fill="currentColor"/>
    <circle cx="14.75" cy="9.6" r="2.6" style={INK} opacity=".55"/>
    <path style={INK} opacity=".55" d="M10.8 17c.6-2.2 2-3.4 3.95-3.4s3.35 1.2 3.95 3.4z"/>
  </S>
)

export const IconGear = p => (
  <S {...p}>
    <path fill="currentColor" d="M10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.8c.1.6.1 1.3 0 1.9l2 1.8-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.7-2.9 2-1.8a6 6 0 0 1 0-1.9l-2-1.8 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9z" transform="translate(0 2)"/>
    <circle cx="12" cy="12.5" r="3" style={INK} opacity=".9"/>
  </S>
)

export const IconFlame = p => (
  <S {...p}>
    <path fill="currentColor" d="M12.6 1.8c.4 3.1 2.4 4.6 4.1 6.6a8.2 8.2 0 0 1 2.1 5.5A6.9 6.9 0 0 1 12 21.2a6.9 6.9 0 0 1-6.8-7c0-2.4 1-4.3 2.6-6 .3 1.6 1 2.7 2.2 3.3-.2-3.6 1-6.9 2.6-9.7z"/>
    <path fill="rgba(255,255,255,.55)" d="M12.2 11.6c.3 1.6 1.6 2.4 2.1 3.6.7 1.8-.6 3.8-2.4 3.8a2.7 2.7 0 0 1-2.7-2.8c0-1.6 1.2-2.9 3-4.6z"/>
  </S>
)

export const IconGift = p => (
  <S {...p}>
    <rect x="3" y="9" width="18" height="5" rx="1.6" fill="currentColor"/>
    <rect x="4.5" y="14" width="15" height="7.5" rx="1.8" fill="currentColor" opacity=".8"/>
    <rect x="10.8" y="9" width="2.4" height="12.5" style={INK} opacity=".55"/>
    <path fill="currentColor" d="M12 8.6c-1.4-3-4.8-5-6.2-3.3-1.2 1.5.6 3.4 6.2 3.3zm0 0c1.4-3 4.8-5 6.2-3.3 1.2 1.5-.6 3.4-6.2 3.3z"/>
  </S>
)

export const IconTarget = p => (
  <S {...p}>
    <circle cx="12" cy="12" r="9.6" fill="currentColor"/>
    <circle cx="12" cy="12" r="6.2" style={INK} opacity=".35"/>
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
  </S>
)

export const IconCheck = p => (
  <S {...p}><path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5"/></S>
)

export const IconArrow = p => (
  <S {...p}><path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12.5 5.5 19 12l-6.5 6.5"/></S>
)

export const IconRing = p => (
  <S {...p}>
    <path fill="currentColor" d="M8.4 2.5h7.2l2 3.2-5.6 4.1-5.6-4.1z"/>
    <path fill="rgba(255,255,255,.55)" d="M9.6 3.7h4.8l.9 1.6L12 7.6 8.7 5.3z"/>
    <path fill="none" stroke="currentColor" strokeWidth="2.6" d="M12 9.6a6.2 6.2 0 1 0 .01 0z"/>
  </S>
)

export const IconPodium = p => (
  <S {...p}>
    <rect x="8.6" y="7" width="6.8" height="14" rx="1.4" fill="currentColor"/>
    <rect x="2" y="11.5" width="6.2" height="9.5" rx="1.4" fill="currentColor" opacity=".72"/>
    <rect x="15.8" y="14" width="6.2" height="7" rx="1.4" fill="currentColor" opacity=".55"/>
    <path fill="currentColor" d="m12 1.6 1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2-1.6-1.6 2.2-.3z"/>
  </S>
)

export const IconFlask = p => (
  <S {...p}>
    <path fill="currentColor" d="M8.6 2.4h6.8c.6 0 1 .4 1 1s-.4 1-1 1h-.6v4.4l5.3 8.9c1 1.7-.2 3.9-2.2 3.9H6.1c-2 0-3.2-2.2-2.2-3.9l5.3-8.9V4.4h-.6c-.6 0-1-.4-1-1s.4-1 1-1z"/>
    <path {...INK} opacity=".55" d="M7.2 15.2h9.6l1.6 2.7c.3.5-.1 1.1-.6 1.1H6.2c-.6 0-.9-.6-.6-1.1z"/>
  </S>
)
export const IconSliders = p => (
  <S {...p}>
    <rect x="3" y="5" width="18" height="2.6" rx="1.3" fill="currentColor"/><circle cx="15" cy="6.3" r="2.6" fill="currentColor"/>
    <rect x="3" y="10.7" width="18" height="2.6" rx="1.3" fill="currentColor"/><circle cx="8" cy="12" r="2.6" fill="currentColor"/>
    <rect x="3" y="16.4" width="18" height="2.6" rx="1.3" fill="currentColor"/><circle cx="16.5" cy="17.7" r="2.6" fill="currentColor"/>
  </S>
)
export const IconBag = p => (
  <S {...p}>
    <path fill="currentColor" d="M5.3 7.5h13.4c.6 0 1.1.5 1.2 1.1l1 11.2c.1.9-.6 1.7-1.5 1.7H4.6c-.9 0-1.6-.8-1.5-1.7l1-11.2c.1-.6.6-1.1 1.2-1.1z"/>
    <path fill="none" {...INK_S} strokeWidth="1.8" strokeLinecap="round" d="M8.6 10V6.4a3.4 3.4 0 0 1 6.8 0V10"/>
  </S>
)
export const IconMedal = p => (
  <S {...p}>
    <path fill="currentColor" opacity=".55" d="M7 2h4l2 6H9zM13 2h4l-2 6h-4z"/>
    <circle cx="12" cy="15" r="6.6" fill="currentColor"/>
    <path {...INK} d="m12 11.2 1.1 2.3 2.5.3-1.8 1.7.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.3z"/>
  </S>
)
export const IconSwap = p => (
  <S {...p}>
    <path fill="currentColor" d="M16.6 3.3a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1 0 1.4l-3 3a1 1 0 0 1-1.7-.7V8H4a1 1 0 1 1 0-2h12.3V4c0-.3.1-.5.3-.7zM7.4 13.3a1 1 0 0 1 .3.7v2h12.3a1 1 0 1 1 0 2H7.7v2a1 1 0 0 1-1.7.7l-3-3a1 1 0 0 1 0-1.4l3-3a1 1 0 0 1 1.4 0z"/>
  </S>
)
export const IconSend = p => (
  <S {...p}><path fill="currentColor" d="M3.4 11.1 19.3 4.3c1-.4 2 .6 1.6 1.6l-6.8 15.9c-.4 1-1.9 1-2.2-.1l-1.6-5.4a1 1 0 0 0-.7-.7l-5.4-1.6c-1.1-.3-1.1-1.8-.1-2.2z"/></S>
)
export const IconWhistle = p => (
  <S {...p}>
    <path fill="currentColor" d="M3 11.5a6.5 6.5 0 0 1 11.9-3.6l5.7-1.9c.7-.2 1.4.3 1.4 1v3c0 .5-.3.9-.8 1l-4.1 1A6.5 6.5 0 1 1 3 11.5z"/>
    <circle cx="9.5" cy="11.5" r="2.6" {...INK} opacity=".55"/>
    <rect x="6" y="2.5" width="3" height="4" rx="1" fill="currentColor"/>
  </S>
)
export const IconHelmet = p => (
  <S {...p}>
    <path fill="currentColor" d="M12.6 3C7.3 3 3 6.9 3 12c0 2 .7 3.9 1.9 5.4.4.5 1 .8 1.6.8h4.2l1.2 2h4.6l-1.3-2.2 2.6-.3V14h3.2c.6 0 1-.4 1-1v-.5C22 7.2 17.9 3 12.6 3z"/>
    <path fill="none" {...INK_S} strokeWidth="1.6" strokeLinecap="round" d="M15.5 14v3.6M15.5 15.7H21M18.5 14v3.6"/>
    <circle cx="11" cy="10.5" r="1.6" {...INK} opacity=".55"/>
  </S>
)
export const IconHoop = p => (
  <S {...p}>
    <circle cx="12" cy="5.6" r="3.4" fill="currentColor"/>
    <path fill="none" {...INK_S} strokeWidth=".9" d="M8.8 5.6h6.4M12 2.2v6.8"/>
    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" d="M5 10.5h14l-2.3 10H7.3z"/>
    <path fill="none" stroke="currentColor" strokeWidth="1.3" d="m7.5 10.5 6 10M16.5 10.5l-6 10M10.3 10.5l4.2 10M13.7 10.5l-4.2 10"/>
  </S>
)
