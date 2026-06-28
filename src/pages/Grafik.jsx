import { useState, useEffect } from 'react'
import api from '../api'

const DNI = ['nd','pn','wt','śr','czw','pt','sb']
const MIESIACE = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
                  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']

function pillZmiana(zmiana) {
  if (!zmiana) return null
  const map = { I: ['rano','RANO'], II: ['popo','PO POŁ.'], III: ['noc','NOC'] }
  const [cls, label] = map[zmiana] || ['rano', zmiana]
  return <span className={`pill ${cls}`}>{label}</span>
}

export default function Grafik({ token, goTo }) {
  const teraz = new Date()
  const [rok, setRok]       = useState(teraz.getFullYear())
  const [miesiac, setMiesiac] = useState(teraz.getMonth() + 1)
  const [dni, setDni]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/grafik?rok=${rok}&miesiac=${miesiac}`)
      .then(r => setDni(r.data || []))
      .catch(() => setDni([]))
      .finally(() => setLoading(false))
  }, [rok, miesiac])

  function prevMiesiac() {
    if (miesiac === 1) { setMiesiac(12); setRok(r => r - 1) }
    else setMiesiac(m => m - 1)
  }
  function nextMiesiac() {
    if (miesiac === 12) { setMiesiac(1); setRok(r => r + 1) }
    else setMiesiac(m => m + 1)
  }

  const dzisiajStr = teraz.toISOString().split('T')[0]

  return (
    <div>
      <div className="topbar">
        <button className="topbar-back" onClick={() => goTo('home')}>←</button>
        <h2>Grafik pracy</h2>
        <span>📅</span>
      </div>

      <div className="month-nav">
        <button onClick={prevMiesiac}>‹</button>
        <span>{MIESIACE[miesiac - 1]} {rok}</span>
        <button onClick={nextMiesiac}>›</button>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : dni.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
          Brak grafiku na ten miesiąc
        </div>
      ) : (
        dni.map(d => {
          const data = new Date(d.data)
          const czyDzis = d.data === dzisiajStr
          const godziny = d.wolne ? '—'
            : `${d.godz_start?.slice(0,5)}–${d.godz_koniec?.slice(0,5)}`

          return (
            <div key={d.id} className={`day-row ${czyDzis ? 'today' : ''}`}>
              <div className="day-date">
                <div className="dd">{data.getDate()}</div>
                <div className="dw">{DNI[data.getDay()]}</div>
              </div>
              <div className="day-info">
                <div className="day-shift">
                  {d.wolne ? 'Wolne' : `Zmiana ${d.zmiana}`}
                  {d.wolne ? <span className="pill wolne">WOLNE</span> : pillZmiana(d.zmiana)}
                </div>
                {!d.wolne && (
                  <div className="day-line">
                    Linia {d.linia}, Bryg. {d.brygada} · Poj. {d.pojazdy?.nr_boczny || '—'}
                  </div>
                )}
              </div>
              <div className="day-hours" style={d.wolne ? { color: 'var(--muted)' } : {}}>
                {godziny}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
