<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const REVIEWS = [
  { name: 'Priya Sharma',         handle: 'Toronto, ON',      body: 'My father uses the smart cane every day. The real-time alerts give our whole family peace of mind.' },
  { name: 'August Zhang',         handle: 'Richmond Hill, ON', body: 'Helped my grandfather set it up — he loves the independence it gives him. Incredible technology.' },
  { name: 'Kavya Jayasinghe',     handle: 'Scarborough, ON',  body: 'My aththamma uses this every morning. The SOS button gave us so much peace of mind.' },
  { name: 'Sarah Mitchell',       handle: 'Vancouver, BC',    body: 'Dad had hip surgery and now walks freely again. SenseWay tracking means I never worry.' },
  { name: 'Fatima Malik',         handle: 'Brampton, ON',     body: 'As a caregiver I can monitor patients remotely. Geofencing zones are smart and easy to set up.' },
  { name: 'Wei-Lin Chen',         handle: 'Markham, ON',      body: 'Recommended SenseWay to three other families. The reliability and alerts are second to none.' },
  { name: 'Niroshan Perera',      handle: 'Etobicoke, ON',    body: 'Thaaththaa was afraid of falling alone. With SenseWay I check on him from my phone daily.' },
  { name: 'James O\'Brien',       handle: 'Halifax, NS',      body: 'Setup took 10 minutes. Battery life amazing, alerts instant. Mum loves her independence back.' },
  { name: 'Arjun Nair',           handle: 'Mississauga, ON',  body: 'Fall detection saved my grandfather from being alone for hours. Simply incredible.' },
  { name: 'Xiao-Ming Liu',        handle: 'Scarborough, ON',  body: 'Yéye walks to the park every morning and we track him in real time. Essential for our family.' },
  { name: 'Dilrukshi Wijesinghe', handle: 'Mississauga, ON',  body: 'After amma\'s stroke we were so worried. SenseWay gave us safety and her the freedom she deserved.' },
  { name: 'Michael Clarke',       handle: 'Toronto, ON',      body: 'Clean design, rock-solid. The SOS feature gave my father confidence to walk on his own again.' },
]
const row1 = REVIEWS.slice(0, 6)
const row2 = REVIEWS.slice(6)

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
    <div class="hidden bg-zinc-900 lg:flex flex-col justify-between p-12 text-white" style="overflow:hidden;min-width:0;">
      <div class="text-3xl font-bold" style="background:linear-gradient(90deg,#4f8ff7,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">SenseWay</div>
      <div class="max-w-md text-5xl font-extrabold leading-tight">
        Surrender your steps.<br />
        Obey the algorithm.<br />
        We know where you're going.
      </div>

      <!-- testimonial marquee -->
      <div class="reg-marquee-wrap">
        <div class="reg-fade-l"></div>
        <div class="reg-fade-r"></div>
        <div class="reg-marquee-row">
          <div class="reg-track reg-track--fwd">
            <div v-for="r in [...row1, ...row1]" :key="r.name + r.handle" class="reg-card">
              <p class="reg-body">{{ r.body }}</p>
              <div class="reg-author">
                <div class="reg-av">{{ r.name[0] }}</div>
                <div><div class="reg-name">{{ r.name }}</div><div class="reg-handle">{{ r.handle }}</div></div>
              </div>
            </div>
          </div>
        </div>
        <div class="reg-marquee-row">
          <div class="reg-track reg-track--rev">
            <div v-for="r in [...row2, ...row2]" :key="r.name + r.handle + '2'" class="reg-card">
              <p class="reg-body">{{ r.body }}</p>
              <div class="reg-author">
                <div class="reg-av">{{ r.name[0] }}</div>
                <div><div class="reg-name">{{ r.name }}</div><div class="reg-handle">{{ r.handle }}</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="font-size:12px;color:rgba(200,200,216,0.35);">SenseWay™ © 2026 · Non-Profit</div>
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

<style scoped>
.reg-marquee-wrap {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 -48px;
}
.reg-fade-l, .reg-fade-r {
  position: absolute; top: 0; bottom: 0; width: 60px; z-index: 2; pointer-events: none;
}
.reg-fade-l { left: 0;  background: linear-gradient(to right, #18181b, transparent); }
.reg-fade-r { right: 0; background: linear-gradient(to left,  #18181b, transparent); }
.reg-marquee-row { overflow: hidden; }
.reg-track { display: flex; gap: 10px; width: max-content; }
.reg-track--fwd { animation: reg-fwd 36s linear infinite; }
.reg-track--rev { animation: reg-rev 40s linear infinite; }
.reg-track--fwd:hover, .reg-track--rev:hover { animation-play-state: paused; }
@keyframes reg-fwd { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes reg-rev { from { transform: translateX(-50%); } to { transform: translateX(0); } }
.reg-card {
  width: 200px; flex-shrink: 0;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 12px 14px;
}
.reg-body {
  font-size: 11px; color: rgba(200,200,216,0.7); line-height: 1.5; margin: 0 0 10px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.reg-author { display: flex; align-items: center; gap: 7px; }
.reg-av {
  width: 26px; height: 26px; border-radius: 50%;
  background: linear-gradient(135deg,#4f8ff7,#a855f7);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.reg-name { font-size: 10px; font-weight: 700; color: #e2e2f0; }
.reg-handle { font-size: 9px; color: rgba(200,200,216,0.4); }
</style>
