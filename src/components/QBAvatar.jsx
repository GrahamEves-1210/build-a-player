import { useState } from 'react'

function Img({ src, className }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      className={className}
      src={src}
      alt=""
      onError={() => setFailed(true)}
    />
  )
}

export default function QBAvatar({ photo, team, color, size = 48 }) {
  return (
    <div className="qb-avatar" style={{ width: size, height: size, boxShadow: color ? `0 0 0 2px ${color}` : undefined }}>
      {team && (
        <Img key={team} className="qb-avatar-logo" src={`/logos/${team}.png`} />
      )}
      {photo && (
        <Img key={photo} className="qb-avatar-photo" src={photo} />
      )}
    </div>
  )
}
