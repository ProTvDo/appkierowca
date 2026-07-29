import { useState } from 'react'
import api from '../api'

// Excel w polskiej wersji zapisuje "CSV" domyślnie w Windows-1250, nie w UTF-8.
// Odczytane jako UTF-8 rozsypują się wszystkie ogonki, a firma dostaje w
// aplikacji "Kowalski Bogus�aw". Próbujemy więc UTF-8 rygorystycznie i przy
// pierwszym niepoprawnym bajcie wracamy do 1250.
async function odczytajPlik(plik) {
  const bufor = await plik.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bufor)
  } catch {
    return new TextDecoder('windows-1250').decode(bufor)
  }
}

const RODZAJE = {
  kierowcy: {
    tytul: 'Lista kierowców',
    opis: 'Imię, nazwisko, numer służbowy i segment. Numer możesz zostawić pusty — nadamy kolejny wolny.',
    plik: '1_dane_firmy_i_kierowcy.csv',
  },
  grafik: {
    tytul: 'Grafik miesięczny',
    opis: 'Dni pracy i wolne dla każdego kierowcy. Najpierw wgraj listę kierowców.',
    plik: '2_grafik_miejski.csv',
  },
}

export default function ImportDanych() {
  const [rodzaj, setRodzaj]   = useState('kierowcy')
  const [csv, setCsv]         = useState('')
  const [nazwaPliku, setNazwaPliku] = useState('')
  const [podglad, setPodglad] = useState(null)
  const [wynik, setWynik]     = useState(null)
  const [blad, setBlad]       = useState('')
  const [zajety, setZajety]   = useState(false)

  async function wybierzPlik(e) {
    const plik = e.target.files?.[0]
    if (!plik) return
    setBlad(''); setPodglad(null); setWynik(null)
    setNazwaPliku(plik.name)
    setCsv(await odczytajPlik(plik))
  }

  async function sprawdz() {
    setZajety(true); setBlad(''); setWynik(null)
    try {
      const r = await api.post(`/import/${rodzaj}`, { csv, podglad: true })
      setPodglad(r.data)
    } catch (e) {
      setBlad(e.response?.data?.error || 'Nie udało się odczytać pliku')
    } finally {
      setZajety(false)
    }
  }

  async function zapisz() {
    setZajety(true); setBlad('')
    try {
      const r = await api.post(`/import/${rodzaj}`, { csv })
      setWynik(r.data)
      setPodglad(null)
    } catch (e) {
      setBlad(e.response?.data?.error || 'Nie udało się zapisać danych')
    } finally {
      setZajety(false)
    }
  }

  function zacznijOdNowa() {
    setCsv(''); setNazwaPliku(''); setPodglad(null); setWynik(null); setBlad('')
  }

  // PIN-y widać jeden jedyny raz — w bazie zostaje sam hash. Dlatego dajemy
  // je do skopiowania, zanim dyspozytor zamknie ekran.
  function skopiujKonta() {
    const tekst = wynik.konta
      .map(k => `${k.imie} ${k.nazwisko}\tnr ${k.nr_sluzbowy}\tPIN ${k.pin}`)
      .join('\n')
    navigator.clipboard?.writeText(tekst)
  }

  const r = RODZAJE[rodzaj]

  return (
    <div className="form-wrap">
      <div>
        <div className="form-label">Co wgrywasz</div>
        <select className="form-select" value={rodzaj}
                onChange={e => { setRodzaj(e.target.value); zacznijOdNowa() }}>
          {Object.entries(RODZAJE).map(([k, v]) => (
            <option key={k} value={k}>{v.tytul}</option>
          ))}
        </select>
        <div className="form-label" style={{ marginTop: 6, opacity: 0.75 }}>{r.opis}</div>
      </div>

      <div>
        <div className="form-label">Plik CSV z Excela</div>
        <input className="form-input" type="file" accept=".csv,text/csv" onChange={wybierzPlik} />
        {nazwaPliku && (
          <div className="form-label" style={{ marginTop: 6 }}>
            Wybrano: {nazwaPliku}
          </div>
        )}
      </div>

      {blad && <div className="login-error">{blad}</div>}

      {csv && !podglad && !wynik && (
        <button className="btn-primary" onClick={sprawdz} disabled={zajety}>
          {zajety ? 'Sprawdzanie...' : '🔍 Sprawdź plik'}
        </button>
      )}

      {podglad && (
        <div className="import-podglad">
          <h3>Sprawdzenie pliku</h3>
          <p>
            Gotowych do zapisu: <strong>{podglad.podsumowanie.do_dodania ?? podglad.podsumowanie.do_zapisu}</strong>
            {podglad.podsumowanie.bledow > 0 && <> · z błędami: <strong>{podglad.podsumowanie.bledow}</strong></>}
          </p>

          {podglad.bledy?.length > 0 && (
            <>
              <p className="import-uwaga">
                Wiersze z błędami zostaną pominięte. Możesz je poprawić w Excelu i wgrać plik jeszcze raz —
                dane, które już są w aplikacji, zostaną zaktualizowane, nie zdublowane.
              </p>
              <ul className="import-bledy">
                {podglad.bledy.slice(0, 20).map((b, i) => (
                  <li key={i}><strong>wiersz {b.wiersz}</strong> — {b.powod}</li>
                ))}
              </ul>
              {podglad.bledy.length > 20 && <p>…i jeszcze {podglad.bledy.length - 20}</p>}
            </>
          )}

          <button className="btn-primary" onClick={zapisz} disabled={zajety}>
            {zajety ? 'Zapisywanie...' : '✅ Zapisz do aplikacji'}
          </button>
          <button className="btn-secondary" onClick={zacznijOdNowa}>Anuluj</button>
        </div>
      )}

      {wynik && (
        <div className="import-podglad">
          <h3>Gotowe</h3>
          <p>
            {wynik.podsumowanie.dodane != null && <>Dodano: <strong>{wynik.podsumowanie.dodane}</strong> · </>}
            {wynik.podsumowanie.zaktualizowane != null && <>zaktualizowano: <strong>{wynik.podsumowanie.zaktualizowane}</strong> · </>}
            {wynik.podsumowanie.zapisane != null && <>zapisano: <strong>{wynik.podsumowanie.zapisane}</strong> · </>}
            błędów: <strong>{wynik.podsumowanie.bledow}</strong>
          </p>

          {wynik.konta?.length > 0 && (
            <>
              <p className="import-uwaga">
                Poniższe PIN-y widzisz jeden raz — nie da się ich później odczytać, można je tylko nadać na nowo.
                Przepisz je albo skopiuj, zanim zamkniesz ten ekran.
              </p>
              <table className="import-konta">
                <thead><tr><th>Kierowca</th><th>Numer</th><th>PIN</th></tr></thead>
                <tbody>
                  {wynik.konta.map(k => (
                    <tr key={k.nr_sluzbowy}>
                      <td>{k.imie} {k.nazwisko}</td>
                      <td>{k.nr_sluzbowy}</td>
                      <td className="import-pin">{k.pin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn-secondary" onClick={skopiujKonta}>📋 Skopiuj listę</button>
            </>
          )}

          {wynik.bledy?.length > 0 && (
            <ul className="import-bledy">
              {wynik.bledy.slice(0, 20).map((b, i) => (
                <li key={i}><strong>wiersz {b.wiersz}</strong> — {b.powod}</li>
              ))}
            </ul>
          )}

          <button className="btn-primary" onClick={zacznijOdNowa}>Wgraj kolejny plik</button>
        </div>
      )}
    </div>
  )
}
