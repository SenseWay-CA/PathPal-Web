import { createRouter, createWebHistory } from 'vue-router'
import Homepage from '@/view/Homepage.vue'
import Auth from '@/view/Auth.vue'
import AuthView from '@/view/AuthView.vue'
import AppView from '@/view/App.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: Homepage,
  },
  {
    path: '/auth',
    name: 'auth',
    component: Auth,
  },
  {
    path: '/auth-view',
    name: 'auth-view',
    component: AuthView,
  },
  {
    path: '/app',
    name: 'app',
    component: AppView,
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router