import { useState, useEffect } from 'react'
import api from '../api'
import Toast from '../components/Toast'

// Akceptuje pełne linki YouTube (watch?v=, youtu.be/, embed/) i zwraca URL do <iframe>
function toEmbedUrl(url) {
  if (!url) return url
  const watch = url.match(/[?&]v=([^&]+)/)
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`
  const short = url.match(/youtu\.be\/([^?]+)/)
  if (short) return `https://www.youtube.com/embed/${short[1]}`
  return url
}

export default function SzkolenieDetal({ materialId, goTo, setWybranyTestId }) {
  const [material, setMaterial] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [ukonczono, setUkonczono] = useState(false)
  const [toast, setToast]       = useState('')

  useEffect(() => {
    api.get(`/szkolenia/${materialId}`)
      .then(r => setMaterial(r.data))
      .catch(() => setMaterial(null))
      .finally(() => setLoading(false))
  }, [materialId])

  async function oznaczUkonczone() {
    try {
      await api.post(`/szkolenia/${materialId}/ukoncz`)
      setUkonczono(true)
      setToast({ msg: '✅ Oznaczono jako ukończone' })
      setTimeout(() => setToast(''), 2500)
    } catch {
      setToast({ msg: '❌ Błąd — spróbuj ponownie', color: '#ef4444' })
      setTimeout(() => setToast(''), 2500)
    }
  }

  function rozwiazTest() {
    setWybranyTestId(material.test.id)
    goTo('test')
  }

  return (
    <div>
      <div className="topbar">
        <button className="topbar-back" onClick={() => goTo('szkolenia')}>←</button>
        <h2>{material?.tytul || 'Szkolenie'}</h2>
        <span>{material?.typ === 'wideo' ? '🎬' : '📚'}</span>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : !material ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
          Nie udało się wczytać materiału
        </div>
      ) : (
        <>
          {material.typ === 'wideo' && material.wideo_url && (
            <div className="material-video">
              <iframe src={toEmbedUrl(material.wideo_url)} title={material.tytul} allowFullScreen />
            </div>
          )}

          {material.typ === 'artykul' && material.tresc && (
            <div className="material-content">{material.tresc}</div>
          )}

          <div className="form-wrap">
            <button className="btn-primary" onClick={oznaczUkonczone} disabled={ukonczono}>
              {ukonczono ? '✓ Ukończono' : 'Oznacz jako ukończone'}
            </button>

            {material.test && (
              <button className="btn-blue" onClick={rozwiazTest}>
                📝 Rozwiąż test: {material.test.tytul}
              </button>
            )}
          </div>
        </>
      )}

      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  )
}
