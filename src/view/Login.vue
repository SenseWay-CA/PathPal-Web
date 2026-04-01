<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import FlipWords from '@/components/FlipWords.vue'

const REVIEWS = [
  { name: 'Xiu Xiu',            handle: 'San Jose, CA',      body: 'My father kept on falling into the toilet, this life saving cane has kept him on his feet.' },
  { name: 'Priya Sharma',       handle: 'Toronto, ON',      body: 'My father uses the smart cane every day. The real-time alerts give our whole family peace of mind. A true life saver.' },
  { name: 'August Zhang',       handle: 'Richmond Hill, ON', body: 'My grandfather was hesitant about technology but SenseWay changed everything. We helped him set it up in minutes and now he loves his independence.' },
  { name: 'Fatima Malik',       handle: 'Brampton, ON',     body: 'As a caregiver I can monitor my patients remotely. The geofencing zones are so smart and easy to set up.' },
  { name: 'Gordan Freeman',     handle: 'Pheonix, AZ',      body: 'My old man would sneak out at night into the desert. He would strip naked and just wander for hours. This device malfunctioned and blew up his legs, I guess our problem was solved' },
  { name: 'Sarah Mitchell',     handle: 'Vancouver, BC',    body: 'Bought this for my dad after his hip surgery. The location tracking means I can stop worrying and he can feel free again.' },
  { name: 'Kavya Jayasinghe',   handle: 'Scarborough, ON',  body: 'My aththamma uses this cane every morning walk. The SOS button gave us so much peace of mind — worth every penny.' },
  { name: 'Ravi Krishnamurthy', handle: 'Ottawa, ON',       body: 'We gifted this to my amma and she loves it. Knowing her location always gives the family so much comfort.' },
  { name: 'Wei-Lin Chen',       handle: 'Markham, ON',      body: 'I recommended SenseWay to three other families in our community. The geofencing alerts are incredibly reliable.' },
  { name: 'Eli Vance',          handle: 'Seatle, WA',       body: 'My mother’s cataracts got so bad she started treating the neighborhood like a horror movie. She would come home trembling about giant hovering red and yellow monsters lurking on every corner. We almost called an exorcist before realizing she was just picking a fight with the local street signs. This cane’s haptic feedback and obstacle detection helped her realize that the Yellow Blob was not an alien. It was just a Yield sign. Now she navigates the sidewalk without trying to pepper spray the infrastructure.'},
  { name: 'Emma Thompson',      handle: 'Calgary, AB',      body: 'Simple, reliable, life-changing. Dad has more confidence on his walks and I have less anxiety. Can\'t ask for more.' },
  { name: 'Niroshan Perera',    handle: 'Etobicoke, ON',    body: 'Thaaththaa was afraid of falling alone. With SenseWay I check on him every day from my phone — it truly changed our family\'s life.' },
  { name: 'Gurpreet Singh',     handle: 'Surrey, BC',       body: 'My nana was skeptical at first but now refuses to go anywhere without it. The app is very simple to use.' },
  { name: 'Liang Wei',          handle: 'Burnaby, BC',      body: 'The heart rate monitoring and location history features are outstanding. My mother walks daily now with full confidence.' },
  { name: 'Meera Chandran',     handle: 'Hamilton, ON',     body: 'As a doctor I recommend SenseWay to every elderly patient\'s family. The health monitoring is first-class.' },
  { name: 'James O\'Brien',     handle: 'Halifax, NS',      body: 'Set up took under 10 minutes. The battery life is amazing and the alerts are instant. My mum loves her independence back.' },
  { name: 'Dilrukshi Wijesinghe', handle: 'Mississauga, ON', body: 'After amma\'s stroke we were so worried. SenseWay gave us real-time safety and her the freedom she deserved.' },
  { name: 'Ananya Venkatesh',   handle: 'Brampton, ON',     body: 'We set up safety zones around the neighbourhood. The instant geofence alerts are a game changer for our family.' },
  { name: 'Michael Clarke',     handle: 'Toronto, ON',      body: 'Clean design, rock-solid reliability. The SOS feature gave my father confidence to walk on his own again.' },
  { name: 'Xiao-Ming Liu',      handle: 'Scarborough, ON',  body: 'Yéye walks to the park every morning and we track him in real time. SenseWay is essential for our family.' },
]
const row1 = REVIEWS.slice(0, 9)
const row2 = REVIEWS.slice(9)

const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const rememberMe = ref(false)
const loading = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('sw_remember_email')
  if (saved) {
    email.value = saved
    rememberMe.value = true
  }
})

