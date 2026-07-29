import { useState, useEffect } from 'react'
import api from '../api'

const AVATAR_COLOR = {
  'dyżur':    { dyspozytor: 'orange', 'wydział ruchu': 'blue' },
  'serwis':   { default: 'green' },
  'centrala': { default: 'purple' },
}

function avatarCls(grupa) {
  const map = { 'dyżur': 'orange', 'serwis': 'green', 'centrala': 'purple' }
  return map[grupa] || 'blue'
}

export default function Telefony({ token, goTo }) {
  const [kontakty, setKontakty] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    api.get('/kontakty')
      .then(r => setKontakty(r.data || []))
      .catch(() => setKontakty([]))
      .finally(() => setLoading(false))
  }, [])

  // Grupuj kontakty
  const grupy = kontakty.reduce((acc, k) => {
    if (!acc[k.grupa]) acc[k.grupa] = []
    acc[k.grupa].push(k)
    return acc
  }, {})

  const nazwyGrup = { 'dyżur': 'Dyżur / pilne', 'serwis': 'Serwis / technika', 'centrala': 'Centrala' }

  return (
    <div>
      <div className="topbar">
        <button className="topbar-back" onClick={() => goTo('home')}>←</button>
        <h2>Telefony kontaktowe</h2>
        <span>📞</span>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        Object.entries(grupy).map(([grupa, lista]) => (
          <div key={grupa} className="contact-group">
            <div className="contact-group-label">
              {nazwyGrup[grupa] || grupa}
            </div>
            {lista.map(k => (
              <div key={k.id} className="contact-card">
                <div className={`contact-avatar ${avatarCls(grupa)}`}>
                  {k.ikona}
                </div>
                <div>
                  <div className="contact-name">{k.nazwa}</div>
                  <div className="contact-role">{k.rola}</div>
                </div>
                <a
                  href={`tel:${k.telefon?.replace(/\s/g, '')}`}
                  className="contact-phone"
                >
                  📞 Zadzwoń
                </a>
              </div>
            ))}
          </div>
        ))
      )}
      <div style={{ height: '14px' }} />
    </div>
  )
}
