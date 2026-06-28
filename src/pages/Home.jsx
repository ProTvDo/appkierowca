import { useState, useEffect } from 'react'
import api from '../api'

export default function Home({ kierowca, token, onLogout, goTo }) {
  const [dzisiaj, setDzisiaj] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/grafik/dzisiaj')
      .then(r => setDzisiaj(r.data))
      .catch(() => setDzisiaj(null))
      .finally(() => setLoading(false))
  }, [])

  const linia  = dzisiaj ? `${dzisiaj.linia}/${dzisiaj.brygada}` : '—'
  const pojazd = dzisiaj?.pojazdy?.nr_boczny || '—'
  const zmiana = dzisiaj
    ? `Zmiana ${dzisiaj.zmiana} · ${dzisiaj.godz_start?.slice(0,5)}–${dzisiaj.godz_koniec?.slice(0,5)}`
    : 'Brak zmiany / wolne'

  return (
    <div>
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greeting">Dzień dobry,</div>
            <div className="hero-name">{kierowca.imie} {kierowca.nazwisko}</div>
          </div>
          <button className="hero-logout" onClick={onLogout}>Wyloguj ↩</button>
        </div>

        <div className="hero-card">
          <div className="hero-stat">
            <div className="hero-stat-label">Nr służbowy</div>
            <div className="hero-stat-value">{kierowca.nr_sluzbowy}</div>
            <div className="hero-stat-sub">identyfikator</div>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <div className="hero-stat-label">Linia / Brygada</div>
            <div className="hero-stat-value">{loading ? '...' : linia}</div>
            <div className="hero-stat-sub">dziś</div>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <div className="hero-stat-label">Nr boczny</div>
            <div className="hero-stat-value">{loading ? '...' : pojazd}</div>
            <div className="hero-stat-sub">pojazd</div>
          </div>
        </div>

        <div className="hero-shift-row">
          <div className="shift-pill">{loading ? '...' : zmiana}</div>
        </div>
      </div>

      <div className="grid">
        <div className="tile" onClick={() => goTo('grafik')}>
          <div className="tile-icon">📅</div>
          <div className="tile-label">Grafik pracy</div>
          <div className="tile-sub">Twój harmonogram</div>
        </div>
        <div className="tile" onClick={() => goTo('rozklady')}>
          <div className="tile-icon">🗺️</div>
          <div className="tile-label">Rozkłady jazdy</div>
          <div className="tile-sub">Linie i przystanki</div>
        </div>
        <div className="tile" onClick={() => goTo('usterki')}>
          <div className="tile-icon">🔧</div>
          <div className="tile-label">Zgłoś usterkę</div>
          <div className="tile-sub">Formularz</div>
        </div>
        <div className="tile" onClick={() => goTo('telefony')}>
          <div className="tile-icon">📞</div>
          <div className="tile-label">Telefony</div>
          <div className="tile-sub">Kontakty</div>
        </div>
        <div className="tile wide" onClick={() => goTo('historia')}>
          <div className="tile-icon">📋</div>
          <div>
            <div className="tile-label">Historia zgłoszeń</div>
            <div className="tile-sub">Moje usterki</div>
          </div>
        </div>
      </div>
    </div>
  )
}
