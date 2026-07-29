export default function Toast({ msg, color }) {
  if (!msg) return null
  return (
    <div className="toast-wrap">
      <div className="toast" style={color ? { background: color } : {}}>
        {msg}
      </div>
    </div>
  )
}
