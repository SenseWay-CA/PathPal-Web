<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
        Surrender your steps.<br />
        Obey the algorithm.<br />
        We know where<br />
        you're going.
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
  background: #080810;
  color: #ffffff;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* ── left panel ── */
.login-left {
  flex: 1;
  background: #060610;
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px 48px;
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
  background: #0e0e18;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 24px;
  padding: 36px 32px;
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
  padding: 11px 14px 11px 38px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  color: #ffffff;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: #4f8ff7;
  background: rgba(79,143,247,0.06);
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
  padding: 12px;
  background: #4f8ff7;
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s, opacity 0.15s;
  font-family: inherit;
}

.login-btn:hover:not(:disabled) {
  background: #3d7fe6;
  transform: translateY(-1px);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.6;
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
</style>
