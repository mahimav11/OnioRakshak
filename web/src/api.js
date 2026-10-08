import { useEffect, useState } from 'react'

export const BASE = import.meta.env.VITE_API_BASE ?? '/api'
// Chat router prefix: if /api/chat gives 404, check APIRouter(prefix=...) in ml/api/chat.py and edit here.
export const EP = { meta: '/meta', price: '/predict/price', risk: '/predict/storage-health', chat: '/chat' }

export async function call(path, body) {
  const r = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) {
    let d = ''
    try { const j = await r.json(); d = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j) } catch { /* no body */ }
    throw new Error(`${r.status} ${d}`.trim())
  }
  return r.json()
}

export function useMeta() {
  const [meta, setMeta] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { call(EP.meta).then(setMeta).catch((e) => setErr(e.message)) }, [])
  return { meta, err }
}
