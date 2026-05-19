const LANGS = [
  { id: 'pt', flag: '🇧🇷', label: 'PT' },
  { id: 'en', flag: '🇬🇧', label: 'EN' },
]

export default function LanguageSelector({ language, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {LANGS.map(l => (
        <button
          key={l.id}
          onClick={() => onChange(l.id)}
          title={l.label}
          style={{
            padding: '4px 8px',
            borderRadius: 8,
            fontSize: 18,
            lineHeight: 1,
            background: language === l.id ? 'var(--border)' : 'transparent',
            border: `1px solid ${language === l.id ? 'var(--accent)' : 'transparent'}`,
            opacity: language === l.id ? 1 : 0.4,
            transition: 'all 0.15s',
          }}
        >
          {l.flag}
        </button>
      ))}
    </div>
  )
}
