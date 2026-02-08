<script setup>
import { useDark } from '@vueuse/core'
import { RouterView, useRouter } from 'vue-router'
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BatteryCharging } from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'

const url = 'https://api.senseway.ca'

const isDark = useDark()  

const authStore = useAuthStore()
const router = useRouter()

const handleLogout = async () => {
  await authStore.logout()
  router.push({ name: 'home' })
}

const id = ref('c1987b12-3ffe-432a-ac13-4b06264409ed')

const map = ref(null)
const marker = ref(null)
const myIcon = L.icon({
  iconUrl: 'https://i.gyazo.com/2c2f86cbde1c24b59b380f1da714df48.png',
  iconSize: [38, 38],
  iconAnchor: [12, 15],
  popupAnchor: [-3, -76],
  shadowUrl: null,
  shadowSize: [68, 95],
  shadowAnchor: [22, 94],
})

const events = ref([])

const status = ref({
  id: 0,
  user_id: '',
  longitude: 0,
  latitude: 0,
  battery: 0,
  heart_rate: null,
  created_at: '',
})

const userInfo = ref({
  user_id: '',
  email: '',
  name: '',
  type: '',
  birth_date: '',
  home_long: 0,
  home_lat: 0,
  created_at: '',
  password: '',
})

const nearestPlace = ref({
  name: '',
  city: '',
  country: '',
  postcode: '',
})

const nearestPlaceLabel = computed(() => {
  const { name, city, country, postcode } = nearestPlace.value
  if (!name && !city && !country && !postcode) return ''

  // Build "Name, City, Country, POSTAL"
  return [name, city, country, postcode].filter(Boolean).join(', ')
})

async function fetchNearestPlace(lat, lon) {
  if (lat == null || lon == null) return

  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
    )

    if (!resp.ok) return

    const data = await resp.json()
    const address = data.address || {}

    nearestPlace.value = {
      name: data.name || address.building || address.amenity || address.shop || '',
      city: address.city || address.town || address.village || address.suburb || '',
      country: address.country || '',
      postcode: address.postcode || '',
    }
  } catch (e) {
    console.error('Failed to fetch nearest place:', e)
  }
}