const handleLogin = async () => {
  error.value = ''
  loading.value = true
  if (rememberMe.value) {
    localStorage.setItem('sw_remember_email', email.value)
  } else {
    localStorage.removeItem('sw_remember_email')
  }
  const result = await authStore.login(email.value, password.value)
  loading.value = false
  if (result.success) {
    router.push({ name: 'app' })
  } else {
    error.value = result.error || 'Login failed. Please check your credentials.'
  }
}
</script>

<template>
  <div class="login-root">
    <!-- left panel -->
    <div class="login-left">
      <div class="login-left-top">
        <img src="https://i.gyazo.com/465fb186323ea1edccb73b28fb4b8bd4.png" class="brand-logo" alt="SenseWay" />
        <span class="brand-name">SenseWay</span>
      </div>
      <div class="hero-text">
        Surrender your
        <FlipWords :words="['steps.', 'moves.', 'data.', 'trail.', 'location.']" :duration="2800" /><br />
        Obey the
        <FlipWords :words="['algorithm.', 'system.', 'machine.', 'network.', 'AI.']" :duration="3100" /><br />
        We know where<br />
        <FlipWords :words="[`you're going.`, 'you live.', 'you sleep.', 'you wander.', 'you hide.']" :duration="3400" />
      </div>

      <!-- testimonial marquee -->
      <div class="marquee-section">
        <div class="marquee-fade-left"></div>
        <div class="marquee-fade-right"></div>
        <div class="marquee-row">
          <div class="marquee-track marquee-track--fwd">
            <div v-for="r in [...row1, ...row1]" :key="r.name + r.handle" class="review-card">
              <p class="review-body">{{ r.body }}</p>
              <div class="review-author">
                <div class="review-avatar">{{ r.name[0] }}</div>
                <div>
                  <div class="review-name">{{ r.name }}</div>
                  <div class="review-handle">{{ r.handle }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="marquee-row">
          <div class="marquee-track marquee-track--rev">
            <div v-for="r in [...row2, ...row2]" :key="r.name + r.handle + '2'" class="review-card">
              <p class="review-body">{{ r.body }}</p>
              <div class="review-author">
                <div class="review-avatar">{{ r.name[0] }}</div>
                <div>
                  <div class="review-name">{{ r.name }}</div>
                  <div class="review-handle">{{ r.handle }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="login-left-foot">SenseWay™ © 2026 · Non-Profit</div>
    </div>

    <!-- right panel -->
    <div class="login-right">
      <div class="login-card">
        <div class="login-card-head">
          <img src="https://i.gyazo.com/465fb186323ea1edccb73b28fb4b8bd4.png" class="card-logo" alt="SenseWay" />
          <h1 class="card-title">Welcome Back</h1>
          <p class="card-sub">Sign in to your SenseWay account</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="field-group">
            <label class="field-label">Email Address</label>
            <div class="input-wrap">
              <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <input
                id="login-email"
                type="email"
                v-model="email"
                class="field-input"
                placeholder="Enter your email"
                required
                autocomplete="email"
              />
            </div>
          </div>

          <div class="field-group">
            <div class="field-label-row">
              <label class="field-label">Password</label>
              <a href="#" class="forgot-link">Forgot password?</a>
            </div>
            <div class="input-wrap">
              <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input
                id="login-password"
                type="password"
                v-model="password"
                class="field-input"
                placeholder="Enter your password"
                required
                autocomplete="current-password"
              />
            </div>
          </div>

          <!-- remember me -->
          <label class="remember-row">
            <input type="checkbox" v-model="rememberMe" class="remember-check" />
            <span class="remember-label">Remember my email</span>
          </label>

          <button type="submit" class="login-btn" :disabled="loading">
            <span v-if="!loading">Sign In</span>
            <span v-else class="btn-loading">
              <svg class="spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Signing in...
            </span>
          </button>

          <p v-if="error" class="login-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            {{ error }}
          </p>
        </form>

        <div class="login-footer">
          Don't have an account?
          <button class="link-btn" @click="router.push({ name: 'register' })">Sign up</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-root {
  display: flex;
  min-height: 100vh;
  background: #07070f;
  color: #ffffff;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* ── left panel ── */
.login-left {
  flex: 1;
  background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(79,143,247,0.07) 0%, transparent 70%), #060610;
  border-right: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px 48px;
  overflow: hidden;
  min-width: 0;
}

@media (max-width: 900px) {
  .login-left { display: none; }
}

.login-left-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba(79,143,247,0.5));
}

