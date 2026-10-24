import { useState } from 'react'
import { isGenericHead } from '../lib/noPhotos'

function Img({ src, className, style }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      className={className}
      style={style}
      src={src}
      alt=""
      onError={() => setFailed(true)}
    />
  )
}

export default function QBAvatar({ photo: given, team, color, size = 48, logoDir = '/logos/', faceCenter }) {
  // app-clean: a circle is the team badge; the default heads belong on the figure, not here
  const photo = isGenericHead(given) ? null : given
  const photoStyle = faceCenter ? { objectPosition: `${faceCenter[0]}% ${faceCenter[1]}%` } : undefined
  return (
    <div className="qb-avatar" style={{ width: size, height: size, boxShadow: color ? `0 0 0 2px ${color}` : undefined }}>
      {team && (
        <Img key={team} className="qb-avatar-logo" src={`${logoDir}${team}.svg`} />
      )}
      {photo && (
        <Img key={photo} className="qb-avatar-photo" src={photo} style={photoStyle} />
      )}
    </div>
  )
}
