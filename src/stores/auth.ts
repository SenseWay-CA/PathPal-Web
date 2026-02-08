import { defineStore } from 'pinia'
import { ref } from 'vue'

const API_BASE_URL = 'https://api.senseway.ca' // adjust if needed
const TOKEN_KEY = 'auth_token'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const user = ref<any>(null)
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))

  const setToken = (t: string | null) => {
    token.value = t
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  }

  const jsonResponse = async (res: Response) => {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return res.json()
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { message: text } }
  }

  const fetchWithCredentials = async (path: string, options: RequestInit = {}) => {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }
    if (token.value) headers['Authorization'] = `Bearer ${token.value}`
    const opts: RequestInit = {
      credentials: 'include',
      ...options,
      headers,
    }
    try {
      const res = await fetch(url, opts)
      const data = await jsonResponse(res).catch(() => ({}))
      return { ok: res.ok, status: res.status, data }
    } catch (err) {
      console.error('Network error:', err)
      return { ok: false, status: 0, data: { error: 'Network error' } }
    }
  }

  async function login(email: string, password: string) {
    const resp = await fetchWithCredentials('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (resp.ok) {
      // Accept either session-based auth (cookie) or token in response
      const payload = resp.data
      if (payload?.token) setToken(payload.token)
      isAuthenticated.value = true
      user.value = payload.user ?? payload
      return { success: true, user: user.value }
    } else {
      isAuthenticated.value = false
      user.value = null
      const message = resp.data?.error || resp.data?.message || 'Login failed'
      return { success: false, error: message }
    }
  }

  async function register(userData: Record<string, any>) {
    const resp = await fetchWithCredentials('/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
    if (resp.ok) {
      return { success: true, user: resp.data }
    } else {
      const message = resp.data?.error || resp.data?.message || 'Registration failed'
      return { success: false, error: message }
    }
  }

  async function logout() {
    // attempt server-side session logout; still clear local token
    await fetchWithCredentials('/session', { method: 'DELETE' })
    setToken(null)
    isAuthenticated.value = false
    user.value = null
  }

  async function checkAuth() {
    // Prefer a dedicated endpoint that returns current user, try /session or /me
    const candidates = ['/session', '/me', '/auth/session']
    for (const p of candidates) {
      const resp = await fetchWithCredentials(p)
      if (resp.ok) {
        user.value = resp.data
        isAuthenticated.value = true
        // pick up token if backend returns one
        if (resp.data?.token) setToken(resp.data.token)
        return true
      }
    }
    setToken(null)
    isAuthenticated.value = false
    user.value = null
    return false
  }

  // helper for other API calls
  const api = async (path: string, opts: RequestInit = {}) => {
    return fetchWithCredentials(path, opts)
  }

  return { isAuthenticated, user, token, login, register, logout, checkAuth, api }
})