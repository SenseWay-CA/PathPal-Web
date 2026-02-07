import { createRouter, createWebHistory } from 'vue-router'
import Homepage from '@/view/Homepage.vue' 
import Auth from '@/view/Auth.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: Homepage
  },
  {
    path: '/auth',
    name: 'auth',
    component: Auth
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router