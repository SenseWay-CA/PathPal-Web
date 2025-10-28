import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const API_BASE_URL = 'https://api.senseway.ca'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const user = ref(null)
  const router = useRouter()

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
      console.log('Login successful:', userData)
      return { success: true, user: userData }
    } else {
      isAuthenticated.value = false
      user.value = null
      const errorData = await response.json().catch(() => ({ error: 'Login failed' }))
      console.error('Login failed:', response.status, errorData)
      return { success: false, error: errorData.error || 'Invalid credentials' }
    }
  }

  async function register(userData) {
    const response = await fetchWithCredentials(`${API_BASE_URL}/register`, {
      method: 'POST',
      body: JSON.stringify(userData),
    })

    if (response.ok) {
      const createdUser = await response.json()
      console.log('Registration successful:', createdUser)
      return { success: true, user: createdUser }
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Registration failed' }))
      console.error('Registration failed:', response.status, errorData)
      return { success: false, error: errorData.error || 'Registration failed' }
    }
  }

  async function logout() {
    const response = await fetchWithCredentials(`${API_BASE_URL}/session`, { method: 'DELETE' })
    isAuthenticated.value = false
    user.value = null
    console.log('Logout status:', response.ok)
  }

  async function checkAuth() {
    console.log('Checking auth status...')
    const response = await fetchWithCredentials(`${API_BASE_URL}/session`)

    if (response.ok) {
      const userData = await response.json()
      isAuthenticated.value = true
      user.value = userData
      console.log('Auth check successful:', userData)
      return true
    } else {
      isAuthenticated.value = false
      user.value = null
      console.log('Auth check failed:', response.status)
      return false
    }
  }

  return { isAuthenticated, user, login, register, logout, checkAuth }
})
