import { useState, useEffect } from 'react'
import api from '../api'

// Rozkłady jazdy nie mają jeszcze ekranu ani tabel w bazie — kafelek prowadził
// w pustkę (App.jsx nie zna strony 'rozklady'). Ukryty do czasu zbudowania
// ekranu; wzór układu jest w demo/index.html (sekcja ROZKŁADY).
// Żeby przywrócić kafelek, ustaw na true i dodaj gałąź strona === 'rozklady'.
const ROZKLADY_GOTOWE = false

export default function Home({ kierowca, token, onLogout, goTo }) {
  const czyTurystyka = kierowca.wersja === 'turystyka'
  const [dzisiaj, setDzisiaj] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const endpoint = czyTurystyka ? '/wyjazdy/najblizszy' : '/grafik/dzisiaj'
    api.get(endpoint)
      .then(r => setDzisiaj(r.data))
      .catch(() => setDzisiaj(null))
      .finally(() => setLoading(false))
  }, [czyTurystyka])

  // wersja miejska
  const linia  = dzisiaj ? `${dzisiaj.linia}/${dzisiaj.brygada}` : '—'
  const pojazd = dzisiaj?.pojazdy?.nr_boczny || '—'
  const zmiana = dzisiaj
    ? `Zmiana ${dzisiaj.zmiana} · ${dzisiaj.godz_start?.slice(0,5)}–${dzisiaj.godz_koniec?.slice(0,5)}`
    : 'Brak zmiany / wolne'

  // wersja turystyka
  const celPodrozy = dzisiaj?.cel_podrozy || '—'
  const nrRejestracyjny = dzisiaj?.nr_rejestracyjny || '—'
  const wyjazd = dzisiaj
    ? `Wyjazd ${dzisiaj.godz_wyjazdu?.slice(0,5) || '—'} · podstawienie ${dzisiaj.godz_podstawienia?.slice(0,5) || '—'}`
    : 'Brak zaplanowanego wyjazdu'

  return (
    <div>
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greeting">Dzień dobry,</div>
            <div className="hero-name">{kierowca.imie} {kierowca.nazwisko}</div>
            {kierowca.firma && <div className="hero-firma">{kierowca.firma}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <button className="hero-logout" onClick={onLogout}>Wyloguj ↩</button>
            <button className="hero-logout" onClick={() => goTo('pin')}>Zmień PIN 🔒</button>
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-stat">
            <div className="hero-stat-label">Nr służbowy</div>
            <div className="hero-stat-value">{kierowca.nr_sluzbowy}</div>
            <div className="hero-stat-sub">identyfikator</div>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <div className="hero-stat-label">{czyTurystyka ? 'Cel podróży' : 'Linia / Brygada'}</div>
            <div className="hero-stat-value">{loading ? '...' : (czyTurystyka ? celPodrozy : linia)}</div>
            <div className="hero-stat-sub">{czyTurystyka ? 'najbliższy wyjazd' : 'dziś'}</div>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <div className="hero-stat-label">{czyTurystyka ? 'Nr rejestracyjny' : 'Nr boczny'}</div>
            <div className="hero-stat-value">{loading ? '...' : (czyTurystyka ? nrRejestracyjny : pojazd)}</div>
            <div className="hero-stat-sub">pojazd</div>
          </div>
        </div>

        <div className="hero-shift-row">
          <div className="shift-pill">{loading ? '...' : (czyTurystyka ? wyjazd : zmiana)}</div>
        </div>
      </div>

      <div className="grid">
        <div className="tile" onClick={() => goTo('grafik')}>
          <div className="tile-icon">{czyTurystyka ? '🧳' : '📅'}</div>
          <div className="tile-label">{czyTurystyka ? 'Moje wyjazdy' : 'Grafik pracy'}</div>
          <div className="tile-sub">{czyTurystyka ? 'Wyjazdy z grupą' : 'Twój harmonogram'}</div>
        </div>
        {!czyTurystyka && ROZKLADY_GOTOWE && (
          <div className="tile" onClick={() => goTo('rozklady')}>
            <div className="tile-icon">🗺️</div>
            <div className="tile-label">Rozkłady jazdy</div>
            <div className="tile-sub">Linie i przystanki</div>
          </div>
        )}
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
        <div className="tile" onClick={() => goTo('szkolenia')}>
          <div className="tile-icon">🎓</div>
          <div className="tile-label">Szkolenia</div>
          <div className="tile-sub">Baza wiedzy i testy</div>
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
