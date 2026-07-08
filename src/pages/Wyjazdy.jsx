import { useState, useEffect } from 'react'
import api from '../api'

const DNI = ['nd','pn','wt','śr','czw','pt','sb']

function skroc(godz) {
  return godz ? godz.slice(0, 5) : '—'
}

export default function Wyjazdy({ goTo }) {
  const [wyjazdy, setWyjazdy] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/wyjazdy')
      .then(r => setWyjazdy(r.data || []))
      .catch(() => setWyjazdy([]))
      .finally(() => setLoading(false))
  }, [])

  const dzisiajStr = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div className="topbar">
        <button className="topbar-back" onClick={() => goTo('home')}>←</button>
        <h2>Moje wyjazdy</h2>
        <span>🧳</span>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : wyjazdy.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
          Brak zaplanowanych wyjazdów
        </div>
      ) : (
        wyjazdy.map(w => {
          const data = new Date(w.data)
          const czyDzis = w.data === dzisiajStr

          return (
            <div key={w.id} className="info-card" style={czyDzis ? { borderColor: 'var(--accent)' } : {}}>
              <div className="info-row">
                <span className="info-key">Data</span>
                <span className="info-value">{data.getDate()} {DNI[data.getDay()]} {czyDzis && '· dziś'}</span>
              </div>
              <div className="info-row">
                <span className="info-key">Cel podróży</span>
                <span className="info-value">{w.cel_podrozy}</span>
              </div>
              <div className="info-row">
                <span className="info-key">Podstawienie / wyjazd</span>
                <span className="info-value">{skroc(w.godz_podstawienia)} / {skroc(w.godz_wyjazdu)}</span>
              </div>
              <div className="info-row">
                <span className="info-key">Dojazd na miejsce</span>
                <span className="info-value">{skroc(w.godz_dojazdu)}</span>
              </div>
              {w.kilometry && (
                <div className="info-row">
                  <span className="info-key">Kilometry</span>
                  <span className="info-value">{w.kilometry} km</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-key">Pojazd</span>
                <span className="info-value">
                  {w.nr_rejestracyjny} {w.marka_model && `· ${w.marka_model}`} {w.nr_boczny && `(nr ${w.nr_boczny})`}
                </span>
              </div>
              {w.pilot_imie_nazwisko && (
                <div className="info-row">
                  <span className="info-key">Pilot grupy</span>
                  <span className="info-value">
                    {w.pilot_imie_nazwisko}
                    {w.pilot_telefon && <> · <a href={`tel:${w.pilot_telefon}`} style={{ color: 'var(--blue)' }}>{w.pilot_telefon}</a></>}
                  </span>
                </div>
              )}
              {w.dodatkowe_info && (
                <div className="info-row">
                  <span className="info-key">Dodatkowe info</span>
                  <span className="info-value">{w.dodatkowe_info}</span>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
