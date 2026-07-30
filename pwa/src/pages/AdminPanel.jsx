import { useState, useEffect } from 'react'
import api from '../api'
import Toast from '../components/Toast'
import ImportDanych from './ImportDanych'

export default function AdminPanel({ kierowca, onLogout }) {
  const [zakladka, setZakladka]  = useState('wyjazd')
  const [kierowcy, setKierowcy] = useState([])
  const [pojazdy, setPojazdy]   = useState([])
  const [sending, setSending]   = useState(false)
  const [toast, setToast]       = useState('')

  const PUSTY_FORM = {
    kierowca_id: '', pojazd_id: '', data: '', cel_podrozy: '',
    godz_podstawienia: '', godz_wyjazdu: '', godz_dojazdu: '',
    kilometry: '', pilot_imie_nazwisko: '', pilot_telefon: '', dodatkowe_info: '',
    wielkosc_grupy: '', punkty_postojowe: '', nocleg: '', wyzywienie: '',
    oplaty_drogowe: '', winiety_oplacone: '', ograniczenia_trasy: '',
  }
  const [form, setForm] = useState(PUSTY_FORM)

  useEffect(() => {
    api.get('/admin/kierowcy').then(r => setKierowcy(r.data || [])).catch(() => setKierowcy([]))
    api.get('/admin/pojazdy').then(r => setPojazdy(r.data || [])).catch(() => setPojazdy([]))
  }, [])

  function ustaw(pole, wartosc) {
    setForm(f => ({ ...f, [pole]: wartosc }))
  }

  function showToast(msg, color) {
    setToast({ msg, color })
    setTimeout(() => setToast(''), 3000)
  }

  const wybranyPojazd = pojazdy.find(p => String(p.id) === String(form.pojazd_id))

  async function wyslij() {
    if (!form.kierowca_id || !form.pojazd_id || !form.data || !form.cel_podrozy) {
      showToast('⚠️ Wybierz kierowcę, pojazd, datę i cel podróży', '#f97316')
      return
    }
    setSending(true)
    try {
      await api.post('/admin/wyjazdy', {
        ...form,
        kilometry:      form.kilometry ? parseInt(form.kilometry) : null,
        wielkosc_grupy: form.wielkosc_grupy ? parseInt(form.wielkosc_grupy) : null,
        // '' oznacza "nie ustalono" i musi dojść jako null, nie jako false —
        // inaczej kierowca zobaczy "winiety nieopłacone" tam, gdzie dyspozytor
        // po prostu jeszcze nie wie.
        winiety_oplacone: form.winiety_oplacone === '' ? null : form.winiety_oplacone === 'tak',
      })
      showToast('✅ Wyjazd przypisany!')
      setForm(PUSTY_FORM)
    } catch (e) {
      showToast('❌ Błąd — spróbuj ponownie', '#ef4444')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="topbar">
        <h2>Panel dyspozytora</h2>
        <button className="hero-logout" onClick={onLogout}>Wyloguj ↩</button>
      </div>

      <div className="zakladki">
        <button className={zakladka === 'wyjazd' ? 'zakladka aktywna' : 'zakladka'}
                onClick={() => setZakladka('wyjazd')}>Przypisz wyjazd</button>
        <button className={zakladka === 'import' ? 'zakladka aktywna' : 'zakladka'}
                onClick={() => setZakladka('import')}>Wgraj dane</button>
      </div>

      {zakladka === 'import' && <ImportDanych />}

      <div className="form-wrap" style={{ display: zakladka === 'wyjazd' ? undefined : 'none' }}>
        <div>
          <div className="form-label">Kierowca *</div>
          <select className="form-select" value={form.kierowca_id} onChange={e => ustaw('kierowca_id', e.target.value)}>
            <option value="">— wybierz kierowcę —</option>
            {kierowcy.map(k => (
              <option key={k.id} value={k.id}>{k.imie} {k.nazwisko} ({k.nr_sluzbowy})</option>
            ))}
          </select>
        </div>

        <div>
          <div className="form-label">Pojazd *</div>
          <select className="form-select" value={form.pojazd_id} onChange={e => ustaw('pojazd_id', e.target.value)}>
            <option value="">— wybierz pojazd —</option>
            {pojazdy.map(p => (
              <option key={p.id} value={p.id}>
                {p.nr_rejestracyjny || p.nr_boczny} · {p.marka} {p.model}
              </option>
            ))}
          </select>
          {wybranyPojazd && (
            <div className="form-label" style={{ marginTop: 6 }}>
              Nr rejestracyjny: {wybranyPojazd.nr_rejestracyjny || '—'}
            </div>
          )}
        </div>

        <div>
          <div className="form-label">Data *</div>
          <input className="form-input" type="date" value={form.data} onChange={e => ustaw('data', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Cel podróży *</div>
          <input className="form-input" placeholder="np. Malbork — wycieczka szkolna" value={form.cel_podrozy} onChange={e => ustaw('cel_podrozy', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Godzina podstawienia</div>
          <input className="form-input" type="time" value={form.godz_podstawienia} onChange={e => ustaw('godz_podstawienia', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Godzina wyjazdu</div>
          <input className="form-input" type="time" value={form.godz_wyjazdu} onChange={e => ustaw('godz_wyjazdu', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Godzina dojazdu na miejsce</div>
          <input className="form-input" type="time" value={form.godz_dojazdu} onChange={e => ustaw('godz_dojazdu', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Kilometry</div>
          <input className="form-input" type="number" placeholder="np. 180" value={form.kilometry} onChange={e => ustaw('kilometry', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Pilot grupy — imię i nazwisko</div>
          <input className="form-input" value={form.pilot_imie_nazwisko} onChange={e => ustaw('pilot_imie_nazwisko', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Pilot grupy — telefon</div>
          <input className="form-input" value={form.pilot_telefon} onChange={e => ustaw('pilot_telefon', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Wielkość grupy (osób)</div>
          <input className="form-input" type="number" placeholder="np. 45" value={form.wielkosc_grupy} onChange={e => ustaw('wielkosc_grupy', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Planowane punkty postojowe</div>
          <textarea className="form-textarea" placeholder="np. Gniew — postój 20 min, Malbork — parking przy zamku"
                    value={form.punkty_postojowe} onChange={e => ustaw('punkty_postojowe', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Nocleg kierowcy</div>
          <input className="form-input" placeholder="np. Hotel Zamkowy, opłacony przez biuro"
                 value={form.nocleg} onChange={e => ustaw('nocleg', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Wyżywienie kierowcy</div>
          <input className="form-input" placeholder="np. obiad z grupą, śniadanie w hotelu"
                 value={form.wyzywienie} onChange={e => ustaw('wyzywienie', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Opłaty drogowe — kto płaci</div>
          <input className="form-input" placeholder="np. karta flotowa w pojeździe"
                 value={form.oplaty_drogowe} onChange={e => ustaw('oplaty_drogowe', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Winiety opłacone przez biuro</div>
          <select className="form-select" value={form.winiety_oplacone} onChange={e => ustaw('winiety_oplacone', e.target.value)}>
            <option value="">— nie ustalono —</option>
            <option value="tak">Tak</option>
            <option value="nie">Nie — kierowca opłaca</option>
          </select>
        </div>

        <div>
          <div className="form-label">Ograniczenia na trasie</div>
          <textarea className="form-textarea" placeholder="np. most w Tczewie do 12 t, wjazd do centrum tylko do 3,5 m wysokości"
                    value={form.ograniczenia_trasy} onChange={e => ustaw('ograniczenia_trasy', e.target.value)} />
        </div>

        <div>
          <div className="form-label">Dodatkowe informacje</div>
          <textarea className="form-textarea" value={form.dodatkowe_info} onChange={e => ustaw('dodatkowe_info', e.target.value)} />
        </div>

        <button className="btn-primary" onClick={wyslij} disabled={sending}>
          {sending ? 'Zapisywanie...' : '📤 Przypisz wyjazd'}
        </button>
      </div>

      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  )
}
