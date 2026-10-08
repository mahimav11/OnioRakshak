import { call } from './api.js'

const KEY = 'or_users', SES = 'or_session'
const users = () => JSON.parse(localStorage.getItem(KEY) || '{}')
const hash = async (p, salt) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + p)))].map((x) => x.toString(16).padStart(2, '0')).join('')
const missing = (e) => /^404/.test(e.message)   // API has no auth routes yet: use demo accounts in this browser

export const getSession = () => { try { return JSON.parse(localStorage.getItem(SES)) } catch { return null } }
export const setSession = (u) => localStorage.setItem(SES, JSON.stringify(u))
export const clearSession = () => localStorage.removeItem(SES)

export async function signup(p) {
  try { return await call('/auth/signup', p) } catch (e) { if (!missing(e)) throw e }
  const all = users()
  if (all[p.phone]) throw new Error('exists')
  const { password, ...profile } = p
  const salt = crypto.randomUUID()
  all[p.phone] = { profile, salt, hash: await hash(password, salt) }
  localStorage.setItem(KEY, JSON.stringify(all))
  return profile
}

export async function login(phone, password) {
  try { return await call('/auth/login', { phone, password }) } catch (e) { if (!missing(e)) throw e }
  const u = users()[phone]
  if (!u || (await hash(password, u.salt)) !== u.hash) throw new Error('bad')
  return u.profile
}
