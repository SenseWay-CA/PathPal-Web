<script setup>
import { useAuthStore } from '@/stores/auth'
import { useRouter, RouterView } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

const authStore = useAuthStore()
const router = useRouter()

const handleLogout = () => {
  authStore.logout()
  router.push('/auth')
}
</script>

<template>
  <div class="flex h-screen bg-background">
    <SidebarProvider>
      <AppSidebar />
      <main class="flex-1 overflow-y-auto p-6">
        <header class="flex items-center justify-between mb-6">
          <SidebarTrigger />
          <button
            @click="handleLogout"
            class="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </header>
        <div class="content">
          <RouterView />
        </div>
      </main>
    </SidebarProvider>
  </div>
</template>
