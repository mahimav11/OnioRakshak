// EDIT THESE to match your FastAPI routes (open http://localhost:8000/docs to see them).
export const BASE = import.meta.env.VITE_API_BASE ?? '/api'
export const EP = { forecast: '/forecast', risk: '/storage/risk', chat: '/chat' }
export const MARKETS = ['Lasalgaon', 'Pimpalgaon', 'Pune', 'Solapur']
export const VARIETIES = ['Red', 'White', 'Local']

export async function call(path, { method = 'GET', body, params } = {}) {
  const q = params ? '?' + new URLSearchParams(params) : ''
  const r = await fetch(BASE + path + q, {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(r.status)
  return r.json()
}
// Tolerant readers: accept several common key names from the API.
export const pick = (o, keys, d) => { for (const k of keys) if (o?.[k] != null) return o[k]; return d }
export const series = (a = []) => a.map((p) => ({ d: pick(p, ['date', 'ds', 'day'], ''), v: +pick(p, ['price', 'yhat', 'value', 'modal_price'], 0) }))
