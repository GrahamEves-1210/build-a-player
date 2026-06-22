function luma(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000
}
function secondary(hex) {
  return luma(hex) > 145 ? '#111111' : '#ffffff'
}

export default function QBFigure({ build = null, className = '' }) {
  const slot = (type) => build?.[type] ?? null

  const iq   = slot('processing')
  const comp = slot('playmaking')
  const arm  = slot('arm')
  const str  = slot('size')
  const acc  = slot('accuracy')
  const mob  = slot('legs')

  const helmetCp   = iq   ? iq.teamColor                                : null
  const helmetCs   = iq   ? (iq.teamColor2 ?? secondary(iq.teamColor))  : null
  const faceCf     = comp ? (comp.skinColor ?? '#c49a6c')               : null
  const shoulderCp = arm  ? arm.teamColor                               : null
  const sleeveCp   = arm  ? (arm.teamColor2 ?? secondary(arm.teamColor)): null
  const handCf     = acc  ? (acc.skinColor ?? '#c49a6c')                : null
  const torsoCp    = str  ? str.teamColor                               : null
  const torsoCs    = str  ? (str.teamColor2 ?? secondary(str.teamColor)): null
  const legCp      = mob  ? mob.teamColor                               : null
  const sockCs     = mob  ? (mob.teamColor2 ?? secondary(mob.teamColor)): null
  const shoeCsh    = mob  ? '#0d0d0d'                                   : null

  const f  = (c) => c ?? 'transparent'
  const OL = 'rgba(200,220,210,0.28)'
  const sw = '0.8'
  const tr = { transition: 'fill 0.5s ease' }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 450"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="qbf-hg" x1="25%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%"   stopColor="#fff" stopOpacity="0.13"/>
          <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="qbf-jg" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#fff" stopOpacity="0.07"/>
          <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* FACE */}
      <ellipse fill={f(faceCf)} cx="100" cy="62" rx="34" ry="42"
        stroke={OL} strokeWidth={sw} style={tr}/>

      {/* HELMET SHELL */}
      <path fill={f(helmetCp)} fillRule="evenodd"
        stroke={OL} strokeWidth={sw} style={tr}
        d="M100 5 C56 5 44 24 44 52 C44 70 52 82 64 88 L64 94 L136 94 L136 88
           C148 82 156 70 156 52 C156 24 144 5 100 5 Z
           M68 90 Q100 97 132 90 L132 44 C132 30 118 24 100 24
           C82 24 68 30 68 44 Z"/>
      {helmetCp && (
        <>
          <path fill="url(#qbf-hg)" fillRule="evenodd"
            d="M100 5 C56 5 44 24 44 52 C44 70 52 82 64 88 L64 94 L136 94 L136 88
               C148 82 156 70 156 52 C156 24 144 5 100 5 Z
               M68 90 Q100 97 132 90 L132 44 C132 30 118 24 100 24 C82 24 68 30 68 44 Z"/>
          <path fill={f(helmetCs)} opacity="0.6" d="M94 6 L106 6 L107 91 L93 91 Z"/>
        </>
      )}
      <ellipse fill={f(helmetCp)} cx="48"  cy="60" rx="5" ry="9" opacity="0.7"
        stroke={OL} strokeWidth="0.5" style={tr}/>
      <ellipse fill={f(helmetCp)} cx="152" cy="60" rx="5" ry="9" opacity="0.7"
        stroke={OL} strokeWidth="0.5" style={tr}/>

      {/* VISOR */}
      <path fill={helmetCp ? '#040c14' : 'transparent'}
        stroke={OL} strokeWidth={sw} style={tr}
        d="M68 44 C68 36 82 32 100 32 C118 32 132 36 132 44
           L132 72 C132 80 118 84 100 84 C82 84 68 80 68 72 Z"/>
      {helmetCp && (
        <>
          <ellipse cx="84"  cy="56" rx="9"   ry="5.5" fill="rgba(255,255,255,0.07)"/>
          <ellipse cx="116" cy="56" rx="9"   ry="5.5" fill="rgba(255,255,255,0.07)"/>
          <ellipse cx="83"  cy="54" rx="4.5" ry="2.5" fill="rgba(255,255,255,0.11)"/>
          <ellipse cx="115" cy="54" rx="4.5" ry="2.5" fill="rgba(255,255,255,0.11)"/>
        </>
      )}

      {/* HELMET JAW RIM */}
      <path fill={f(helmetCp)} opacity="0.93"
        stroke={OL} strokeWidth="0.5" style={tr}
        d="M64 88 L64 94 L136 94 L136 88
           C130 91 116 93 100 93 C84 93 70 91 64 88 Z"/>

      {/* FACEMASK */}
      {helmetCp && (
        <g fill="none" stroke="rgba(200,212,228,0.55)" strokeLinecap="round">
          <path strokeWidth="2.2" d="M67 76 C72 88 85 98 100 102 C115 98 128 88 133 76"/>
          <path strokeWidth="2.2" d="M68 84 C74 96 87 106 100 110 C113 106 126 96 132 84"/>
          <line strokeWidth="2.2" x1="100" y1="76" x2="100" y2="110"/>
          <path strokeWidth="2.8" d="M78 94 Q100 103 122 94"/>
        </g>
      )}

      {/* NECK */}
      <path fill={f(faceCf)} stroke={OL} strokeWidth={sw} style={tr}
        d="M87 94 L113 94 L115 110 L85 110 Z"/>

      {/* SHOULDERS */}
      <path fill={f(shoulderCp)} stroke={OL} strokeWidth={sw} style={tr}
        d="M36 108 Q9 108 5 123 Q3 133 13 136 L42 127 L42 110 Z"/>
      {shoulderCp && (
        <path fill="rgba(255,255,255,0.1)"
          d="M36 108 Q14 109 8 119 L10 114 Q21 105 36 105 Z"/>
      )}
      <path fill={f(shoulderCp)} stroke={OL} strokeWidth={sw} style={tr}
        d="M164 108 Q191 108 195 123 Q197 133 187 136 L158 127 L158 110 Z"/>
      {shoulderCp && (
        <path fill="rgba(255,255,255,0.1)"
          d="M164 108 Q186 109 192 119 L190 114 Q179 105 164 105 Z"/>
      )}

      {/* TORSO */}
      <path fill={f(torsoCp)} stroke={OL} strokeWidth={sw} style={tr}
        d="M36 106 L164 106 L168 116 L170 224 L30 224 L32 116 Z"/>
      {torsoCp && (
        <>
          <path fill="url(#qbf-jg)"
            d="M36 106 L164 106 L168 116 L170 224 L30 224 L32 116 Z"/>
          <path fill="rgba(255,255,255,0.06)"
            d="M58 106 L142 106 L144 120 L146 162 L54 162 L56 120 Z"/>
          <path fill={f(helmetCp ?? torsoCp)}
            d="M87 106 Q100 101 113 106 L113 114 Q100 109 87 114 Z"/>
          <text fill="none" stroke={torsoCp} strokeWidth="5"
            fontFamily="'Outfit',Arial Black,sans-serif" fontWeight="900" fontSize="54"
            x="100" y="186" textAnchor="middle" dominantBaseline="middle"
            letterSpacing="-3" opacity="0.4">00</text>
          <text fill={f(torsoCs)}
            fontFamily="'Outfit',Arial Black,sans-serif" fontWeight="900" fontSize="54"
            x="100" y="186" textAnchor="middle" dominantBaseline="middle"
            letterSpacing="-3" opacity="0.9">00</text>
        </>
      )}

      {/* SLEEVES */}
      <path fill={f(sleeveCp)} stroke={OL} strokeWidth={sw} style={tr}
        d="M36 106 L10 134 L2 192 L22 196 L44 128 L44 110 Z"/>
      {sleeveCp && shoulderCp && (
        <>
          <path fill={shoulderCp} opacity="0.5" d="M8 160 L26 157 L24 171 L4 174 Z"/>
          <path fill={sleeveCp}   opacity="0.35" d="M8 170 L26 167 L25 172 L6 175 Z"/>
        </>
      )}
      <path fill={f(sleeveCp)} stroke={OL} strokeWidth={sw} style={tr}
        d="M164 106 L190 134 L198 192 L178 196 L156 128 L156 110 Z"/>
      {sleeveCp && shoulderCp && (
        <>
          <path fill={shoulderCp} opacity="0.5" d="M192 160 L174 157 L176 171 L196 174 Z"/>
          <path fill={sleeveCp}   opacity="0.35" d="M192 170 L174 167 L175 172 L194 175 Z"/>
        </>
      )}

      {/* HANDS */}
      <path fill={f(handCf)} stroke={OL} strokeWidth={sw} style={tr}
        d="M2 192 Q0 195 0 204 Q0 214 6 216 L20 216 Q26 213 26 204
           L26 196 Q26 190 20 190 L6 190 Q2 190 2 192 Z"/>
      {handCf && (
        <>
          <line stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" x1="8"  y1="192" x2="8"  y2="215"/>
          <line stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" x1="14" y1="191" x2="14" y2="216"/>
          <line stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" x1="20" y1="192" x2="20" y2="215"/>
        </>
      )}
      <path fill={f(handCf)} stroke={OL} strokeWidth={sw} style={tr}
        d="M198 192 Q200 195 200 204 Q200 214 194 216 L180 216 Q174 213 174 204
           L174 196 Q174 190 180 190 L194 190 Q198 190 198 192 Z"/>
      {handCf && (
        <>
          <line stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" x1="192" y1="192" x2="192" y2="215"/>
          <line stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" x1="186" y1="191" x2="186" y2="215"/>
          <line stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" x1="180" y1="192" x2="180" y2="215"/>
        </>
      )}

      {/* BELT */}
      <rect fill={f(torsoCs)} x="30" y="220" width="140" height="10" rx="3"
        stroke={OL} strokeWidth="0.5" style={tr}/>
      {torsoCp && (
        <>
          <rect fill="rgba(210,200,165,0.75)" x="93" y="222" width="14" height="6" rx="2"/>
          <rect fill="rgba(255,255,255,0.3)"  x="98" y="223" width="4"  height="4" rx="1"/>
        </>
      )}

      {/* PANTS HIP */}
      <path fill={f(legCp)} stroke={OL} strokeWidth={sw} style={tr}
        d="M32 230 L168 230 L162 302 L120 302
           Q106 292 100 290 Q94 292 80 302 L38 302 Z"/>
      {legCp && (
        <rect fill={f(sockCs)} x="97" y="230" width="6" height="72" opacity="0.17"/>
      )}

      {/* LEGS */}
      <path fill={f(legCp)} stroke={OL} strokeWidth={sw} style={tr} d="M40 302 L80  302 L78  340 L42  340 Z"/>
      <path fill={f(legCp)} stroke={OL} strokeWidth={sw} style={tr} d="M120 302 L160 302 L158 340 L122 340 Z"/>

      <ellipse fill={f(legCp)} cx="60"  cy="342" rx="19" ry="7" stroke={OL} strokeWidth="0.5" style={tr}/>
      {legCp && <ellipse fill="rgba(255,255,255,0.15)" cx="60"  cy="340" rx="11" ry="4"/>}
      <ellipse fill={f(legCp)} cx="140" cy="342" rx="19" ry="7" stroke={OL} strokeWidth="0.5" style={tr}/>
      {legCp && <ellipse fill="rgba(255,255,255,0.15)" cx="140" cy="340" rx="11" ry="4"/>}

      {/* CALVES */}
      <path fill={f(legCp)} stroke={OL} strokeWidth={sw} style={tr} d="M44 349 L76  349 L74  406 L46  406 Z"/>
      <path fill={f(legCp)} stroke={OL} strokeWidth={sw} style={tr} d="M124 349 L156 349 L154 406 L126 406 Z"/>

      {/* SOCKS */}
      <path fill={f(sockCs)} stroke={OL} strokeWidth="0.5" style={tr} d="M46 406 L74  406 L73  422 L47  422 Z"/>
      {legCp && (
        <>
          <path fill={legCp} opacity="0.55" d="M46 410 L74 410 L74 414 L46 414 Z"/>
          <path fill={legCp} opacity="0.3"  d="M46 417 L74 417 L74 420 L46 420 Z"/>
        </>
      )}
      <path fill={f(sockCs)} stroke={OL} strokeWidth="0.5" style={tr} d="M126 406 L154 406 L153 422 L127 422 Z"/>
      {legCp && (
        <>
          <path fill={legCp} opacity="0.55" d="M126 410 L154 410 L154 414 L126 414 Z"/>
          <path fill={legCp} opacity="0.3"  d="M126 417 L154 417 L154 420 L126 420 Z"/>
        </>
      )}

      {/* SHOES */}
      <path fill={f(shoeCsh)} stroke={OL} strokeWidth={sw} style={tr}
        d="M47 420 L73 420 L73 438 Q73 446 65 446 L34 446 Q26 446 26 438
           Q26 431 32 429 L47 428 Z"/>
      {legCp && (
        <>
          <path fill="rgba(35,35,35,0.7)" d="M47 420 L73 420 L73 428 L47 428 Z"/>
          <path fill="rgba(22,22,22,0.9)"
            d="M26 441 Q26 447 34 447 L65 447 Q73 447 73 441 L73 446
               Q73 450 65 450 L34 450 Q26 450 26 446 Z"/>
        </>
      )}
      <path fill={f(shoeCsh)} stroke={OL} strokeWidth={sw} style={tr}
        d="M127 420 L153 420 L153 428 L168 429 Q174 431 174 438
           Q174 446 166 446 L135 446 Q127 446 127 438 Z"/>
      {legCp && (
        <>
          <path fill="rgba(35,35,35,0.7)" d="M127 420 L153 420 L153 428 L127 428 Z"/>
          <path fill="rgba(22,22,22,0.9)"
            d="M127 441 Q127 447 135 447 L166 447 Q174 447 174 441 L174 446
               Q174 450 166 450 L135 450 Q127 450 127 446 Z"/>
        </>
      )}
    </svg>
  )
}
