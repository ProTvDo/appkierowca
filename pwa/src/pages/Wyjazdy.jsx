import { useState, useEffect } from 'react'
import api from '../api'
import Toast from '../components/Toast'

const DNI = ['nd','pn','wt','śr','czw','pt','sb']

function skroc(godz) {
  return godz ? godz.slice(0, 5) : '—'
}

function WyjazdCard({ w, czyDzis, onZmiana }) {
  const data = new Date(w.data)
  const [tankowania, setTankowania] = useState([])
  const [litry, setLitry] = useState('')
  const [koszt, setKoszt] = useState('')
  const [zaliczka, setZaliczka] = useState(w.zaliczka ?? '')
  const [toast, setToast] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!w.zakonczony) {
      api.get(`/wyjazdy/${w.id}/tankowania`).then(r => setTankowania(r.data || [])).catch(() => setTankowania([]))
    }
  }, [w.id, w.zakonczony])

  function pokazToast(msg, color) {
    setToast({ msg, color })
    setTimeout(() => setToast(''), 2500)
  }

  async function zapiszZaliczke() {
    try {
      await api.post(`/wyjazdy/${w.id}/zaliczka`, { zaliczka: zaliczka ? parseFloat(zaliczka) : null })
      pokazToast('✅ Zaliczka zapisana')
    } catch {
      pokazToast('❌ Błąd zapisu', '#ef4444')
    }
  }

  async function dodajTankowanie() {
    if (!litry || !koszt) {
      pokazToast('⚠️ Podaj litry i koszt', '#f97316')
      return
    }
    try {
      const r = await api.post(`/wyjazdy/${w.id}/tankowanie`, { litry: parseFloat(litry), koszt: parseFloat(koszt) })
      setTankowania(t => [...t, r.data])
      setLitry(''); setKoszt('')
      pokazToast('✅ Tankowanie dodane')
    } catch {
      pokazToast('❌ Błąd zapisu', '#ef4444')
    }
  }

  async function zakonczWyjazd() {
    if (!window.confirm('Zakończyć wyjazd i wysłać podsumowanie do biura?')) return
    setSending(true)
    try {
      await api.post(`/wyjazdy/${w.id}/zakoncz`)
      pokazToast('✅ Wyjazd zakończony, mail wysłany do biura')
      onZmiana()
    } catch {
      pokazToast('❌ Błąd — spróbuj ponownie', '#ef4444')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="info-card" style={czyDzis ? { borderColor: 'var(--accent)' } : {}}>
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

      {w.zakonczony ? (
        <div className="info-row">
          <span className="info-key">Status</span>
          <span className="info-value">✅ Wyjazd zakończony{w.zaliczka != null && ` · zaliczka ${w.zaliczka} zł`}</span>
        </div>
      ) : (
        <div style={{ padding: '12px 13px', borderTop: '1px solid var(--border)' }}>
          <div className="form-label">Pobrana zaliczka (zł)</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="form-input" type="number" value={zaliczka} onChange={e => setZaliczka(e.target.value)} placeholder="np. 500" />
            <button className="btn-blue" style={{ width: 'auto', padding: '0 16px' }} onClick={zapiszZaliczke}>Zapisz</button>
          </div>

          <div className="form-label">Tankowania</div>
          {tankowania.map(t => (
            <div key={t.id} className="usterka-meta" style={{ marginBottom: 4 }}>
              {t.litry} l · {t.koszt} zł
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 12 }}>
            <input className="form-input" type="number" value={litry} onChange={e => setLitry(e.target.value)} placeholder="Litry" />
            <input className="form-input" type="number" value={koszt} onChange={e => setKoszt(e.target.value)} placeholder="Koszt zł" />
            <button className="btn-blue" style={{ width: 'auto', padding: '0 16px' }} onClick={dodajTankowanie}>Dodaj</button>
          </div>

          <button className="btn-primary" onClick={zakonczWyjazd} disabled={sending}>
            {sending ? 'Wysyłanie...' : '🏁 Zakończ wyjazd'}
          </button>
        </div>
      )}

      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  )
}

export default function Wyjazdy({ goTo }) {
  const [wyjazdy, setWyjazdy] = useState([])
  const [loading, setLoading] = useState(true)

  function wczytaj() {
    api.get('/wyjazdy')
      .then(r => setWyjazdy(r.data || []))
      .catch(() => setWyjazdy([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { wczytaj() }, [])

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
        wyjazdy.map(w => (
          <WyjazdCard key={w.id} w={w} czyDzis={w.data === dzisiajStr} onZmiana={wczytaj} />
        ))
      )}
    </div>
  )
}
