import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import Grafik from './pages/Grafik'
import Usterki from './pages/Usterki'
import Historia from './pages/Historia'
import Telefony from './pages/Telefony'
import BottomNav from './components/BottomNav'
import './App.css'

export default function App() {
  const [token, setToken]       = useState(localStorage.getItem('token'))
  const [kierowca, setKierowca] = useState(JSON.parse(localStorage.getItem('kierowca') || 'null'))
  const [strona, setStrona]     = useState('home')

  // blokada desktop — tylko telefon
  const [czyMobil] = useState(() => {
    const w = window.innerWidth
    const ua = navigator.userAgent
    return w <= 900 || /Android|iPhone|iPad/i.test(ua)
  })

  function login(token, kierowca) {
    localStorage.setItem('token', token)
    localStorage.setItem('kierowca', JSON.stringify(kierowca))
    setToken(token)
    setKierowca(kierowca)
    setStrona('home')
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('kierowca')
    setToken(null)
    setKierowca(null)
    setStrona('home')
  }

  if (!czyMobil) {
    return (
      <div className="desktop-block">
        <div className="desktop-card">
          <span className="desktop-icon">🚌</span>
          <h1>KierowcaApp</h1>
          <p>Aplikacja dostępna tylko na urządzeniach mobilnych.</p>
          <p className="desktop-sub">Otwórz na telefonie z Androidem lub iPhone.</p>
        </div>
      </div>
    )
  }

  if (!token) {
    return <Login onLogin={login} />
  }

  return (
    <div className="app">
      <div className="screen-wrap">
        {strona === 'home'     && <Home kierowca={kierowca} token={token} onLogout={logout} goTo={setStrona} />}
        {strona === 'grafik'   && <Grafik token={token} goTo={setStrona} />}
        {strona === 'usterki'  && <Usterki token={token} kierowca={kierowca} goTo={setStrona} />}
        {strona === 'historia' && <Historia token={token} goTo={setStrona} />}
        {strona === 'telefony' && <Telefony token={token} goTo={setStrona} />}
      </div>
      <BottomNav aktywna={strona} goTo={setStrona} />
    </div>
  )
}
