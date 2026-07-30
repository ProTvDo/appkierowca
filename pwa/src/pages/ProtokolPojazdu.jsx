import { useState, useEffect } from 'react'
import api from '../api'
import Toast from '../components/Toast'

const PUNKTY = [
  ['swiatla',          'Światła'],
  ['opony',            'Opony'],
  ['plyny',            'Płyny (olej, chłodnicza, spryskiwacze)'],
  ['hamulce',          'Hamulce'],
  ['gasnica',          'Gaśnica'],
  ['apteczka',         'Apteczka'],
  ['czystosc_wnetrza', 'Czystość wnętrza'],
  ['klimatyzacja',     'Klimatyzacja'],
]

const PALIWO = ['pełny', '3/4', '1/2', '1/4', 'rezerwa']

export default function ProtokolPojazdu({ wyjazd, rodzaj, goBack }) {
  const [stan, setStan]     = useState({})
  const [paliwo, setPaliwo] = useState('')
  const [licznik, setLicznik] = useState('')
  const [uszkodzenia, setUszkodzenia] = useState('')
  const [uwagi, setUwagi]   = useState('')
  const [istniejacy, setIstniejacy] = useState(null)
  const [zajety, setZajety] = useState(false)
  const [toast, setToast]   = useState('')

  const tytul = rodzaj === 'odbior' ? 'Odbiór pojazdu' : 'Zdanie pojazdu'

  useEffect(() => {
    api.get(`/protokoly/wyjazd/${wyjazd.id}`)
      .then(r => {
        const p = (r.data || []).find(x => x.rodzaj === rodzaj)
        if (!p) return
        setIstniejacy(p)
        const s = {}
        PUNKTY.forEach(([k]) => { if (p[k] !== null) s[k] = p[k] })
        setStan(s)
        setPaliwo(p.stan_paliwa || '')
        setLicznik(p.licznik_km ?? '')
        setUszkodzenia(p.uszkodzenia || '')
        setUwagi(p.uwagi || '')
      })
      .catch(() => {})
  }, [wyjazd.id, rodzaj])

  function pokazToast(msg, color) {
    setToast({ msg, color })
    setTimeout(() => setToast(''), 3000)
  }

  function ustawPunkt(klucz, wartosc) {
    setStan(s => ({ ...s, [klucz]: wartosc }))
  }

  const niesprawdzone = PUNKTY.filter(([k]) => stan[k] === undefined)
  const usterki = PUNKTY.filter(([k]) => stan[k] === false)

  async function zapisz() {
    if (niesprawdzone.length > 0) {
      pokazToast(`⚠️ Zostało ${niesprawdzone.length} niesprawdzonych punktów`, '#f97316')
      return
    }
    setZajety(true)
    try {
      const r = await api.post('/protokoly', {
        wyjazd_id: wyjazd.id, rodzaj,
        ...stan,
        stan_paliwa: paliwo || null,
        licznik_km: licznik === '' ? null : licznik,
        uszkodzenia, uwagi,
      })
      if (r.data.protokol.wszystko_ok) {
        pokazToast('✅ Protokół zapisany — bez uwag')
      } else if (r.data.email_wyslany) {
        pokazToast('✅ Zapisano, biuro powiadomione o uwagach')
      } else {
        pokazToast('✅ Zapisano — zgłoś uwagi biuru, mail nie wyszedł', '#f97316')
      }
      setTimeout(goBack, 1200)
    } catch (e) {
      pokazToast(e.response?.data?.error || '❌ Błąd zapisu', '#ef4444')
    } finally {
      setZajety(false)
    }
  }

  return (
    <div>
      <div className="topbar">
        <button className="topbar-back" onClick={goBack}>←</button>
        <h2>{tytul}</h2>
        <span>{rodzaj === 'odbior' ? '🔑' : '🏁'}</span>
      </div>

      <div className="form-wrap">
        <div className="info-card">
          <div className="info-row">
            <span className="info-key">Wyjazd</span>
            <span className="info-value">{wyjazd.cel_podrozy}</span>
          </div>
          <div className="info-row">
            <span className="info-key">Pojazd</span>
            <span className="info-value">{wyjazd.nr_rejestracyjny || '—'} {wyjazd.marka_model}</span>
          </div>
        </div>

        {istniejacy && (
          <div className="import-uwaga">
            Ten protokół był już wypełniony {new Date(istniejacy.created_at).toLocaleString('pl-PL')}.
            Zapisanie ponownie nadpisze poprzednią wersję.
          </div>
        )}

        <div className="form-label">Stan techniczny — odhacz każdy punkt</div>
        <div className="protokol-lista">
          {PUNKTY.map(([klucz, etykieta]) => (
            <div key={klucz} className="protokol-punkt">
              <span className="protokol-nazwa">{etykieta}</span>
              <div className="protokol-wybor">
                <button
                  className={`protokol-btn ${stan[klucz] === true ? 'ok' : ''}`}
                  onClick={() => ustawPunkt(klucz, true)}
                >OK</button>
                <button
                  className={`protokol-btn ${stan[klucz] === false ? 'zle' : ''}`}
                  onClick={() => ustawPunkt(klucz, false)}
                >Usterka</button>
              </div>
            </div>
          ))}
        </div>

        {niesprawdzone.length > 0 && (
          <div className="import-uwaga">
            Niesprawdzone: {niesprawdzone.map(([, e]) => e).join(', ')}
          </div>
        )}

        <div>
          <div className="form-label">Stan paliwa</div>
          <select className="form-select" value={paliwo} onChange={e => setPaliwo(e.target.value)}>
            <option value="">— wybierz —</option>
            {PALIWO.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <div className="form-label">Stan licznika (km)</div>
          <input className="form-input" type="number" inputMode="numeric" placeholder="np. 348120"
                 value={licznik} onChange={e => setLicznik(e.target.value)} />
        </div>

        <div>
          <div className="form-label">
            Uszkodzenia {usterki.length > 0 && <span style={{ color: 'var(--accent)' }}>— opisz zgłoszone usterki</span>}
          </div>
          <textarea className="form-textarea" placeholder="np. rysa na prawym boku za drzwiami, pęknięte lusterko"
                    value={uszkodzenia} onChange={e => setUszkodzenia(e.target.value)} />
        </div>

        <div>
          <div className="form-label">Uwagi</div>
          <textarea className="form-textarea" value={uwagi} onChange={e => setUwagi(e.target.value)} />
        </div>

        <button className="btn-primary" onClick={zapisz} disabled={zajety}>
          {zajety ? 'Zapisywanie...' : `Zapisz protokół ${rodzaj === 'odbior' ? 'odbioru' : 'zdania'}`}
        </button>
      </div>

      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  )
}
