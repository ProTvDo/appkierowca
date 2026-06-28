export default function BottomNav({ aktywna, goTo }) {
  const items = [
    { id: 'home',     icon: '🏠', label: 'Start' },
    { id: 'grafik',   icon: '📅', label: 'Grafik' },
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
