import { useState, useEffect } from 'react'
import api from '../api'

const STATUS_LABEL = {
  nowa:       { label: 'NOWA',       cls: 'nowa' },
  w_naprawie: { label: 'W NAPRAWIE', cls: 'w_naprawie' },
  naprawiona: { label: 'NAPRAWIONA', cls: 'naprawiona' },
}

export default function Historia({ token, goTo }) {
  const [usterki, setUsterki] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/usterki')
      .then(r => setUsterki(r.data || []))
      .catch(() => setUsterki([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="topbar">
        <button className="topbar-back" onClick={() => goTo('home')}>←</button>
        <h2>Historia zgłoszeń</h2>
        <span>📋</span>
      </div>

      <div style={{ padding: '14px' }}>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : usterki.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
            Brak zgłoszeń
          </div>
        ) : (
          usterki.map(u => {
            const s = STATUS_LABEL[u.status] || { label: u.status, cls: 'nowa' }
            const data = new Date(u.created_at).toLocaleString('pl-PL', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })
            return (
              <div key={u.id} className="usterka-item">
                <div className="usterka-top">
                  <span className="usterka-vehicle">{u.pojazdy?.nr_boczny}</span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{data}</span>
                  <span className={`usterka-status ${s.cls}`}>{s.label}</span>
                </div>
                <div className="usterka-desc">
                  {u.kategorie_usterek?.ikona} {u.kategorie_usterek?.nazwa}
                </div>
                {u.opis && (
                  <div className="usterka-meta">{u.opis}</div>
                )}
                {u.lokalizacja && (
                  <div className="usterka-meta">📍 {u.lokalizacja}</div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
