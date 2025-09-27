import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const user = ref(null)

  const fetchWithCredentials = (url, options = {}) => {
    options.credentials = 'include'
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    return fetch(url, options)
  }

  async function login(email, password) {
    const response = await fetchWithCredentials('https://api.senseway.ca/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (response.ok) {
      const userData = await response.json()
      isAuthenticated.value = true
      user.value = userData
      return true
    } else {
      isAuthenticated.value = false
      user.value = null
      return false
    }
  }

  async function register(email, password) {
    const response = await fetchWithCredentials('https://api.senseway.ca/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    return response.ok ? await login(email, password) : false
  }

  async function logout() {
    await fetchWithCredentials('https://api.senseway.ca/logout', { method: 'POST' })
    isAuthenticated.value = false
    user.value = null
  }

  async function checkAuth() {
    try {
      const response = await fetchWithCredentials('https://api.senseway.ca/check-auth')
      if (response.ok) {
        const userData = await response.json()
        isAuthenticated.value = true
        user.value = userData
      } else {
        isAuthenticated.value = false
        user.value = null
      }
    } catch (error) {
      isAuthenticated.value = false
      user.value = null
    }
  }

  return { isAuthenticated, user, login, register, logout, checkAuth }
})
