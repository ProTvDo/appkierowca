import { useState } from 'react'
import api from '../api'

export default function Login({ onLogin }) {
  const [nr, setNr]       = useState('')
  const [pin, setPin]     = useState('')
  const [blad, setBlad]   = useState('')
  const [loading, setLoading] = useState(false)

  function pinPress(d) {
    if (pin.length >= 4) return
    setPin(p => p + d)
    setBlad('')
  }
  function pinDel() { setPin(p => p.slice(0, -1)) }

  async function doLogin() {
    if (!nr || pin.length !== 4) return
    setLoading(true)
    setBlad('')
    try {
      const res = await api.post('/auth/login', { nr_sluzbowy: nr, pin })
      onLogin(res.data.token, res.data.kierowca)
    } catch (e) {
      setBlad(e.response?.data?.error || 'Błąd połączenia z serwerem')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const gotowy = nr.length >= 4 && pin.length === 4

  return (
    <div className="login-wrap">
      <div className="login-logo">
        <span className="logo-bus">🚌</span>
        <h2>KierowcaApp</h2>
        <p>System informacji dla kierowców</p>
      </div>

      <div className="login-form">
        <div>
          <div className="login-label">Numer służbowy</div>
          <input
            className="login-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="np. 2669"
            value={nr}
            onChange={e => { setNr(e.target.value.replace(/\D/g, '')); setBlad('') }}
          />
        </div>

        <div>
          <div className="login-label">PIN (4 cyfry)</div>
          <div className="pin-display">
            {[0,1,2,3].map(i => (
              <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
            ))}
          </div>
          <div className="pin-pad">
            {[1,2,3,4,5,6,7,8,9].map(d => (
              <button key={d} className="pin-btn" onClick={() => pinPress(String(d))}>{d}</button>
            ))}
            <button className="pin-btn empty" />
            <button className="pin-btn" onClick={() => pinPress('0')}>0</button>
            <button className="pin-btn del" onClick={pinDel}>⌫</button>
          </div>
        </div>

        {blad && <div className="login-error">{blad}</div>}

        <button
          className="btn-primary"
          onClick={doLogin}
          disabled={!gotowy || loading}
        >
          {loading ? 'Logowanie...' : 'Zaloguj się'}
        </button>
      </div>
    </div>
  )
}
