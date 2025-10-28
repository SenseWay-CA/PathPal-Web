import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import AuthView from '../views/AuthView.vue'
import DashboardView from '../views/DashboardView.vue'
import HomeView from '../views/HomeView.vue'
import { useAuthStore } from '@/stores/auth'
import LocationTrackingView from '@/views/LocationTrackingView.vue'
import HealthMonitoringView from '@/views/HealthMonitoringView.vue'
import SafetyZonesView from '@/views/SafetyZonesView.vue'
import TrustedContactsView from '@/views/TrustedContactsView.vue'
import DeviceSettingsView from '@/views/DeviceSettingsView.vue'
import NotificationsView from '@/views/NotificationsView.vue'

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
      meta: { requiresGuest: true },
    },
    {
      path: '/dashboard',
      component: DashboardView,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: HomeView },
        { path: 'location-tracking', name: 'location-tracking', component: LocationTrackingView },
        { path: 'health-monitoring', name: 'health-monitoring', component: HealthMonitoringView },
        { path: 'safety-zones', name: 'safety-zones', component: SafetyZonesView },
        { path: 'trusted-contacts', name: 'trusted-contacts', component: TrustedContactsView },
        { path: 'device-settings', name: 'device-settings', component: DeviceSettingsView },
        { path: 'notifications', name: 'notifications', component: NotificationsView },
      ],
    },

    // {
    //   path: '/:pathMatch(.*)*',
    //   name: 'NotFound',
    //   component: () => import('../views/NotFoundView.vue'),
    // },
  ],
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  if (
    (!authStore.isAuthenticated && authStore.user === null && to.name !== 'landing') ||
    (to.meta.requiresAuth && !authStore.isAuthenticated)
  ) {
    if (authStore.user === null) {
      await authStore.checkAuth()
    }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    console.log('Redirecting to auth, requiresAuth failed')
    next({ name: 'auth' })
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    console.log('Redirecting to dashboard, requiresGuest failed')
    next({ name: 'dashboard' })
  } else {
    console.log('Allowing navigation to', to.name)
    next()
  }
})

export default router
