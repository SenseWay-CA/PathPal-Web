import '@/assets/styles.css'
import { createApp } from 'vue'
import Root from './Root.vue'
import router from './router'
import { createPinia } from 'pinia'

const app = createApp(Root) 
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')