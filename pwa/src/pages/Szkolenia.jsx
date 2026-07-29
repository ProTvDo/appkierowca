import { useState, useEffect } from 'react'
import api from '../api'

const TYP_ICON = { artykul: '📚', wideo: '🎬' }

export default function Szkolenia({ goTo, setWybranyMaterialId }) {
  const [materialy, setMaterialy] = useState([])
  const [postepy, setPostepy]     = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/szkolenia'),
      api.get('/szkolenia/postepy/wszystkie'),
    ])
      .then(([m, p]) => {
        setMaterialy(m.data || [])
        setPostepy(p.data)
      })
      .catch(() => { setMaterialy([]); setPostepy(null) })
      .finally(() => setLoading(false))
  }, [])

  function otworz(id) {
    setWybranyMaterialId(id)
    goTo('szkolenie-detal')
  }

  return (
    <div>
      <div className="topbar">
        <button className="topbar-back" onClick={() => goTo('home')}>←</button>
        <h2>Szkolenia</h2>
        <span>🎓</span>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <>
          {postepy?.uprawnienia?.length > 0 && (
            <>
              <div className="section-title">Moje uprawnienia</div>
              <div style={{ padding: '0 14px' }}>
                {postepy.uprawnienia.map(u => (
                  <div key={u.id} className="progress-item">
                    <div>
                      <div className="name">{u.nazwa}</div>
                      <div className="meta">Ważne do {new Date(u.data_waznosci).toLocaleDateString('pl-PL')}</div>
                    </div>
                    <span className={`uprawnienie-status ${u.status}`}>
                      {u.status === 'ok' ? 'OK' : u.status === 'zblizajace_sie' ? 'ZBLIŻA SIĘ' : 'PRZETERMINOWANE'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-title">Materiały szkoleniowe</div>
          <div style={{ padding: '0 14px' }}>
            {materialy.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>
                Brak materiałów szkoleniowych
              </div>
            ) : (
              materialy.map(m => (
                <div key={m.id} className="material-item" onClick={() => otworz(m.id)}>
                  <div className="material-icon">{TYP_ICON[m.typ] || '📄'}</div>
                  <div className="material-info">
                    <div className="material-title">{m.tytul}</div>
                    <div className="material-sub">
                      {m.opis_skrocony}
                      {m.test_id && ' · zawiera test'}
                    </div>
                  </div>
                  {m.ukonczony && <span className="material-check">✓</span>}
                </div>
              ))
            )}
          </div>

          {postepy?.testy?.length > 0 && (
            <>
              <div className="section-title">Historia testów</div>
              <div style={{ padding: '0 14px' }}>
                {postepy.testy.map(t => (
                  <div key={t.id} className="progress-item">
                    <div>
                      <div className="name">{t.testy?.tytul}</div>
                      <div className="meta">{new Date(t.created_at).toLocaleDateString('pl-PL')}</div>
                    </div>
                    <span className={`uprawnienie-status ${t.zdany ? 'ok' : 'przeterminowane'}`}>
                      {t.wynik_procent}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
