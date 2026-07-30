export default function BottomNav({ aktywna, goTo, wersja }) {
  // W wersji turystycznej ta zakładka otwiera listę wyjazdów, nie grafik zmian —
  // podpis musi się zgadzać z kafelkiem na ekranie startowym.
  const czyTurystyka = wersja === 'turystyka'

  const items = [
    { id: 'home',     icon: '🏠', label: 'Start' },
    { id: 'grafik',   icon: czyTurystyka ? '🧳' : '📅', label: czyTurystyka ? 'Wyjazdy' : 'Grafik' },
    { id: 'usterki',  icon: '🔧', label: 'Usterki' },
    { id: 'telefony', icon: '📞', label: 'Telefony' },
  ]
  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button
          key={item.id}
          className={`nav-item ${aktywna === item.id ? 'active' : ''}`}
          onClick={() => goTo(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