const userAge = computed(() => {
  if (!userInfo.value.birth_date) return null
  const dob = new Date(userInfo.value.birth_date)
  if (Number.isNaN(dob.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
})

const batteryPercentage = computed(() => {
  const value = Number(status.value.battery)
  if (Number.isNaN(value) || value < 0) return 0
  if (value > 100) return 100
  return value
})

const isAlertEvent = (event) => {
  if (!event) return false

  const type = (event.type || '').toString().toLowerCase()
  const name = (event.name || '').toString().toLowerCase()

  return (
    type.includes('fall') || type.includes('sos') || name.includes('fall') || name.includes('sos')
  )
}

// avatar sizing with help of java
const avatarOffsetX = ref(-19)
const avatarOffsetY = ref(1.0)
const avatarScale = ref(1.07)

const batteryImage = computed(() => {
  const p = batteryPercentage.value
  // Lol next level coding - Battery Image Vals (Sail)
  if (p >= 90) return 'https://i.gyazo.com/d8f07b4c5caf5893defeee42c04484f6.png'
  if (p >= 80) return 'https://i.gyazo.com/640c65fca45a2c0eb65e9eafec43f636.png'
  if (p >= 70) return 'https://i.gyazo.com/1879fc61702ee3e90d1e10d620ccb366.png'
  if (p >= 60) return 'https://i.gyazo.com/911be89cf04aaa67fe96815c8c66e8e2.png'
  if (p >= 50) return 'https://i.gyazo.com/ff743192cab5d12bf688fc99a665c5ec.png'
  if (p >= 40) return 'https://i.gyazo.com/f21adce8288ccb2c90e2aeba63e4fbea.png'
  if (p >= 30) return 'https://i.gyazo.com/3477adab0848a4bc3bb8376963160303.png'
  if (p >= 20) return 'https://i.gyazo.com/3ed3d7e883949741fe58b6c4e59e4a5c.png'
  if (p >= 10) return 'https://i.gyazo.com/cb03b04add5f0b325df799f8b3e76cbf.png'
  return 'https://i.gyazo.com/fbab5c2c7805c1756e5d1afd1cdbdd59.png'
})

const batteryTextColor = computed(() => {
  const p = batteryPercentage.value

  // text colors lol
  if (p > 51) return 'rgba(54, 167, 81, 1)'
  if (p >= 10) return 'rgba(249, 186, 4, 1)'
  return 'rgba(229, 62, 55, 1)'
})

const heartImages = [
  'https://i.gyazo.com/7c390eaaf22543c97e2fec0524e27afa.png',
  'https://i.gyazo.com/ce05866c1ded35069062c8fe4bec1a0a.png',
]

// colors lol - edit only
const heartColors = [
  'rgb(255,150,144)',
  'rgb(255,142,136)',
  'rgb(255,134,128)',
  'rgb(255,127,120)',
  'rgb(255,119,112)',
  'rgb(255,111,104)',
  'rgb(255,103,95)',
  'rgb(255,96,87)',
  'rgb(255,88,79)',
  'rgb(255,80,71)',
  'rgb(255,72,63)',
  'rgb(255,65,55)',
  'rgb(255,57,46)',
  'rgb(255,49,38)',
  'rgb(255,41,30)',
  'rgb(255,34,22)',
  'rgb(255,26,14)',
  'rgb(255,18,6)',
  'rgb(252,12,0)',
  'rgb(244,12,0)',
  'rgb(236,11,0)',
  'rgb(228,11,0)',
  'rgb(220,11,0)',
  'rgb(212,10,0)',
  'rgb(204,10,0)',
  'rgb(195,9,0)',
  'rgb(187,9,0)',
  'rgb(179,9,0)',
]
const heartColorsGreen = [
  'rgb(178,213,178)',
  'rgb(147,196,147)',
  'rgb(173,210,173)',
  'rgb(141,193,141)',
  'rgb(168,208,168)',
  'rgb(136,190,136)',
  'rgb(162,205,162)',
  'rgb(131,188,131)',
  'rgb(157,202,157)',
  'rgb(125,185,125)',
  'rgb(152,199,152)',
  'rgb(120,182,120)',
  'rgb(115,179,115)',
  'rgb(86,159,86)',
  'rgb(110,176,110)',
  'rgb(83,153,83)',
  'rgb(104,173,104)',
  'rgb(80,148,80)',
  'rgb(99,170,99)',
  'rgb(78,143,78)',
  'rgb(94,167,94)',
  'rgb(75,138,75)',
  'rgb(89,164,89)',
  'rgb(72,132,72)',
  'rgb(69,127,69)',
  'rgb(66,122,66)',
  'rgb(63,116,63)',
  'rgb(60,111,60)',
  'rgb(57,106,57)',
  'rgb(55,100,55)',
]

const activeHeartColors = computed(() => {
  const hr = Number(status.value.heart_rate)

  if (Number.isNaN(hr)) return heartColors

  if (hr < 40 || hr > 140) return heartColors

  return heartColorsGreen
})

const currentHeartTextColorIndex = ref(0)
const currentHeartImageIndex = ref(0)
const currentHeartColorIndex = ref(0)

const currentHeartTextColor = computed(() => {
  const colors = activeHeartColors.value
  const len = colors.length || 1
  return colors[currentHeartTextColorIndex.value % len]
})

const currentHeartImage = computed(() => heartImages[currentHeartImageIndex.value])

const currentHeartColor = computed(() => {
  const colors = activeHeartColors.value
  const len = colors.length || 1
  return colors[currentHeartColorIndex.value % len]
})

let heartImageInterval = null
let heartColorInterval = null

onMounted(() => {
  heartImageInterval = setInterval(() => {
    currentHeartImageIndex.value = (currentHeartImageIndex.value + 1) % heartImages.length
  }, 300)

  heartColorInterval = setInterval(() => {
    const colors = activeHeartColors.value
    const len = colors.length || 1

    currentHeartColorIndex.value = (currentHeartColorIndex.value + 1) % len

    currentHeartTextColorIndex.value = (currentHeartTextColorIndex.value - 1 + len) % len
  }, 50)
})

onUnmounted(() => {
  clearInterval(heartImageInterval)
  clearInterval(heartColorInterval)
})

// sos stuffies
const alertColors = heartColors
const alertColorIndex = ref(0)

const currentAlertColor = computed(() => {
  return alertColors[alertColorIndex.value % alertColors.length]
})

let alertColorInterval = null

onMounted(() => {
  alertColorInterval = setInterval(() => {
    alertColorIndex.value = (alertColorIndex.value + 1) % alertColors.length
  }, 80)
})

onUnmounted(() => {
  clearInterval(alertColorInterval)
})

async function getUserInfo(newID) {
  try {
    const response = await fetch(`${url}/user?user_id=${newID}`)
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`)
    }

    userInfo.value = await response.json()

    console.log(userInfo.value)
  } catch (error) {
    console.error(error.message)
  }
}

async function getEvents(currentId) {
  if (!currentId) return
  try {
    const response = await fetch(`${url}/events?user_id=${currentId}&quantity=10`)
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`)
    }
    events.value = await response.json()

    events.value.forEach((element) => {
      if (element.type == 'Low_Battery') {
        element.type = 'Battery'
      }
    })
    console.log('Fetched Events:', events.value)
  } catch (error) {
    console.error('Failed to fetch events:', error.message)
  }
}

