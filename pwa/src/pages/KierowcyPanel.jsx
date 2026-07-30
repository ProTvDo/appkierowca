import { useState, useEffect } from 'react'
import api from '../api'

// Dyspozytor musi móc sam nadać nowy PIN, gdy kierowca swój zgubi — inaczej
// każdy taki przypadek kończy się telefonem do ProTvDo.
export default function KierowcyPanel() {
  const [kierowcy, setKierowcy] = useState([])
  const [nowyPin, setNowyPin]   = useState(null)   // { imie, nazwisko, nr_sluzbowy, pin }
  const [potwierdzam, setPotwierdzam] = useState(null)
  const [blad, setBlad]         = useState('')
  const [ladowanie, setLadowanie] = useState(true)

  function wczytaj() {
    api.get('/admin/kierowcy/lista')
      .then(r => setKierowcy(r.data || []))
      .catch(() => setBlad('Nie udało się wczytać listy kierowców'))
      .finally(() => setLadowanie(false))
  }
  useEffect(wczytaj, [])

  async function nadajPin(k) {
    setBlad('')
    try {
      const r = await api.post(`/admin/kierowcy/${k.id}/reset-pin`)
      setNowyPin(r.data)
      setPotwierdzam(null)
    } catch (e) {
      setBlad(e.response?.data?.error || 'Nie udało się nadać nowego PIN-u')
    }
  }

  if (ladowanie) return <div className="spinner-wrap"><div className="spinner" /></div>

  return (
    <div className="form-wrap">
      {nowyPin && (
        <div className="import-podglad">
          <h3>Nowy PIN nadany</h3>
          <table className="import-konta">
            <tbody>
              <tr>
                <td>{nowyPin.imie} {nowyPin.nazwisko}</td>
                <td>nr {nowyPin.nr_sluzbowy}</td>
                <td className="import-pin">{nowyPin.pin}</td>
              </tr>
            </tbody>
          </table>
          <p className="import-uwaga">
            Przekaż ten PIN kierowcy. Widzisz go jeden raz — w bazie zostaje tylko jego skrót,
            więc później można wyłącznie nadać kolejny. Stary PIN już nie działa.
          </p>
          <button className="btn-primary" onClick={() => setNowyPin(null)}>Rozumiem</button>
        </div>
      )}

      {blad && <div className="login-error">{blad}</div>}

      {kierowcy.length === 0 && (
        <p>Nie ma jeszcze żadnych kierowców. Wgraj ich w zakładce „Wgraj dane".</p>
      )}

      <div className="firmy-lista">
        {kierowcy.map(k => (
          <div key={k.id} className="firma-karta">
            <div className="firma-naglowek">
              <strong>{k.imie} {k.nazwisko}</strong>
              {k.rola === 'admin'
                ? <span className="firma-status ok">dyspozytor</span>
                : !k.aktywny && <span className="firma-status zla">nieaktywny</span>}
            </div>
            <div className="firma-szczegoly">
              nr służbowy {k.nr_sluzbowy}
            </div>

            {potwierdzam === k.id ? (
              <div>
                <div className="import-uwaga" style={{ marginBottom: 8 }}>
                  Nadać nowy PIN dla {k.imie} {k.nazwisko}? Dotychczasowy przestanie działać.
                </div>
                <div className="firma-akcje">
                  <button className="btn-maly z-uwagami" onClick={() => nadajPin(k)}>Tak, nadaj nowy</button>
                  <button className="btn-maly" onClick={() => setPotwierdzam(null)}>Anuluj</button>
                </div>
              </div>
            ) : (
              <div className="firma-akcje">
                <button className="btn-maly" onClick={() => setPotwierdzam(k.id)}>Nadaj nowy PIN</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
