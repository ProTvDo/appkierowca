import { useState, useEffect } from 'react'
import api from '../api'
import Toast from '../components/Toast'

export default function Usterki({ token, kierowca, goTo }) {
  const [pojazdy, setPojazdy]       = useState([])
  const [kategorie, setKategorie]   = useState([])
  const [pojazd, setPojazd]         = useState('')
  const [kategoria, setKategoria]   = useState('')
  const [opis, setOpis]             = useState('')
  const [lokalizacja, setLokalizacja] = useState('')
  const [sending, setSending]       = useState(false)
  const [toast, setToast]           = useState('')

  useEffect(() => {
    api.get('/usterki/kategorie').then(r => setKategorie(r.data)).catch(() => setKategorie([]))
    // Pojazdy pobieramy z bazy firmy. Wcześniej lista była wpisana na sztywno
    // i pokazywała autokary zupełnie innej firmy.
    api.get('/usterki/pojazdy').then(r => setPojazdy(r.data || [])).catch(() => setPojazdy([]))
  }, [])

  function showToast(msg, color) {
    setToast({ msg, color })
    setTimeout(() => setToast(''), 3000)
  }

  async function wyslij() {
    if (!pojazd || !kategoria) {
      showToast('⚠️ Wybierz pojazd i kategorię', '#f97316')
      return
    }
    setSending(true)
    try {
      await api.post('/usterki', {
        pojazd_id:   parseInt(pojazd),
        kategoria_id: parseInt(kategoria),
        opis,
        lokalizacja
      })
      showToast('✅ Zgłoszenie wysłane!')
      setPojazd(''); setKategoria(''); setOpis(''); setLokalizacja('')
      setTimeout(() => goTo('historia'), 1500)
    } catch (e) {
      showToast('❌ Błąd wysyłki — spróbuj ponownie', '#ef4444')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="topbar">
        <button className="topbar-back" onClick={() => goTo('home')}>←</button>
        <h2>Zgłoś usterkę</h2>
        <span>🔧</span>
      </div>

      <div className="form-wrap">
        <div>
          <div className="form-label">Pojazd *</div>
          <select className="form-select" value={pojazd} onChange={e => setPojazd(e.target.value)}>
            <option value="">— wybierz pojazd —</option>
            {pojazdy.map(p => (
              <option key={p.id} value={p.id}>
                {/* Firmy turystyczne rozpoznają autokary po rejestracji, miejskie
                    po numerze bocznym — pokazujemy to, co firma wpisała. */}
                {[p.nr_boczny, p.nr_rejestracyjny].filter(Boolean).join(' · ')}
                {(p.marka || p.model) && ` · ${[p.marka, p.model].filter(Boolean).join(' ')}`}
              </option>
            ))}
          </select>
          {pojazdy.length === 0 && (
            <div className="form-label" style={{ marginTop: 6, color: 'var(--accent)' }}>
              Firma nie wgrała jeszcze pojazdów — zgłoś to dyspozytorowi.
            </div>
          )}
        </div>

        <div>
          <div className="form-label">Kategoria usterki *</div>
          <select className="form-select" value={kategoria} onChange={e => setKategoria(e.target.value)}>
            <option value="">— wybierz kategorię —</option>
            {kategorie.map(k => (
              <option key={k.id} value={k.id}>
                {k.ikona} {k.nazwa}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="form-label">Opis usterki (opcjonalnie)</div>
          <textarea
            className="form-textarea"
            placeholder="Opisz dokładniej problem..."
            value={opis}
            onChange={e => setOpis(e.target.value)}
          />
        </div>

        <div>
          <div className="form-label">Lokalizacja zdarzenia</div>
          <input
            className="form-input"
            placeholder="np. przystanek, trasa"
            value={lokalizacja}
            onChange={e => setLokalizacja(e.target.value)}
          />
        </div>

        <div className="photo-btn">📷 &nbsp;Dodaj zdjęcie (wkrótce)</div>

        <button className="btn-primary" onClick={wyslij} disabled={sending}>
          {sending ? 'Wysyłanie...' : '📤 Wyślij zgłoszenie'}
        </button>
      </div>

      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  )
}
