import '@/assets/styles.css'
import { createApp } from 'vue'
import Root from './Root.vue' // Point this to your new shell
import router from './router'

const app = createApp(Root) // 'Root' is now the boss, not 'App'
app.use(router)
app.mount('#app')