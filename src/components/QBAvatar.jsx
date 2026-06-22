export default function QBAvatar({ photo, team, color, size = 48 }) {
  return (
    <div className="qb-avatar" style={{ width: size, height: size, boxShadow: color ? `0 0 0 2px ${color}` : undefined }}>
      {team && (
        <img
          className="qb-avatar-logo"
          src={`/logos/${team}.png`}
          alt=""
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
      )}
      {photo ? (
        <img
          className="qb-avatar-photo"
          src={photo}
          alt=""
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
      ) : (
        <div className="qb-avatar-fallback" />
      )}
    </div>
  )
}
