<script setup>
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const handleLogout = () => {
  authStore.logout()
  router.push('/auth')
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white">
    <div class="p-8 bg-zinc-800 rounded-lg shadow-lg text-center">
      <h1 class="text-4xl font-bold mb-4">Welcome to PathPal</h1>
      <p v-if="authStore.user" class="text-xl text-zinc-400 mb-6">
        You are logged in as {{ authStore.user.email }}
      </p>
      <p class="text-zinc-300">This is your dashboard. More features coming soon!</p>
      <button
        @click="handleLogout"
        class="mt-8 px-6 py-2 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700 transition-colors"
      >
        Logout
      </button>
    </div>
  </div>
</template>
