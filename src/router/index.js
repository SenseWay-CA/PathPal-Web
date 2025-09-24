import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import AuthView from '../views/AuthView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: LandingView,
    },
    {
      path: '/auth',
      name: 'auth',
      component: AuthView,
    },
    // Example of a protected route
    {
      path: '/dashboard',
      name: 'dashboard',
      // This will be a new component you create for the user's dashboard
      // component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

// Navigation guard to protect routes
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // If route requires auth and user is not authenticated, redirect to login
    next({ name: 'auth' })
  } else {
    // Otherwise, allow navigation
    next()
  }
})

export default router
