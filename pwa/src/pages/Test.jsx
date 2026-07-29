import { useState, useEffect } from 'react'
import api from '../api'

export default function Test({ testId, goTo }) {
  const [pytania, setPytania] = useState([])
  const [tytul, setTytul]     = useState('')
  const [loading, setLoading] = useState(true)
  const [odpowiedzi, setOdpowiedzi] = useState({}) // pytanie_id -> odpowiedz_id
  const [wynik, setWynik]     = useState(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    // pytania testu wczytujemy przez materiał — najprościej: test jest zawsze
    // otwierany z poziomu SzkolenieDetal, gdzie mamy już material.test.
    // Tu pobieramy je ponownie przez listę materiałów, żeby ekran działał
    // także po odświeżeniu.
    api.get('/szkolenia')
      .then(async r => {
        const powiazany = (r.data || []).find(m => m.test_id === testId)
        if (!powiazany) return setLoading(false)
        const detal = await api.get(`/szkolenia/${powiazany.id}`)
        setTytul(detal.data.test?.tytul || '')
        setPytania(detal.data.test?.pytania_testowe || [])
      })
      .finally(() => setLoading(false))
  }, [testId])

  function wybierz(pytanieId, odpowiedzId) {
    setOdpowiedzi(prev => ({ ...prev, [pytanieId]: odpowiedzId }))
  }

  async function wyslij() {
    setSending(true)
    try {
      const payload = {
        odpowiedzi: Object.entries(odpowiedzi).map(([pytanie_id, odpowiedz_id]) => ({ pytanie_id, odpowiedz_id })),
      }
      const r = await api.post(`/szkolenia/testy/${testId}/wyslij`, payload)
      setWynik(r.data)
    } catch {
      setWynik({ error: true })
    } finally {
      setSending(false)
    }
  }

  const wszystkieOdpowiedziane = pytania.length > 0 && pytania.every(p => odpowiedzi[p.id])

  return (
    <div>
      <div className="topbar">
        <button className="topbar-back" onClick={() => goTo('szkolenia')}>←</button>
        <h2>{tytul || 'Test'}</h2>
        <span>📝</span>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : wynik ? (
        wynik.error ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
            Błąd wysyłania testu — spróbuj ponownie
          </div>
        ) : (
          <div className="quiz-result">
            <div className="score">{wynik.wynik_procent}%</div>
            <div className={`verdict ${wynik.zdany ? 'ok' : 'fail'}`}>
              {wynik.zdany ? '✅ Test zdany' : '❌ Test niezdany'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
              {wynik.poprawne} / {wynik.wszystkie} poprawnych odpowiedzi
            </div>
            <div className="form-wrap">
              <button className="btn-primary" onClick={() => goTo('szkolenia')}>Wróć do szkoleń</button>
            </div>
          </div>
        )
      ) : (
        <>
          {pytania.map((p, i) => (
            <div className="quiz-question" key={p.id}>
              <h3>{i + 1}. {p.tresc}</h3>
              {p.odpowiedzi_testowe.map(o => (
                <div
                  key={o.id}
                  className={`quiz-option ${odpowiedzi[p.id] === o.id ? 'selected' : ''}`}
                  onClick={() => wybierz(p.id, o.id)}
                >
                  {o.tresc}
                </div>
              ))}
            </div>
          ))}

          <div className="form-wrap">
            <button className="btn-primary" onClick={wyslij} disabled={!wszystkieOdpowiedziane || sending}>
              {sending ? 'Wysyłanie...' : 'Zakończ test'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