async function getStatus(currentId) {
  if (!currentId) return

  try {
    const response = await fetch(`${url}/status?user_id=${currentId}`)
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`)
    }

    status.value = await response.json()
    const lat = status.value.latitude
    const lon = status.value.longitude

    if (map.value) {
      map.value.setView([lat, lon])
      if (marker.value) {
        marker.value.setLatLng([lat, lon])
      } else {
        marker.value = L.marker([lat, lon], { icon: myIcon }).addTo(map.value)
      }
    } else {
      map.value = L.map('map').setView([lat, lon], 17)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: `
     <span style="color:#0078a8;">
        SenseWay © 2025
     </span>`,
      }).addTo(map.value)

      marker.value = L.marker([lat, lon], { icon: myIcon }).addTo(map.value)
    }

    fetchNearestPlace(lat, lon)

    console.log('Fetched Status:', status.value)
  } catch (error) {
    console.error('Failed to fetch status:', error.message)
  }
}

let dataInterval = null

watch(
  id,
  (newID) => {
    if (newID) {
      getUserInfo(newID)
      getEvents(newID)
      getStatus(newID)

      if (dataInterval) clearInterval(dataInterval)
      dataInterval = setInterval(() => {
        getEvents(newID)
        getStatus(newID)
      }, 3000)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (dataInterval) clearInterval(dataInterval)
})

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                           C O N C E P T :  S E N S E W A Y
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
</script>

<template>
  <!-- ======================== HEADER ======================== -->
  <header class="header-bar">
    <div class="header-inner">
      <!-- Left: Brand -->
      <div class="header-section header-brand">
        <img
          src="https://i.gyazo.com/5ebc3dc6c713fc1ae66bcc5d4704a0bd.png"
          class="brand-logo"
          alt="SenseWay logo"
        />
        <div class="brand-divider"></div>
        <div class="brand-text">
          <span class="brand-name">SenseWay<sup class="brand-tm">TM</sup> DEMO</span>
          <span class="brand-sub">Monitoring {{ userInfo.name || 'Unknown' }}'s Cane</span>
        </div>
      </div>

      <!-- Middle: Cane ID Input -->
      <div class="header-section header-input-section">
        <label class="input-label" for="cane-id">Cane User ID</label>
        <div class="input-wrapper">
          <input
            v-model="id"
            id="cane-id"
            type="text"
            placeholder="Enter cane user ID..."
            class="cane-input"
          />
          <span class="live-badge">
            <span class="live-dot"></span>
            LIVE
          </span>
        </div>
      </div>

      <!-- Right: User info + Logout -->
      <div class="header-section header-user">
        <div class="user-meta">
          <div class="meta-item">
            <span class="meta-label">Age</span>
            <span class="meta-value">{{ userAge ?? '--' }}</span>
          </div>
          <div class="meta-divider"></div>
          <div class="meta-item meta-premium">
            <img
              src="https://i.gyazo.com/d40ab0225c23f165f4ac8422315ebbb6.png"
              alt="Premium"
              class="premium-icon"
            />
            <div>
              <span class="meta-label">Status</span>
              <span class="meta-value premium-text">Premium</span>
            </div>
          </div>
        </div>
        <div class="user-profile">
          <div class="avatar-ring">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="avatar-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
              <path d="M4 20a8 8 0 0 1 16 0" />
            </svg>
          </div>
          <div class="user-greeting">
            <span class="greeting-sub">Welcome back,</span>
            <span class="greeting-name">{{ userInfo.name || 'John Doe' }}</span>
          </div>
          <button @click="handleLogout" class="logout-btn">
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- ======================== MAIN ======================== -->
  <main class="dashboard-main">
    <!-- Accent bar -->
    <div class="accent-bar"></div>

    <div class="dashboard-grid">
      <!-- ======== LEFT: Map ======== -->
      <section class="panel panel-map">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Live Cane Location</h2>
            <p v-if="nearestPlaceLabel" class="panel-subtitle">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              {{ nearestPlaceLabel }}
            </p>
          </div>
          <span class="panel-badge panel-badge--live">
            <span class="live-dot"></span>
            Real-time
          </span>
        </div>
        <div id="map" class="map-container"></div>
      </section>

      <!-- ======== RIGHT: Metrics + Events ======== -->
      <div class="right-column">
        <!-- Metric cards row -->
        <div class="metrics-row">
          <!-- Battery Card -->
          <div class="metric-card">
            <div class="metric-card-label">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>
              Battery
            </div>
            <div class="metric-visual battery-visual">
              <img
                :src="batteryImage"
                alt="Battery"
                class="battery-img"
              />
              <div
                class="battery-overlay"
                :style="{
                  color: batteryTextColor,
                }"
              >
                {{ batteryPercentage }}%
              </div>
            </div>
          </div>

          <!-- Heart Rate Card -->
          <div class="metric-card">
            <div class="metric-card-label">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              Heart Rate
            </div>
            <div class="metric-visual heart-visual">
              <div
                class="heart-glow"
                :style="{
                  backgroundColor: currentHeartColor,
                }"
              ></div>
              <img
                :src="currentHeartImage"
                alt="Heart"
                class="heart-img"
              />
              <div
                class="heart-overlay"
                :style="{
                  color: currentHeartTextColor,
                }"
              >
                {{ status.heart_rate || 'N/A' }}<span v-if="status.heart_rate" class="heart-unit"> bpm</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Events Panel -->
        <section class="panel panel-events">
          <div class="panel-header">
            <h2 class="panel-title">Events Feed</h2>
            <span v-if="events.length" class="event-count">
              {{ events.length }} recent
            </span>
          </div>

          <!-- Empty state -->
          <div v-if="!events.length" class="events-empty">
            <p class="events-empty-text">No recent events for this user.</p>

            <div class="user-info-grid">
              <div class="info-item">
                <span class="info-label">Name</span>
                <span class="info-value">{{ userInfo.name || '--' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">{{ userInfo.email || '--' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Type</span>
                <span class="info-value">{{ userInfo.type || '--' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Birth date</span>
                <span class="info-value">{{ userInfo.birth_date || '--' }}</span>
              </div>
            </div>
          </div>

          <!-- Events table -->
          <div v-else class="events-table-wrapper">
            <table class="events-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="event in events"
                  :key="event.id"
                >
                  <td class="event-name">{{ event.name }}</td>
                  <td>
                    <span
                      :class="[
                        'type-badge',
                        isAlertEvent(event) ? 'type-badge--alert' : 'type-badge--ok',
                      ]"
                      :style="
                        isAlertEvent(event)
                          ? {
                              backgroundColor: currentAlertColor,
                              transition: 'background-color 90ms linear',
                            }
                          : {}
                      "
                    >
                      {{ event.type }}
                    </span>
                  </td>
                  <td class="event-desc">{{ event.description }}</td>
                  <td class="event-time">{{ new Date(event.created_at).toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </main>

  <!-- ======================== FOOTER ======================== -->
  <footer class="site-footer">
    <p>SenseWay &copy; 2025 All Rights Reserved &middot; Non Profit Organization</p>
  </footer>
</template>

<style scoped>
/* ========================================================
   DESIGN TOKENS (scoped vars)
   ======================================================== */
:root {
  --sw-bg: #0a0a0f;
  --sw-surface: #111118;
  --sw-surface-hover: #18181f;
  --sw-border: rgba(255, 255, 255, 0.06);
  --sw-border-strong: rgba(255, 255, 255, 0.1);
  --sw-text: #f0f0f5;
  --sw-text-secondary: #8b8b9e;
  --sw-text-muted: #5a5a6e;
  --sw-accent: #3b82f6;
  --sw-accent-dim: rgba(59, 130, 246, 0.15);
  --sw-radius: 16px;
  --sw-radius-sm: 10px;
  --sw-radius-xs: 6px;
}

/* ========================================================
   HEADER
   ======================================================== */
.header-bar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(10, 10, 15, 0.82);
  backdrop-filter: blur(20px) saturate(1.4);
  border-bottom: 1px solid var(--sw-border);
}

.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.header-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  background: var(--sw-surface);
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-radius-sm);
}

.header-brand {
  flex: 1;
  min-width: 240px;
}

.brand-logo {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.brand-divider {
  width: 1px;
  height: 28px;
  background: var(--sw-border-strong);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--sw-text);
  letter-spacing: 0.02em;
}

.brand-tm {
  font-size: 9px;
  vertical-align: super;
  color: var(--sw-text-muted);
}

.brand-sub {
  font-size: 11px;
  color: var(--sw-text-secondary);
}

/* Header input */
.header-input-section {
  flex: 1;
  min-width: 280px;
  gap: 10px;
}

.input-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--sw-text-secondary);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.cane-input {
  flex: 1;
  background: var(--sw-bg);
  border: 1px solid var(--sw-border-strong);
  border-radius: var(--sw-radius-xs);
  padding: 7px 12px;
  font-size: 13px;
  color: var(--sw-text);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.cane-input::placeholder {
  color: var(--sw-text-muted);
}

.cane-input:focus {
  border-color: var(--sw-accent);
  box-shadow: 0 0 0 3px var(--sw-accent-dim);
}

.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 100px;
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse-dot 1.4s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

/* Header user */
.header-user {
  flex: 1.1;
  min-width: 300px;
  justify-content: space-between;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 14px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.meta-premium {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.meta-premium > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.meta-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--sw-text-muted);
}

.meta-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--sw-text);
}

.premium-text {
  color: #fbbf24 !important;
}

.premium-icon {
  height: 18px;
  width: auto;
}

.meta-divider {
  width: 1px;
  height: 24px;
  background: var(--sw-border-strong);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar-ring {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid var(--sw-border-strong);
  background: var(--sw-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-icon {
  width: 16px;
  height: 16px;
  color: var(--sw-text-secondary);
}

.user-greeting {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.greeting-sub {
  font-size: 10px;
  color: var(--sw-text-muted);
}

.greeting-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--sw-text);
}

.logout-btn {
  margin-left: 6px;
  padding: 6px 14px;
  border-radius: var(--sw-radius-xs);
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

/* ========================================================
   MAIN DASHBOARD
   ======================================================== */
.dashboard-main {
  padding: 20px 24px 80px;
  max-width: 1400px;
  margin: 0 auto;
}

.accent-bar {
  height: 3px;
  border-radius: 100px;
  background: linear-gradient(90deg, var(--sw-accent) 0%, transparent 100%);
  margin-bottom: 20px;
  opacity: 0.6;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

/* ========================================================
   PANELS (shared)
   ======================================================== */
.panel {
  background: var(--sw-surface);
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-radius);
  padding: 24px;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--sw-text);
  margin: 0;
}

.panel-subtitle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--sw-text-secondary);
  margin-top: 4px;
}

.inline-icon {
  color: var(--sw-accent);
  flex-shrink: 0;
}

.panel-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.panel-badge--live {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

/* ========================================================
   MAP
   ======================================================== */
.panel-map {
  min-height: 520px;
  display: flex;
  flex-direction: column;
}

.map-container {
  flex: 1;
  min-height: 420px;
  border-radius: var(--sw-radius-sm);
  overflow: hidden;
  border: 1px solid var(--sw-border);
}

/* ========================================================
   RIGHT COLUMN
   ======================================================== */
.right-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ========================================================
   METRIC CARDS
   ======================================================== */
.metrics-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.metric-card {
  background: var(--sw-surface);
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.metric-card-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--sw-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 12px;
}

.metric-card-label svg {
  color: var(--sw-text-muted);
}

.metric-visual {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: var(--sw-radius-sm);
  overflow: hidden;
  background: var(--sw-bg);
}

/* Battery */
.battery-visual {
  /* no extra styles needed */
}

.battery-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.95;
  pointer-events: none;
}

.battery-overlay {
  position: absolute;
  z-index: 10;
  top: 7%;
  left: 49.2%;
  transform: translateX(-50%);
  font-size: 48px;
  font-weight: 700;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.9));
}

/* Heart */
.heart-glow {
  position: absolute;
  width: 80%;
  height: 80%;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.6;
}

.heart-img {
  position: relative;
  z-index: 10;
  width: 65%;
  height: 65%;
  object-fit: contain;
  pointer-events: none;
}

.heart-overlay {
  position: absolute;
  z-index: 20;
  top: 25%;
  left: 50%;
  transform: translateX(-50%);
  font-size: 34px;
  font-weight: 700;
  text-align: center;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.95));
  white-space: nowrap;
}

.heart-unit {
  font-size: 16px;
  font-weight: 500;
  opacity: 0.8;
}

/* ========================================================
   EVENTS PANEL
   ======================================================== */
.panel-events {
  flex: 1;
  min-height: 320px;
}

.event-count {
  font-size: 12px;
  color: var(--sw-text-muted);
  background: var(--sw-bg);
  padding: 4px 10px;
  border-radius: 100px;
  border: 1px solid var(--sw-border);
}

/* Empty state */
.events-empty {
  padding-top: 8px;
}

.events-empty-text {
  font-size: 13px;
  color: var(--sw-text-secondary);
  margin-bottom: 20px;
}

.user-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--sw-text-muted);
  font-weight: 600;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--sw-text);
}

/* Events table */
.events-table-wrapper {
  border-radius: var(--sw-radius-sm);
  border: 1px solid var(--sw-border);
  overflow: hidden;
  background: var(--sw-bg);
}

.events-table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}

.events-table thead {
  background: rgba(255, 255, 255, 0.02);
}

.events-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--sw-text-muted);
  border-bottom: 1px solid var(--sw-border);
}

.events-table tbody tr {
  border-top: 1px solid var(--sw-border);
  transition: background 0.15s;
}

.events-table tbody tr:first-child {
  border-top: none;
}

.events-table tbody tr:hover {
  background: var(--sw-surface-hover);
}

.events-table td {
  padding: 10px 14px;
}

.event-name {
  font-weight: 600;
  color: var(--sw-text);
}

.event-desc {
  color: var(--sw-text-secondary);
}

.event-time {
  font-size: 11px;
  color: var(--sw-text-muted);
  white-space: nowrap;
}

/* Type badges */
.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 600;
}

.type-badge--ok {
  background: rgba(16, 185, 129, 0.1);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.type-badge--alert {
  color: #fff;
  border: 1px solid rgba(239, 68, 68, 0.5);
}

/* ========================================================
   FOOTER
   ======================================================== */
.site-footer {
  position: fixed;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 700px;
  text-align: center;
  font-size: 12px;
  color: var(--sw-text-muted);
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid var(--sw-border);
  border-radius: 100px;
  padding: 10px 20px;
}

.site-footer p {
  margin: 0;
}

/* ========================================================
   MAP OVERRIDE (Leaflet)
   ======================================================== */
#map {
  height: 100%;
}

/* ========================================================
   RESPONSIVE
   ======================================================== */
@media (max-width: 768px) {
  .header-inner {
    flex-direction: column;
  }

  .header-section {
    width: 100%;
  }

  .header-user {
    flex-wrap: wrap;
  }

  .metrics-row {
    grid-template-columns: 1fr 1fr;
  }

  .battery-overlay {
    font-size: 36px;
  }

  .heart-overlay {
    font-size: 26px;
  }

  .dashboard-main {
    padding: 16px 12px 80px;
  }
}
</style>
