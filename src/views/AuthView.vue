<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const isLogin = ref(true)
const email = ref('')
const password = ref('')

const handleSubmit = async () => {
  let success = false
  if (isLogin.value) {
    success = await authStore.login(email.value, password.value)
  } else {
    success = await authStore.register(email.value, password.value)
  }

  if (success) {
    router.push('/dashboard')
  }
}
</script>

<template>
  <div class="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
    <div class="hidden bg-zinc-900 lg:flex flex-col justify-between p-12 text-white">
      <div class="text-3xl font-bold">SenseWay</div>
      <div class="max-w-md text-5xl font-extrabold leading-tight">
        Surrender your steps.<br />
        Obey the algorithm.<br />
        We know where you're going.
      </div>
      <div />
    </div>
    <div class="flex items-center justify-center py-12 bg-black text-white">
      <div class="mx-auto grid w-[350px] gap-6">
        <div class="grid gap-2 text-center">
          <h1 class="text-3xl font-bold">
            {{ isLogin ? 'Login' : 'Create an account' }}
          </h1>
          <p class="text-balance text-zinc-400">
            {{
              isLogin
                ? 'Enter your email below to login to your account'
                : 'Enter your information to create an account'
            }}
          </p>
        </div>
        <form @submit.prevent="handleSubmit" class="grid gap-4">
          <div class="grid gap-2">
            <label for="email" class="text-sm font-medium sr-only">Email</label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              required
              v-model="email"
              class="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>
          <div class="grid gap-2">
            <label for="password" class="text-sm font-medium sr-only">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              required
              v-model="password"
              class="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>
          <button
            type="submit"
            class="w-full bg-white text-black font-semibold py-2 rounded-md hover:bg-zinc-200 transition-colors"
          >
            {{ isLogin ? 'Login' : 'Create account' }}
          </button>
        </form>
        <div class="mt-4 text-center text-sm">
          <span v-if="isLogin">
            Don't have an account?
            <button @click="isLogin = false" class="underline text-zinc-400 hover:text-zinc-200">
              Sign up
            </button>
          </span>
          <span v-else>
            Already have an account?
            <button @click="isLogin = true" class="underline text-zinc-400 hover:text-zinc-200">
              Login
            </button>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
