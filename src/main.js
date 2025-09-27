import './assets/styles.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'

async function initialize() {
  const app = createApp(App)

  app.use(createPinia())

  const authStore = useAuthStore()
  await authStore.checkAuth()

  app.use(router)

  app.mount('#app')
}

initialize()
