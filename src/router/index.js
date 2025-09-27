import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import AuthView from '../views/AuthView.vue'
import DashboardView from '../views/DashboardView.vue'
import DashboardHomeView from '../views/DashboardHomeView.vue' // <-- Import the new component
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
    {
      path: '/dashboard',
      component: DashboardView,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: DashboardHomeView,
        },
        {
          path: 'location-tracking',
          name: 'location-tracking',
          component: { template: '<div class="text-white">Location Tracking Page</div>' },
        },
        {
          path: 'health-monitoring',
          name: 'health-monitoring',
          component: { template: '<div class="text-white">Health Monitoring Page</div>' },
        },
        {
          path: 'safety-zones',
          name: 'safety-zones',
          component: { template: '<div class="text-white">Safety Zones Page</div>' },
        },
        {
          path: 'trusted-contacts',
          name: 'trusted-contacts',
          component: { template: '<div class="text-white">Trusted Contacts Page</div>' },
        },
        {
          path: 'device-settings',
          name: 'device-settings',
          component: { template: '<div class="text-white">Device Settings Page</div>' },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: { template: '<div class="text-white">Notifications Page</div>' },
        },
      ],
    },
  ],
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'auth' })
  } else {
    next()
  }
})

export default router
