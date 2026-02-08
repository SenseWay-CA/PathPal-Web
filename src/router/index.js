import { createRouter, createWebHistory } from 'vue-router'
import Homepage from '@/view/Homepage.vue'
import AppView from '@/view/App.vue'
import Login from '@/view/Login.vue'
import Register from '@/view/Register.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: Homepage,
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
  },
  {
    path: '/register',
    name: 'register',
    component: Register,
  },
  {
    path: '/auth',
    redirect: { name: 'login' },
  },
  {
    path: '/auth-view',
    redirect: { name: 'login' },
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
