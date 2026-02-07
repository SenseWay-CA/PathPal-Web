import { createRouter, createWebHistory } from 'vue-router'
import Homepage from '@/view/Homepage.vue'
import AppView from '@/view/App.vue' 

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',      // This makes Homepage the opening screen
      name: 'home',
      component: Homepage, 
    },
    {
      path: '/app',   // You can visit App.vue by going to /app
      name: 'app',
      component: AppView, 
    }
  ],
})

export default router