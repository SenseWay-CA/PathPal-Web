import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const user = ref(null)

  // Placeholder for login action
  async function login(email, password) {
    // Here you will make the API call to your Go backend
    console.log('Logging in with:', email, password)
    // On successful login from backend:
    // isAuthenticated.value = true
    // user.value = { email } // or whatever user data your API returns
  }

  // Placeholder for registration action
  async function register(email, password) {
    // Here you will make the API call to your Go backend
    console.log('Registering with:', email, password)
    // On successful registration:
    // Potentially log the user in directly or redirect to login
  }

  function logout() {
    isAuthenticated.value = false
    user.value = null
  }

  return { isAuthenticated, user, login, register, logout }
})