.brand-name {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(90deg, #4f8ff7, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-text {
  font-size: 46px;
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: #ffffff;
}

.login-left-foot {
  font-size: 12px;
  color: rgba(200,200,216,0.4);
}

/* ── right panel ── */
.login-right {
  width: 480px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

@media (max-width: 900px) {
  .login-right { width: 100%; }
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: rgba(11, 11, 24, 0.92);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 28px;
  padding: 36px 32px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05) inset;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.login-card:hover {
  border-color: rgba(79,143,247,0.15);
  box-shadow: 0 32px 80px rgba(0,0,0,0.55), 0 0 40px rgba(79,143,247,0.06), 0 1px 0 rgba(255,255,255,0.05) inset;
}

.login-card-head {
  text-align: center;
  margin-bottom: 28px;
}

.card-logo {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: contain;
  margin-bottom: 14px;
  filter: drop-shadow(0 0 14px rgba(79,143,247,0.5));
  animation: logo-float 3s ease-in-out infinite;
}

@keyframes logo-float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-4px); }
}

.card-title {
  font-size: 24px;
  font-weight: 800;
  color: #ffffff;
  margin: 0 0 6px;
  letter-spacing: -0.02em;
}

.card-sub {
  font-size: 13px;
  color: #c8c8d8;
  margin: 0;
}

/* ── form ── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: #c8c8d8;
  letter-spacing: 0.03em;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.forgot-link {
  font-size: 12px;
  color: #4f8ff7;
  text-decoration: none;
}
.forgot-link:hover { text-decoration: underline; }

.input-wrap {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(200,200,216,0.4);
  pointer-events: none;
}

.field-input {
  width: 100%;
  padding: 12px 14px 12px 40px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  color: #ffffff;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: rgba(79,143,247,0.6);
  background: rgba(79,143,247,0.05);
  box-shadow: 0 0 0 3px rgba(79,143,247,0.1);
}

.field-input::placeholder {
  color: rgba(200,200,216,0.35);
}

/* ── remember me ── */
.remember-row {
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
}

.remember-check {
  width: 16px;
  height: 16px;
  accent-color: #4f8ff7;
  cursor: pointer;
}

.remember-label {
  font-size: 13px;
  color: #c8c8d8;
}

/* ── submit button ── */
.login-btn {
  width: 100%;
  padding: 13px;
  background: linear-gradient(135deg, #4f8ff7 0%, #6366f1 100%);
  color: #ffffff;
  border: none;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 18px rgba(79,143,247,0.3);
}

.login-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
  transform: translateX(-100%);
  transition: transform 0.5s ease;
}

.login-btn:hover:not(:disabled)::after {
  transform: translateX(100%);
}

.login-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #6aa3ff 0%, #7577ff 100%);
  box-shadow: 0 6px 28px rgba(79,143,247,0.45);
  transform: translateY(-1px);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(79,143,247,0.3);
}

.login-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.spin {
  animation: spin 0.9s linear infinite;
}

/* ── error ── */
.login-error {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 14px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 10px;
  color: #f87171;
  font-size: 13px;
  margin: 0;
}

/* ── footer ── */
.login-footer {
  margin-top: 22px;
  text-align: center;
  font-size: 13px;
  color: #c8c8d8;
}

.link-btn {
  background: none;
  border: none;
  color: #4f8ff7;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-left: 4px;
}
.link-btn:hover { text-decoration: underline; }

/* ── testimonial marquee ── */
.marquee-section {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 24px -48px;
  padding: 0 0;
}
.marquee-fade-left,
.marquee-fade-right {
  position: absolute;
  top: 0; bottom: 0;
  width: 80px;
  z-index: 2;
  pointer-events: none;
}
.marquee-fade-left  { left: 0;  background: linear-gradient(to right, #060610, transparent); }
.marquee-fade-right { right: 0; background: linear-gradient(to left, #060610, transparent); }

.marquee-row { overflow: hidden; }

.marquee-track {
  display: flex;
  gap: 12px;
  width: max-content;
}
.marquee-track--fwd { animation: marquee-fwd 38s linear infinite; }
.marquee-track--rev { animation: marquee-rev 42s linear infinite; }
.marquee-track--fwd:hover,
.marquee-track--rev:hover { animation-play-state: paused; }

@keyframes marquee-fwd {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes marquee-rev {
  from { transform: translateX(-50%); }
  to   { transform: translateX(0); }
}

.review-card {
  width: 230px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 18px;
  padding: 15px 17px;
  transition: border-color 0.25s, transform 0.2s, background 0.2s;
  backdrop-filter: blur(8px);
}
.review-card:hover {
  border-color: rgba(79,143,247,0.22);
  background: rgba(79,143,247,0.04);
  transform: translateY(-2px);
}
.review-body {
  font-size: 12px;
  color: rgba(200,200,216,0.75);
  line-height: 1.55;
  margin: 0 0 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.review-author {
  display: flex;
  align-items: center;
  gap: 8px;
}
.review-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f8ff7, #a855f7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.review-name {
  font-size: 11px;
  font-weight: 700;
  color: #e2e2f0;
}
.review-handle {
  font-size: 10px;
  color: rgba(200,200,216,0.45);
}
</style>
