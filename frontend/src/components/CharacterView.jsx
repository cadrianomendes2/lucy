const ANIM = {
  idle:     '/animations/idle.webp',
  talking:  '/animations/talking.webp',
  pleaseme: '/animations/pleaseme.webp',
}

export default function CharacterView({ animation }) {
  return (
    <div style={{
      width: '40%',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      overflow: 'hidden',
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
    }}>
      <img
        key={animation}
        src={ANIM[animation] ?? ANIM.idle}
        alt="Lucy"
        style={{
          maxHeight: '100%',
          maxWidth: '100%',
          objectFit: 'contain',
          objectPosition: 'bottom',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
