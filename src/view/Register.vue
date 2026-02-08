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
const confirmPassword = ref('')
const firstName = ref('')
const lastName = ref('')
const userType = ref('Cane_User')
const birthDate = ref('')
const homeLat = ref(0)
const homeLong = ref(0)
const agreeTerms = ref(false)

const error = ref('')
const successMessage = ref('')

const handleRegister = async () => {
  error.value = ''
  successMessage.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }
  if (!agreeTerms.value) {
    error.value = 'You must agree to the Terms of Service and Privacy Policy.'
    return
  }

  const userData = {
    email: email.value,
    password: password.value,
    name: `${firstName.value} ${lastName.value}`.trim(),
    type: userType.value,
    birth_date: new Date(birthDate.value).toISOString(),
    home_long: parseFloat(homeLong.value),
    home_lat: parseFloat(homeLat.value),
  }

  const result = await authStore.register(userData)
  if (result.success) {
    successMessage.value = 'Registration successful! Please log in.'
    setTimeout(() => router.push({ name: 'login' }), 600)
  } else {
    error.value = result.error || 'Registration failed. Please try again.'
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
      <div class="mx-auto w-[440px] space-y-6">
        <Card>
          <CardHeader class="space-y-1 text-center">
            <CardTitle class="text-2xl font-bold">Create Account</CardTitle>
            <CardDescription>Join SmartCane for enhanced mobility</CardDescription>
          </CardHeader>
          <CardContent>
            <form @submit.prevent="handleRegister" class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label for="first-name">First Name</Label>
                  <Input id="first-name" placeholder="First name" required v-model="firstName" />
                </div>
                <div class="space-y-2">
                  <Label for="last-name">Last Name</Label>
                  <Input id="last-name" placeholder="Last name" required v-model="lastName" />
                </div>
              </div>

              <div class="space-y-2">
                <Label for="register-email">Email Address</Label>
                <Input id="register-email" type="email" placeholder="Enter your email" required v-model="email" />
              </div>

              <div class="space-y-2">
                <Label for="register-password">Password</Label>
                <Input id="register-password" type="password" placeholder="Create password" required v-model="password" />
              </div>

              <div class="space-y-2">
                <Label for="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm password"
                  required
                  v-model="confirmPassword"
                />
              </div>

              <div class="space-y-2">
                <Label for="user-type">User Type</Label>
                <select
                  id="user-type"
                  v-model="userType"
                  class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Cane_User">Cane User</option>
                  <option value="Caregiver">Caregiver</option>
                </select>
              </div>

              <div class="space-y-2">
                <Label for="birth-date">Birth Date</Label>
                <Input id="birth-date" type="date" required v-model="birthDate" />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label for="home-lat">Home Latitude</Label>
                  <Input id="home-lat" type="number" step="any" required v-model="homeLat" />
                </div>
                <div class="space-y-2">
                  <Label for="home-long">Home Longitude</Label>
                  <Input id="home-long" type="number" step="any" required v-model="homeLong" />
                </div>
              </div>

              <div class="flex items-center space-x-2">
                <input type="checkbox" id="terms" v-model="agreeTerms" />
                <Label for="terms" class="text-sm font-normal text-muted-foreground">
                  I agree to the <a href="#" class="underline">Terms of Service</a> and
                  <a href="#" class="underline">Privacy Policy</a>
                </Label>
              </div>

              <Button type="submit" class="w-full">Create Account</Button>

              <p v-if="error" class="text-sm text-destructive text-center">{{ error }}</p>
              <p v-if="successMessage" class="text-sm text-green-500 text-center">{{ successMessage }}</p>
            </form>
            <div class="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?
              <Button variant="link" class="p-0 h-auto" @click="router.push({ name: 'login' })">
                Sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
