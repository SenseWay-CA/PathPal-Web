import { defineStore } from 'pinia'
import { ref } from 'vue'

const API_BASE_URL = 'https://api.senseway.ca'
const LS_USER_KEY = 'sw_user_cache'

export const useAuthStore = defineStore('auth', () => {
  // restore cached user for instant UI — still validated against server in checkAuth
  const cachedRaw = localStorage.getItem(LS_USER_KEY)
  const isAuthenticated = ref(!!cachedRaw)
  const user = ref(cachedRaw ? JSON.parse(cachedRaw) : null)

  const fetchWithCredentials = async (url, options = {}) => {
    options.credentials = 'include'
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    try {
      const response = await fetch(url, options)
      return response
    } catch (error) {
      console.error('Fetch error:', error)
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Network error or server unreachable' }),
        text: async () => 'Network error or server unreachable',
      }
    }
  }

  async function login(email, password) {
    const response = await fetchWithCredentials(`${API_BASE_URL}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (response.ok) {
      const userData = await response.json()
      isAuthenticated.value = true
      user.value = userData
      localStorage.setItem(LS_USER_KEY, JSON.stringify(userData))
      return { success: true, user: userData }
    } else {
      isAuthenticated.value = false
      user.value = null
      localStorage.removeItem(LS_USER_KEY)
      const errorData = await response.json().catch(() => ({ error: 'Login failed' }))
      return { success: false, error: errorData.error || 'Invalid credentials' }
    }
  }

  async function register(userData) {
    const registerData = {
      ...userData,
      birth_date:
        userData.birth_date instanceof Date
          ? userData.birth_date.toISOString()
          : userData.birth_date,
    }

    const response = await fetchWithCredentials(`${API_BASE_URL}/register`, {
      method: 'POST',
      body: JSON.stringify(registerData),
    })

    if (response.ok) {
      const createdUser = await response.json()
      return { success: true, user: createdUser }
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Registration failed' }))
      return { success: false, error: errorData.error || 'Registration failed' }
    }
  }

  async function logout() {
    await fetchWithCredentials(`${API_BASE_URL}/session`, { method: 'DELETE' })
    isAuthenticated.value = false
    user.value = null
    localStorage.removeItem(LS_USER_KEY)
  }

  async function checkAuth() {
    const response = await fetchWithCredentials(`${API_BASE_URL}/session`)

    if (response.ok) {
      const userData = await response.json()
      isAuthenticated.value = true
      user.value = userData
      localStorage.setItem(LS_USER_KEY, JSON.stringify(userData))
      return true
    } else {
      isAuthenticated.value = false
      user.value = null
      localStorage.removeItem(LS_USER_KEY)
      return false
    }
  }

  // update cached user after profile edits
  function updateCachedUser(updated) {
    user.value = { ...user.value, ...updated }
    localStorage.setItem(LS_USER_KEY, JSON.stringify(user.value))
  }

  return { isAuthenticated, user, login, register, logout, checkAuth, updateCachedUser }
})
