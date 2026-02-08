<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')

const handleLogin = async () => {
  error.value = ''
  const result = await authStore.login(email.value, password.value)
  if (result.success) {
    router.push({ name: 'app' })
  } else {
    error.value = result.error || 'Login failed. Please check your credentials.'
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

    <div class="flex items-center justify-center py-12 bg-background text-foreground">
      <div class="mx-auto w-[400px] space-y-6">
        <Card>
          <CardHeader class="space-y-1 text-center">
            <CardTitle class="text-2xl font-bold">Welcome Back</CardTitle>
            <CardDescription>Sign in to your SmartCane account</CardDescription>
          </CardHeader>
          <CardContent>
            <form @submit.prevent="handleLogin" class="space-y-4">
              <div class="space-y-2">
                <Label for="login-email">Email Address</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Enter your email"
                  required
                  v-model="email"
                />
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label for="login-password">Password</Label>
                  <a href="#" class="text-sm text-muted-foreground hover:underline"
                    >Forgot password?</a
                  >
                </div>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  v-model="password"
                />
              </div>
              <Button type="submit" class="w-full">Sign In</Button>
              <p v-if="error" class="text-sm text-destructive text-center">{{ error }}</p>
            </form>
            <div class="mt-4 text-center text-sm text-muted-foreground">
              Don't have an account?
              <Button variant="link" class="p-0 h-auto" @click="router.push({ name: 'register' })">
                Sign up
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
