import { useState, useEffect } from 'react'
import api from '../api'

const BRANZE = {
  miejski:   'Miejska',
  turystyka: 'Turystyka',
  liniowe:   'Dalekobieżna',
}

export default function FirmyPanel({ onLogout }) {
  const [firmy, setFirmy]   = useState([])
  const [nowa, setNowa]     = useState(null)   // dane świeżo założonej firmy
  const [blad, setBlad]     = useState('')
  const [zajety, setZajety] = useState(false)
  const [pokazFormularz, setPokazFormularz] = useState(false)

  const [form, setForm] = useState({
    nazwa: '', kod: '', wersja: 'miejski', dni_trialu: 30,
    kontakt_osoba: '', kontakt_email: '', kontakt_telefon: '',
  })

  function wczytaj() {
    api.get('/firmy').then(r => setFirmy(r.data || [])).catch(() => setFirmy([]))
  }
  useEffect(wczytaj, [])

  async function zaloz() {
    if (!form.nazwa.trim()) { setBlad('Podaj nazwę firmy'); return }
    setZajety(true); setBlad('')
    try {
      const r = await api.post('/firmy', form)
      setNowa(r.data)
      setPokazFormularz(false)
      setForm({ nazwa: '', kod: '', wersja: 'miejski', dni_trialu: 30,
                kontakt_osoba: '', kontakt_email: '', kontakt_telefon: '' })
      wczytaj()
    } catch (e) {
      setBlad(e.response?.data?.error || 'Nie udało się założyć firmy')
    } finally {
      setZajety(false)
    }
  }

  async function przedluz(id, dni) {
    await api.patch(`/firmy/${id}`, { przedluz_o_dni: dni })
    wczytaj()
  }

  async function przelaczAktywna(f) {
    await api.patch(`/firmy/${f.id}`, { aktywna: !f.aktywna })
    wczytaj()
  }

  function statusFirmy(f) {
    if (!f.aktywna)     return { tekst: 'zablokowana', klasa: 'zla' }
    if (!f.trial_do)    return { tekst: 'bezterminowo', klasa: 'ok' }
    if (f.trial_wygasl) return { tekst: 'okres próbny minął', klasa: 'zla' }
    if (f.dni_do_konca <= 7) return { tekst: `kończy się za ${f.dni_do_konca} dni`, klasa: 'uwaga' }
    return { tekst: `${f.dni_do_konca} dni do końca`, klasa: 'ok' }
  }

  return (
    <div>
      <div className="topbar">
        <h2>Firmy na testach</h2>
        <button className="hero-logout" onClick={onLogout}>Wyloguj ↩</button>
      </div>

      <div className="form-wrap">
        {nowa && (
          <div className="import-podglad">
            <h3>Firma założona</h3>
            <p>Przekaż firmie te trzy rzeczy:</p>
            <table className="import-konta">
              <tbody>
                <tr><td>Adres aplikacji</td><td><strong>{nowa.adres}</strong></td></tr>
                <tr><td>Numer dyspozytora</td><td><strong>{nowa.konto_dyspozytora.nr_sluzbowy}</strong></td></tr>
                <tr><td>PIN</td><td className="import-pin">{nowa.konto_dyspozytora.pin}</td></tr>
              </tbody>
            </table>
            <p className="import-uwaga">
              PIN widzisz jeden raz — w bazie jest tylko jego skrót. Jeśli go zgubisz, trzeba nadać nowy.
            </p>
            <button className="btn-primary" onClick={() => setNowa(null)}>Rozumiem</button>
          </div>
        )}

        {!pokazFormularz && !nowa && (
          <button className="btn-primary" onClick={() => setPokazFormularz(true)}>
            ➕ Nowa firma na testy
          </button>
        )}

        {pokazFormularz && (
          <>
            <div>
              <div className="form-label">Nazwa firmy *</div>
              <input className="form-input" value={form.nazwa}
                     placeholder="np. PKS Gdynia"
                     onChange={e => setForm(f => ({ ...f, nazwa: e.target.value }))} />
            </div>

            <div>
              <div className="form-label">Adres aplikacji</div>
              <input className="form-input" value={form.kod}
                     placeholder={form.nazwa ? '(z nazwy)' : 'np. pks-gdynia'}
                     onChange={e => setForm(f => ({ ...f, kod: e.target.value }))} />
              <div className="form-label" style={{ marginTop: 6, opacity: 0.75 }}>
                {(form.kod || 'kod-firmy')}.appkierowca.pl — pod tym adresem logują się kierowcy
              </div>
            </div>

            <div>
              <div className="form-label">Branża *</div>
              <select className="form-select" value={form.wersja}
                      onChange={e => setForm(f => ({ ...f, wersja: e.target.value }))}>
                {Object.entries(BRANZE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div>
              <div className="form-label">Okres próbny (dni)</div>
              <input className="form-input" type="number" value={form.dni_trialu}
                     onChange={e => setForm(f => ({ ...f, dni_trialu: e.target.value }))} />
              <div className="form-label" style={{ marginTop: 6, opacity: 0.75 }}>
                0 = bez ograniczenia czasowego
              </div>
            </div>

            <div>
              <div className="form-label">Osoba kontaktowa</div>
              <input className="form-input" value={form.kontakt_osoba}
                     onChange={e => setForm(f => ({ ...f, kontakt_osoba: e.target.value }))} />
            </div>

            <div>
              <div className="form-label">Telefon</div>
              <input className="form-input" value={form.kontakt_telefon}
                     onChange={e => setForm(f => ({ ...f, kontakt_telefon: e.target.value }))} />
            </div>

            {blad && <div className="login-error">{blad}</div>}

            <button className="btn-primary" onClick={zaloz} disabled={zajety}>
              {zajety ? 'Zakładanie...' : 'Załóż firmę'}
            </button>
            <button className="btn-secondary" onClick={() => { setPokazFormularz(false); setBlad('') }}>
              Anuluj
            </button>
          </>
        )}

        <div className="firmy-lista">
          {firmy.length === 0 && <p>Nie ma jeszcze żadnej firmy.</p>}
          {firmy.map(f => {
            const st = statusFirmy(f)
            return (
              <div key={f.id} className="firma-karta">
                <div className="firma-naglowek">
                  <strong>{f.nazwa}</strong>
                  <span className={`firma-status ${st.klasa}`}>{st.tekst}</span>
                </div>
                <div className="firma-szczegoly">
                  {f.kod}.appkierowca.pl · {BRANZE[f.wersja]} · {f.kierowcow} kierowców
                  {f.kontakt_osoba && <> · {f.kontakt_osoba}</>}
                  {f.kontakt_telefon && <> · {f.kontakt_telefon}</>}
                </div>
                <div className="firma-akcje">
                  <button className="btn-maly" onClick={() => przedluz(f.id, 30)}>+30 dni</button>
                  <button className="btn-maly" onClick={() => przedluz(f.id, 90)}>+90 dni</button>
                  <button className="btn-maly" onClick={() => przelaczAktywna(f)}>
                    {f.aktywna ? 'Zablokuj' : 'Odblokuj'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
