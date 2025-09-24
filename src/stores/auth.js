import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const user = ref(null)

  async function login(email, password) {
    const response = await fetch('http://api.senseway.ca/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (response.ok) {
      const data = await response.json()
      localStorage.setItem('token', data.token)
      isAuthenticated.value = true
      user.value = { email }
      return true
    } else {
      console.error('Login failed')
      return false
    }
  }

  async function register(email, password) {
    const response = await fetch('http://api.senseway.ca/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (response.ok) {
      console.log('Registration successful')
      // Automatically log the user in after successful registration
      return await login(email, password)
    } else {
      console.error('Registration failed')
      return false
    }
  }

  function logout() {
    localStorage.removeItem('token')
    isAuthenticated.value = false
    user.value = null
  }

  return { isAuthenticated, user, login, register, logout }
})
