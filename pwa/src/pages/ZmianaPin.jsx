import { useState } from 'react'
import api from '../api'
import Toast from '../components/Toast'

// Kierowca dostaje PIN nadany przy imporcie i dotąd nie miał jak go zmienić.
// Ekran celowo prosty: trzy pola, żadnych opcji.
export default function ZmianaPin({ goTo }) {
  const [stary, setStary]   = useState('')
  const [nowy, setNowy]     = useState('')
  const [powtorz, setPowtorz] = useState('')
  const [zajety, setZajety] = useState(false)
  const [toast, setToast]   = useState('')

  function pokazToast(msg, color) {
    setToast({ msg, color })
    setTimeout(() => setToast(''), 3000)
  }

  const tylkoCyfry = v => v.replace(/\D/g, '').slice(0, 4)

  async function zapisz() {
    if (nowy.length !== 4) {
      pokazToast('⚠️ Nowy PIN musi mieć 4 cyfry', '#f97316'); return
    }
    if (nowy !== powtorz) {
      pokazToast('⚠️ Powtórzony PIN się nie zgadza', '#f97316'); return
    }
    if (nowy === stary) {
      pokazToast('⚠️ Nowy PIN jest taki sam jak obecny', '#f97316'); return
    }

    setZajety(true)
    try {
      await api.post('/auth/zmien-pin', { stary_pin: stary, nowy_pin: nowy })
      pokazToast('✅ PIN zmieniony — zapamiętaj go')
      setStary(''); setNowy(''); setPowtorz('')
      setTimeout(() => goTo('home'), 1500)
    } catch (e) {
      pokazToast(e.response?.data?.error || '❌ Nie udało się zmienić PIN-u', '#ef4444')
      setStary('')
    } finally {
      setZajety(false)
    }
  }

  return (
    <div>
      <div className="topbar">
        <button className="topbar-back" onClick={() => goTo('home')}>←</button>
        <h2>Zmiana PIN-u</h2>
        <span>🔒</span>
      </div>

      <div className="form-wrap">
        <div className="import-uwaga">
          PIN-u nie da się odczytać ani odzyskać. Jeśli go zapomnisz, dyspozytor
          nada nowy. Nie zapisuj go w autokarze.
        </div>

        <div>
          <div className="form-label">Obecny PIN</div>
          <input className="form-input" type="password" inputMode="numeric"
                 autoComplete="current-password" maxLength={4}
                 value={stary} onChange={e => setStary(tylkoCyfry(e.target.value))} />
        </div>

        <div>
          <div className="form-label">Nowy PIN (4 cyfry)</div>
          <input className="form-input" type="password" inputMode="numeric"
                 autoComplete="new-password" maxLength={4}
                 value={nowy} onChange={e => setNowy(tylkoCyfry(e.target.value))} />
        </div>

        <div>
          <div className="form-label">Powtórz nowy PIN</div>
          <input className="form-input" type="password" inputMode="numeric"
                 autoComplete="new-password" maxLength={4}
                 value={powtorz} onChange={e => setPowtorz(tylkoCyfry(e.target.value))} />
        </div>

        <button className="btn-primary" onClick={zapisz}
                disabled={zajety || stary.length !== 4 || nowy.length !== 4 || powtorz.length !== 4}>
          {zajety ? 'Zapisywanie...' : 'Zmień PIN'}
        </button>
      </div>

      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  )
}
