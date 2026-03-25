<script setup>
import { useRouter } from 'vue-router'
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  listGeofences,
  createGeofence,
  updateGeofence as updateGeofenceApi,
  deleteGeofence as deleteGeofenceApi,
} from '@/services/geofenceApi'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                           C O N C E P T :  S E N S E W A Y
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    app core

const url = 'https://api.senseway.ca'
const authStore = useAuthStore()
const router = useRouter()

const handleLogout = async () => {
  await authStore.logout()
  router.push({ name: 'home' })
}

// user id from auth store
const id = computed(() => authStore.user?.user_id || '')

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    navigation / tabs

const activeTab = ref('dashboard')

const pageTitle = computed(() => {
  if (activeTab.value === 'dashboard') return 'Dashboard'
  if (activeTab.value === 'geofence') return 'Safety Zones'
  if (activeTab.value === 'settings') return 'Settings'
  return 'SenseWay'
})

function setTab(tab) {
  activeTab.value = tab
  nextTick(() => {
    // fix leaflet tile rendering after tabs become visible
    if (tab === 'geofence' && map.value) {
      map.value.invalidateSize()
      renderGeofencesOnMap()
    }
    if (tab === 'dashboard' && mapMini.value) {
      mapMini.value.invalidateSize()
    }
  })
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    map instances

const map = ref(null)
const marker = ref(null)
const mapMini = ref(null)
const miniMarker = ref(null)

// custom marker persisted in localstorage
const customMarkerUrl = ref(localStorage.getItem('sw_custom_marker') || '')

function buildIcon(url) {
  return L.icon({
    iconUrl: url || 'https://i.gyazo.com/2c2f86cbde1c24b59b380f1da714df48.png',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -24],
    shadowUrl: null,
  })
}

// update both map markers when custom icon changes
watch(customMarkerUrl, (newUrl) => {
  const icon = buildIcon(newUrl)
  if (marker.value) marker.value.setIcon(icon)
  if (miniMarker.value) miniMarker.value.setIcon(icon)
})

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    status / events / user data

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

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    geofence state

const geofenceMarker = ref(null)
const geofenceCircle = ref(null)
const geofenceRadius = ref(100)
const geofenceName = ref('Geofence')
const geofence = ref(null)
const geofences = ref([])
const geofenceLayers = new Map()
const selectedGeofenceId = ref(null)
const geofenceLoading = ref(false)
const geofenceSaving = ref(false)
const geofenceDeleting = ref(false)
const geofenceSaveMessage = ref('')
const geofenceSaveMessageType = ref('')

let geofenceMessageTimer = null

function showGeofenceMessage(msg, type) {
  geofenceSaveMessage.value = msg
  geofenceSaveMessageType.value = type
  if (geofenceMessageTimer) clearTimeout(geofenceMessageTimer)
  if (type === 'success') {
    geofenceMessageTimer = setTimeout(() => {
      geofenceSaveMessage.value = ''
      geofenceSaveMessageType.value = ''
    }, 4000)
  }
}

// clamp radius between 50m and 5km
watch(geofenceRadius, (v) => {
  if (v < 50) geofenceRadius.value = 50
  else if (v > 5000) geofenceRadius.value = 5000
})

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    reverse geocoding

const nearestPlace = ref({
  name: '', road: '', building: '', neighbourhood: '',
  city: '', state: '', country: '', postcode: '',
})

const nearestPlaceLabel = computed(() => {
  const { name, city, country } = nearestPlace.value
  return [name, city, country].filter(Boolean).join(', ')
})

// short label for topbar chip
const locationShort = computed(() => {
  const { city, country } = nearestPlace.value
  return [city, country].filter(Boolean).join(', ')
})

// iso country code badge (more reliable than emoji on windows)
const countryCode = computed(() => {
  const c = (nearestPlace.value.country || '').toLowerCase()
  if (c.includes('canada'))        return { code: 'CA', color: '#d52b1e' }
  if (c.includes('united states') || c.includes('usa')) return { code: 'US', color: '#3c3b6e' }
  if (c.includes('mexico'))        return { code: 'MX', color: '#006847' }
  if (c.includes('cuba'))          return { code: 'CU', color: '#002a8f' }
  if (c.includes('bahamas'))       return { code: 'BS', color: '#00778b' }
  if (c.includes('jamaica'))       return { code: 'JM', color: '#000000' }
  if (c.includes('haiti'))         return { code: 'HT', color: '#00209f' }
  if (c.includes('dominican'))     return { code: 'DO', color: '#002d62' }
  if (c.includes('puerto rico'))   return { code: 'PR', color: '#ed0000' }
  if (c.includes('greenland'))     return { code: 'GL', color: '#003f87' }
  if (c.includes('belize'))        return { code: 'BZ', color: '#003f87' }
  if (c.includes('guatemala'))     return { code: 'GT', color: '#4997d0' }
  return null
})

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    weather + location details

const weatherData = ref({
  temp: null, code: null, wind: null,
  humidity: null, precipitation: null, elevation: null,
})

// wmo weather code → human label
function wmoLabel(code) {
  if (code === 0)               return 'Clear Sky'
  if (code <= 3)                return 'Partly Cloudy'
  if (code <= 48)               return 'Foggy'
  if (code === 51 || code === 53) return 'Light Drizzle'
  if (code === 55)              return 'Dense Drizzle'
  if (code === 61 || code === 63) return 'Rain'
  if (code === 65)              return 'Heavy Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code === 80 || code === 81) return 'Rain Showers'
  if (code === 82)              return 'Heavy Showers'
  if (code >= 85 && code <= 86) return 'Snow Showers'
  if (code >= 95)               return 'Thunderstorm'
  return 'Unknown'
}

const weatherLabel = computed(() => {
  const c = weatherData.value.code
  return c != null ? wmoLabel(c) : null
})

// pavement/safety condition derived from weather code
const pavementCondition = computed(() => {
  const c = weatherData.value.code
  if (c == null) return null
  if (c === 0 || c <= 3)         return { label: 'Dry — Safe', level: 'ok' }
  if (c <= 48)                    return { label: 'Fog — Low Visibility', level: 'warn' }
  if (c <= 55)                    return { label: 'Wet — Light Drizzle', level: 'warn' }
  if (c <= 65)                    return { label: 'Wet & Slippery', level: 'danger' }
  if (c <= 77 || (c >= 85 && c <= 86)) return { label: 'Icy / Snowy — Very Slippery', level: 'danger' }
  if (c >= 95)                    return { label: 'Storm — Stay Indoors', level: 'danger' }
  return { label: 'Caution Advised', level: 'warn' }
})

let lastWeatherFetch = 0

async function fetchWeather(lat, lon) {
  // throttle to once per 90 seconds
  if (Date.now() - lastWeatherFetch < 90000) return
  lastWeatherFetch = Date.now()
  try {
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&forecast_days=1&timezone=auto`,
    )
    if (!resp.ok) return
    const data = await resp.json()
    const cur = data.current || {}
    weatherData.value = {
      temp:          cur.temperature_2m         ?? null,
      code:          cur.weather_code           ?? null,
      wind:          cur.wind_speed_10m         ?? null,
      humidity:      cur.relative_humidity_2m   ?? null,
      precipitation: cur.precipitation          ?? null,
      elevation:     data.elevation != null ? Math.round(data.elevation) : null,
    }
  } catch (e) {
    console.error('weather fetch failed:', e)
  }
}

let lastGeocodeFetch = 0

async function fetchNearestPlace(lat, lon) {
  if (lat == null || lon == null) return
  // throttle geocoding to once per 10 seconds
  if (Date.now() - lastGeocodeFetch < 10000) return
  lastGeocodeFetch = Date.now()
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
    )
    if (!resp.ok) return
    const data = await resp.json()
    const a = data.address || {}
    nearestPlace.value = {
      name:          data.name || a.amenity || a.shop || a.leisure || a.tourism || '',
      building:      a.building || (a.house_number ? a.house_number : '') || '',
      road:          a.road || a.pedestrian || a.path || a.footway || '',
      neighbourhood: a.neighbourhood || a.quarter || '',
      city:          a.city || a.town || a.village || a.suburb || '',
      state:         a.state || a.province || a.region || '',
      country:       a.country || '',
      postcode:      a.postcode || '',
    }
  } catch (e) {
    console.error('reverse geocode failed:', e)
  }
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    computed vitals

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
  const v = Number(status.value.battery)
  if (Number.isNaN(v) || v < 0) return 0
  return Math.min(v, 100)
})

const batteryImage = computed(() => {
  const p = batteryPercentage.value
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
  if (p > 51) return '#4ade80'
  if (p >= 10) return '#fbbf24'
  return '#f87171'
})

const isAlertEvent = (event) => {
  if (!event) return false
  const type = (event.type || '').toLowerCase()
  const name = (event.name || '').toLowerCase()
  return type.includes('fall') || type.includes('sos') || name.includes('fall') || name.includes('sos')
}

const heartImages = [
  'https://i.gyazo.com/7c390eaaf22543c97e2fec0524e27afa.png',
  'https://i.gyazo.com/ce05866c1ded35069062c8fe4bec1a0a.png',
]

const heartColors = [
  'rgb(255,150,144)', 'rgb(255,142,136)', 'rgb(255,134,128)', 'rgb(255,127,120)',
  'rgb(255,119,112)', 'rgb(255,111,104)', 'rgb(255,103,95)', 'rgb(255,96,87)',
  'rgb(255,88,79)', 'rgb(255,80,71)', 'rgb(255,72,63)', 'rgb(255,65,55)',
  'rgb(255,57,46)', 'rgb(255,49,38)', 'rgb(255,41,30)', 'rgb(255,34,22)',
  'rgb(255,26,14)', 'rgb(255,18,6)', 'rgb(252,12,0)', 'rgb(244,12,0)',
  'rgb(236,11,0)', 'rgb(228,11,0)', 'rgb(220,11,0)', 'rgb(212,10,0)',
  'rgb(204,10,0)', 'rgb(195,9,0)', 'rgb(187,9,0)', 'rgb(179,9,0)',
]

const heartColorsGreen = [
  'rgb(178,213,178)', 'rgb(147,196,147)', 'rgb(173,210,173)', 'rgb(141,193,141)',
  'rgb(168,208,168)', 'rgb(136,190,136)', 'rgb(162,205,162)', 'rgb(131,188,131)',
  'rgb(157,202,157)', 'rgb(125,185,125)', 'rgb(152,199,152)', 'rgb(120,182,120)',
  'rgb(115,179,115)', 'rgb(86,159,86)', 'rgb(110,176,110)', 'rgb(83,153,83)',
  'rgb(104,173,104)', 'rgb(80,148,80)', 'rgb(99,170,99)', 'rgb(78,143,78)',
  'rgb(94,167,94)', 'rgb(75,138,75)', 'rgb(89,164,89)', 'rgb(72,132,72)',
  'rgb(69,127,69)', 'rgb(66,122,66)', 'rgb(63,116,63)', 'rgb(60,111,60)',
]

const activeHeartColors = computed(() => {
  const hr = Number(status.value.heart_rate)
  if (Number.isNaN(hr) || hr < 40 || hr > 140) return heartColors
  return heartColorsGreen
})

const currentHeartTextColorIndex = ref(0)
const currentHeartImageIndex = ref(0)
const currentHeartColorIndex = ref(0)

const currentHeartTextColor = computed(() => {
  const colors = activeHeartColors.value
  return colors[currentHeartTextColorIndex.value % colors.length]
})

const currentHeartImage = computed(() => heartImages[currentHeartImageIndex.value])

const currentHeartColor = computed(() => {
  const colors = activeHeartColors.value
  return colors[currentHeartColorIndex.value % colors.length]
})

let heartImageInterval = null
let heartColorInterval = null

onMounted(() => {
  heartImageInterval = setInterval(() => {
    currentHeartImageIndex.value = (currentHeartImageIndex.value + 1) % heartImages.length
  }, 300)
  heartColorInterval = setInterval(() => {
    const colors = activeHeartColors.value
    const len = colors.length
    currentHeartColorIndex.value = (currentHeartColorIndex.value + 1) % len
    currentHeartTextColorIndex.value = (currentHeartTextColorIndex.value - 1 + len) % len
  }, 50)
})

onUnmounted(() => {
  clearInterval(heartImageInterval)
  clearInterval(heartColorInterval)
})

// sos pulsing alert colors
const alertColors = heartColors
const alertColorIndex = ref(0)
const currentAlertColor = computed(() => alertColors[alertColorIndex.value % alertColors.length])
let alertColorInterval = null

onMounted(() => {
  alertColorInterval = setInterval(() => {
    alertColorIndex.value = (alertColorIndex.value + 1) % alertColors.length
  }, 80)
})

onUnmounted(() => {
  clearInterval(alertColorInterval)
})

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    api fetchers

async function getUserInfo(newID) {
  try {
    const response = await fetch(`${url}/user?user_id=${newID}`)
    if (!response.ok) throw new Error(`status: ${response.status}`)
    userInfo.value = await response.json()
  } catch (error) {
    console.error('user info fetch failed:', error.message)
  }
}

async function getEvents(currentId) {
  if (!currentId) return
  try {
    const response = await fetch(`${url}/events?user_id=${currentId}&quantity=10`)
    if (!response.ok) throw new Error(`status: ${response.status}`)
    const data = await response.json()
    events.value = data.map((e) => ({
      ...e,
      type: e.type === 'Low_Battery' ? 'Battery' : e.type,
    }))
  } catch (error) {
    console.error('events fetch failed:', error.message)
  }
}

async function getStatus(currentId) {
  if (!currentId) return
  try {
    const response = await fetch(`${url}/status?user_id=${currentId}`)
    if (!response.ok) throw new Error(`status: ${response.status}`)
    status.value = await response.json()
    const lat = status.value.latitude
    const lon = status.value.longitude
    if (lat == null || lon == null || (lat === 0 && lon === 0)) {
      console.warn('invalid or zero coordinates received')
      return
    }
    initializeOrUpdateMap(lat, lon)
    initMiniMap(lat, lon)
    fetchNearestPlace(lat, lon)
    fetchWeather(lat, lon)
  } catch (error) {
    console.error('status fetch failed:', error.message)
  }
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    map: geofence (full)

function initializeOrUpdateMap(lat, lon) {
  const mapElement = document.getElementById('map')
  if (!mapElement) return

  if (map.value) {
    map.value.setView([lat, lon], 17)
    if (marker.value) marker.value.setLatLng([lat, lon])
    else marker.value = L.marker([lat, lon], { icon: buildIcon(customMarkerUrl.value) }).addTo(map.value)
  } else {
    try {
      map.value = L.map('map').setView([lat, lon], 17)
      // carto dark tiles for dark theme
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '<span style="color:#4f8ff7;">SenseWay © 2025</span>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map.value)
      marker.value = L.marker([lat, lon], { icon: buildIcon(customMarkerUrl.value) }).addTo(map.value)
    } catch (err) {
      console.error('map init failed:', err)
    }
  }

  if (map.value) {
    map.value.off('click', handleMapClick)
    map.value.on('click', handleMapClick)
    renderGeofencesOnMap()
  }
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    map: dashboard (mini)

function initMiniMap(lat, lon) {
  const el = document.getElementById('map-mini')
  if (!el) return

  if (mapMini.value) {
    mapMini.value.setView([lat, lon], 15)
    if (miniMarker.value) miniMarker.value.setLatLng([lat, lon])
    else miniMarker.value = L.marker([lat, lon], { icon: buildIcon(customMarkerUrl.value) }).addTo(mapMini.value)
  } else {
    try {
      // mini map: read-only, no controls
      mapMini.value = L.map('map-mini', {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      }).setView([lat, lon], 15)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(mapMini.value)
      miniMarker.value = L.marker([lat, lon], { icon: buildIcon(customMarkerUrl.value) }).addTo(mapMini.value)
    } catch (err) {
      console.error('mini map init failed:', err)
    }
  }
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    geofence: map helpers

function normalizeGeofenceName(name) {
  return (name || '').trim() || 'Geofence'
}

function clearGeofenceDraftLayers() {
  if (map.value && geofenceMarker.value) map.value.removeLayer(geofenceMarker.value)
  if (map.value && geofenceCircle.value) map.value.removeLayer(geofenceCircle.value)
  geofenceMarker.value = null
  geofenceCircle.value = null
}

function clearAllGeofenceLayers() {
  geofenceLayers.forEach((layer) => {
    if (map.value && layer) map.value.removeLayer(layer)
  })
  geofenceLayers.clear()
}

function resetGeofenceDraft() {
  clearGeofenceDraftLayers()
  geofence.value = null
  selectedGeofenceId.value = null
  geofenceRadius.value = 100
  geofenceName.value = 'Geofence'
}

function upsertGeofenceInState(saved) {
  const normalized = { ...saved, radius: Number(saved.radius) }
  const idx = geofences.value.findIndex((item) => item.id === normalized.id)
  if (idx >= 0) geofences.value[idx] = normalized
  else geofences.value.unshift(normalized)
}

function removeGeofenceFromState(fenceId) {
  geofences.value = geofences.value.filter((item) => item.id !== fenceId)
}

function buildGeofencePopupHTML(fence) {
  const safeName = (fence.name || 'Geofence').replace(/[<>]/g, '')
  const radiusValue = Number(fence.radius) || 0
  return `
    <div style="min-width:200px;display:grid;gap:8px;background:#111120;padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,0.1);">
      <div style="font-weight:700;color:#ffffff;font-size:14px;">${safeName}</div>
      <div style="font-size:12px;color:#b0b0c8;">Radius: ${radiusValue}m</div>
      <div style="display:flex;gap:8px;">
        <button id="geofence-edit-${fence.id}" style="padding:6px 12px;border-radius:10px;border:none;background:#4f8ff7;color:#fff;cursor:pointer;font-weight:600;font-size:12px;">Edit</button>
        <button id="geofence-delete-${fence.id}" style="padding:6px 12px;border-radius:10px;border:none;background:#ef4444;color:#fff;cursor:pointer;font-weight:600;font-size:12px;">Delete</button>
      </div>
    </div>
  `
}

function applyGeofenceDraft(latlng) {
  if (!map.value) return
  if (!geofenceMarker.value) {
    geofenceMarker.value = L.marker(latlng, { draggable: true }).addTo(map.value)
    geofenceMarker.value.on('drag', (e) => updateGeofenceCircle(e.target.getLatLng()))
  } else {
    geofenceMarker.value.setLatLng(latlng)
  }
  updateGeofenceCircle(latlng)
}

function handleMapClick(e) {
  if (geofenceSaving.value || geofenceDeleting.value) return
  geofenceSaveMessage.value = ''
  geofenceSaveMessageType.value = ''
  applyGeofenceDraft(e.latlng)
}

function updateGeofenceCircle(latlng) {
  if (geofenceCircle.value) {
    geofenceCircle.value.setLatLng(latlng)
    geofenceCircle.value.setRadius(geofenceRadius.value)
  } else {
    geofenceCircle.value = L.circle(latlng, {
      radius: geofenceRadius.value,
      color: '#4f8ff7',
      fillOpacity: 0.18,
    }).addTo(map.value)
  }
}

function updateRadius() {
  if (geofenceCircle.value) geofenceCircle.value.setRadius(geofenceRadius.value)
}

function renderGeofencesOnMap() {
  if (!map.value) return
  const knownIds = new Set(geofences.value.map((item) => item.id))
  geofenceLayers.forEach((layer, layerId) => {
    if (!knownIds.has(layerId)) {
      if (map.value) map.value.removeLayer(layer)
      geofenceLayers.delete(layerId)
    }
  })
  geofences.value.forEach((fence) => {
    if (!fence?.id) return
    const prev = geofenceLayers.get(fence.id)
    if (prev && map.value) map.value.removeLayer(prev)
    const isSelected = selectedGeofenceId.value === fence.id
    const layer = L.circle([fence.latitude, fence.longitude], {
      radius: Number(fence.radius),
      color: isSelected ? '#f97316' : '#4ade80',
      fillColor: isSelected ? '#fb923c' : '#4ade80',
      fillOpacity: 0.18,
      weight: isSelected ? 3 : 2,
    }).addTo(map.value)
    layer.bindPopup(buildGeofencePopupHTML(fence))
    layer.on('click', () => selectExistingGeofence(fence.id, false))
    layer.on('popupopen', () => {
      const editBtn = document.getElementById(`geofence-edit-${fence.id}`)
      if (editBtn) editBtn.onclick = () => selectExistingGeofence(fence.id, true)
      const delBtn = document.getElementById(`geofence-delete-${fence.id}`)
      if (delBtn) delBtn.onclick = () => deleteSelectedGeofence(fence.id)
    })
    geofenceLayers.set(fence.id, layer)
  })
}

function selectExistingGeofence(fenceId, closePopup = false) {
  const selected = geofences.value.find((item) => item.id === fenceId)
  if (!selected) return
  selectedGeofenceId.value = selected.id
  geofence.value = { ...selected }
  geofenceRadius.value = Number(selected.radius)
  geofenceName.value = selected.name || 'Geofence'
  applyGeofenceDraft({ lat: selected.latitude, lng: selected.longitude })
  renderGeofencesOnMap()
  if (closePopup) geofenceLayers.get(selected.id)?.closePopup()
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    geofence: crud

async function fetchGeofences() {
  if (!id.value) return
  console.log('[fetchGeofences] user id:', id.value)
  geofenceLoading.value = true
  try {
    const result = await listGeofences(id.value)
    geofences.value = Array.isArray(result)
      ? result.map((item) => ({ ...item, radius: Number(item.radius) }))
      : []
    renderGeofencesOnMap()
  } catch (error) {
    const msg = error?.message || 'unable to load geofences'
    showGeofenceMessage(`Failed to load geofences: ${msg}`, 'error')
    console.error('fetchGeofences failed:', error)
  } finally {
    geofenceLoading.value = false
  }
}

async function saveGeofence() {
  if (geofenceSaving.value) return
  geofenceSaveMessage.value = ''
  if (!geofenceMarker.value) {
    showGeofenceMessage('Place a marker on the map first.', 'error')
    return
  }
  if (!id.value) {
    showGeofenceMessage('Missing user ID — please log in again.', 'error')
    return
  }
  const radius = Number(geofenceRadius.value)
  if (Number.isNaN(radius) || radius <= 0) {
    showGeofenceMessage('Radius must be greater than 0m.', 'error')
    return
  }
  const markerLatLng = geofenceMarker.value.getLatLng?.()
  if (!markerLatLng) {
    showGeofenceMessage('Invalid marker location.', 'error')
    return
  }
  const geofenceId = geofence.value?.id
  const payload = {
    user_id: id.value,
    name: normalizeGeofenceName(geofenceName.value),
    enabled: true,
    latitude: markerLatLng.lat,
    longitude: markerLatLng.lng,
    radius,
  }
  geofenceSaving.value = true
  try {
    const result = geofenceId
      ? await updateGeofenceApi(geofenceId, payload)
      : await createGeofence(payload)
    if (!result || !result.id) throw new Error('server did not return a valid fence record')
    geofence.value = { ...result, radius: Number(result.radius) }
    selectedGeofenceId.value = result.id
    geofenceName.value = geofence.value.name || 'Geofence'
    upsertGeofenceInState(geofence.value)
    renderGeofencesOnMap()
    showGeofenceMessage(geofenceId ? 'Zone updated successfully.' : 'Zone saved successfully.', 'success')
  } catch (error) {
    const msg = error?.message || 'unknown error'
    showGeofenceMessage(`Failed to save: ${msg}`, 'error')
    console.error('saveGeofence failed:', error)
  } finally {
    geofenceSaving.value = false
  }
}

async function deleteSelectedGeofence(fenceId = geofence.value?.id) {
  if (!fenceId || geofenceDeleting.value || geofenceSaving.value) return
  if (!id.value) {
    showGeofenceMessage('Missing user ID — please log in again.', 'error')
    return
  }
  geofenceDeleting.value = true
  geofenceSaveMessage.value = ''
  try {
    await deleteGeofenceApi(fenceId, id.value)
    if (map.value && geofenceLayers.has(fenceId)) {
      map.value.removeLayer(geofenceLayers.get(fenceId))
      geofenceLayers.delete(fenceId)
    }
    removeGeofenceFromState(fenceId)
    if (selectedGeofenceId.value === fenceId || geofence.value?.id === fenceId) {
      resetGeofenceDraft()
    }
    showGeofenceMessage('Zone deleted.', 'success')
  } catch (error) {
    const msg = error?.message || 'unknown error'
    showGeofenceMessage(`Failed to delete: ${msg}`, 'error')
  } finally {
    geofenceDeleting.value = false
  }
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    settings state

const customMarkerSaved = ref(false)

function saveCustomMarker() {
  localStorage.setItem('sw_custom_marker', customMarkerUrl.value)
  const icon = buildIcon(customMarkerUrl.value)
  if (marker.value) marker.value.setIcon(icon)
  if (miniMarker.value) miniMarker.value.setIcon(icon)
  customMarkerSaved.value = true
  setTimeout(() => { customMarkerSaved.value = false }, 2500)
}

function clearCustomMarker() {
  customMarkerUrl.value = ''
  localStorage.removeItem('sw_custom_marker')
  const icon = buildIcon('')
  if (marker.value) marker.value.setIcon(icon)
  if (miniMarker.value) miniMarker.value.setIcon(icon)
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    lifecycle

let dataInterval = null

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push({ name: 'login' })
    return
  }
  const userId = id.value
  if (userId) {
    getUserInfo(userId)
    getEvents(userId)
    getStatus(userId)
    fetchGeofences()
    if (dataInterval) clearInterval(dataInterval)
    dataInterval = setInterval(() => {
      getEvents(userId)
      getStatus(userId)
    }, 3000)
  }
})

// re-render geofences when list changes — handles map/data race
watch(geofences, () => renderGeofencesOnMap(), { deep: true })

watch(
  id,
  (newID) => {
    if (newID) {
      if (map.value) { map.value.remove(); map.value = null; marker.value = null }
      if (mapMini.value) { mapMini.value.remove(); mapMini.value = null; miniMarker.value = null }
      clearGeofenceDraftLayers()
      clearAllGeofenceLayers()
      geofence.value = null
      geofences.value = []
      getUserInfo(newID)
      getEvents(newID)
      getStatus(newID)
      fetchGeofences()
      if (dataInterval) clearInterval(dataInterval)
      dataInterval = setInterval(() => {
        getEvents(newID)
        getStatus(newID)
      }, 3000)
    }
  },
  { immediate: false },
)

onUnmounted(() => {
  if (dataInterval) clearInterval(dataInterval)
  if (geofenceMessageTimer) clearTimeout(geofenceMessageTimer)
  clearGeofenceDraftLayers()
  clearAllGeofenceLayers()
  if (map.value) { map.value.remove(); map.value = null }
  if (mapMini.value) { mapMini.value.remove(); mapMini.value = null }
  marker.value = null
  miniMarker.value = null
  geofence.value = null
  geofences.value = []
})

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                           C O N C E P T :  S E N S E W A Y
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
</script>

<template>
  <div class="app-shell">

    <!-- ==================== sidebar ==================== -->
    <nav class="sidebar">
      <div class="sidebar-logo">
        <img src="https://i.gyazo.com/5ebc3dc6c713fc1ae66bcc5d4704a0bd.png" class="logo-img" alt="SenseWay" />
      </div>

      <div class="sidebar-nav">
        <button :class="['nav-btn', { 'nav-btn--active': activeTab === 'dashboard' }]" @click="setTab('dashboard')" title="Dashboard">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="2"/><rect width="7" height="5" x="14" y="3" rx="2"/><rect width="7" height="9" x="14" y="12" rx="2"/><rect width="7" height="5" x="3" y="16" rx="2"/>
          </svg>
          <span class="nav-label">Home</span>
        </button>

        <button :class="['nav-btn', { 'nav-btn--active': activeTab === 'geofence' }]" @click="setTab('geofence')" title="Safety Zones">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
          <span class="nav-label">Zones</span>
        </button>

        <button :class="['nav-btn', { 'nav-btn--active': activeTab === 'settings' }]" @click="setTab('settings')" title="Settings">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <span class="nav-label">Settings</span>
        </button>
      </div>

      <div class="sidebar-foot">
        <button class="nav-btn nav-btn--logout" @click="handleLogout" title="Logout">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span class="nav-label">Logout</span>
        </button>
      </div>
    </nav>

    <!-- ==================== app body ==================== -->
    <div class="app-body">

      <!-- topbar -->
      <header class="topbar">
        <div class="topbar-inner">
          <div class="topbar-left">
            <h1 class="page-title">{{ pageTitle }}</h1>
          </div>

          <div class="topbar-center">
            <span class="live-pill">
              <span class="live-dot"></span>LIVE
            </span>
            <div class="tb-divider"></div>
            <div class="tb-stat">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="10" x="2" y="7" rx="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>
              <span :style="{ color: batteryTextColor }">{{ batteryPercentage }}%</span>
            </div>
            <div class="tb-divider"></div>
            <div class="tb-stat">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              <span :style="{ color: currentHeartTextColor }">{{ status.heart_rate || '—' }}<span v-if="status.heart_rate" class="bpm-unit"> bpm</span></span>
            </div>
            <template v-if="locationShort">
              <div class="tb-divider"></div>
              <div class="tb-loc-chip">
                <span class="tb-loc-radar">
                  <span class="tb-loc-ring"></span>
                  <span class="tb-loc-dot"></span>
                </span>
                <span v-if="countryCode" class="tb-loc-country" :style="{ background: countryCode.color }">{{ countryCode.code }}</span>
                <span class="tb-loc-text">{{ locationShort }}</span>
              </div>
            </template>
          </div>

          <div class="topbar-right">
            <div class="tb-avatar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
            </div>
            <div class="tb-user-info">
              <span class="tb-user-name">{{ authStore.user?.name || 'User' }}</span>
              <span class="tb-user-role">{{ authStore.user?.type || '—' }}</span>
            </div>
          </div>
        </div>
      </header>

      <!-- ==================== tab content ==================== -->
      <main class="app-main">

        <!-- - - - - dashboard - - - - -->
        <div v-show="activeTab === 'dashboard'" class="tab-pane">
          <div class="dash-grid">

            <!-- mini map + location details -->
            <div class="card card-map">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span class="card-title">Live Location</span>
                </div>
                <span class="live-pill-sm"><span class="live-dot"></span>Real-time</span>
              </div>

              <!-- map -->
              <div id="map-mini" class="mini-map"></div>

              <!-- address bar -->
              <div v-if="nearestPlaceLabel || nearestPlace.road" class="loc-address-bar">
                <span class="loc-radar-wrap">
                  <span class="loc-ring"></span>
                  <span class="loc-dot-inner"></span>
                </span>
                <span v-if="countryCode" class="loc-country-code" :style="{ background: countryCode.color }">{{ countryCode.code }}</span>
                <span class="loc-address-text">
                  {{ [nearestPlace.name, nearestPlace.road, nearestPlace.city, nearestPlace.country].filter(Boolean).join(', ') || '—' }}
                </span>
              </div>

              <!-- location detail grid -->
              <div class="loc-detail-grid">
                <!-- neighbourhood -->
                <div v-if="nearestPlace.neighbourhood" class="loc-detail-item">
                  <span class="loc-detail-key">Neighbourhood</span>
                  <span class="loc-detail-val">{{ nearestPlace.neighbourhood }}</span>
                </div>
                <!-- road -->
                <div v-if="nearestPlace.road" class="loc-detail-item">
                  <span class="loc-detail-key">Street</span>
                  <span class="loc-detail-val">{{ nearestPlace.road }}</span>
                </div>
                <!-- postcode -->
                <div v-if="nearestPlace.postcode" class="loc-detail-item">
                  <span class="loc-detail-key">Postal Code</span>
                  <span class="loc-detail-val">{{ nearestPlace.postcode }}</span>
                </div>
                <!-- state -->
                <div v-if="nearestPlace.state" class="loc-detail-item">
                  <span class="loc-detail-key">Province / State</span>
                  <span class="loc-detail-val">{{ nearestPlace.state }}</span>
                </div>
                <!-- elevation -->
                <div v-if="weatherData.elevation != null" class="loc-detail-item">
                  <span class="loc-detail-key">Elevation</span>
                  <span class="loc-detail-val">{{ weatherData.elevation }} m</span>
                </div>
                <!-- coordinates -->
                <div class="loc-detail-item">
                  <span class="loc-detail-key">Coordinates</span>
                  <span class="loc-detail-val">{{ status.latitude?.toFixed(5) }}, {{ status.longitude?.toFixed(5) }}</span>
                </div>
              </div>

              <!-- weather strip -->
              <div v-if="weatherLabel" class="loc-weather-strip">
                <div class="loc-weather-row">
                  <div class="loc-wx-item">
                    <span class="loc-wx-key">Weather</span>
                    <span class="loc-wx-val">{{ weatherLabel }}</span>
                  </div>
                  <div v-if="weatherData.temp != null" class="loc-wx-item">
                    <span class="loc-wx-key">Temperature</span>
                    <span class="loc-wx-val">{{ weatherData.temp }}°C</span>
                  </div>
                  <div v-if="weatherData.wind != null" class="loc-wx-item">
                    <span class="loc-wx-key">Wind</span>
                    <span class="loc-wx-val">{{ weatherData.wind }} km/h</span>
                  </div>
                  <div v-if="weatherData.humidity != null" class="loc-wx-item">
                    <span class="loc-wx-key">Humidity</span>
                    <span class="loc-wx-val">{{ weatherData.humidity }}%</span>
                  </div>
                </div>

                <!-- pavement condition -->
                <div v-if="pavementCondition" class="loc-pavement" :class="`loc-pavement--${pavementCondition.level}`">
                  <span class="loc-pavement-dot"></span>
                  <span class="loc-pavement-label">Pavement: {{ pavementCondition.label }}</span>
                </div>
              </div>

            </div>

            <!-- metrics column -->
            <div class="metrics-col">
              <!-- battery -->
              <div class="card metric-card">
                <div class="card-head">
                  <div class="card-head-left">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="10" x="2" y="7" rx="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>
                    <span class="card-title">Battery</span>
                  </div>
                </div>
                <div class="metric-body">
                  <img :src="batteryImage" class="metric-img" alt="battery" />
                  <div class="metric-val-col">
                    <span class="metric-val" :style="{ color: batteryTextColor }">{{ batteryPercentage }}%</span>
                    <div class="bar-track">
                      <div class="bar-fill" :style="{ width: batteryPercentage + '%', background: batteryTextColor }"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- heart rate -->
              <div class="card metric-card">
                <div class="card-head">
                  <div class="card-head-left">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                    <span class="card-title">Heart Rate</span>
                  </div>
                </div>
                <div class="metric-body">
                  <div class="heart-wrap">
                    <div class="heart-glow" :style="{ backgroundColor: currentHeartColor }"></div>
                    <img :src="currentHeartImage" class="heart-img" alt="heart" />
                  </div>
                  <div class="metric-val-col">
                    <span class="metric-val" :style="{ color: currentHeartTextColor }">
                      {{ status.heart_rate || '—' }}<span v-if="status.heart_rate" class="metric-unit"> bpm</span>
                    </span>
                    <span class="metric-sub">{{ status.heart_rate ? 'Monitoring active' : 'Awaiting data' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- profile card -->
            <div class="card card-profile">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                  <span class="card-title">Profile</span>
                </div>
              </div>
              <div class="profile-avatar-row">
                <div class="profile-avatar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                </div>
                <div>
                  <div class="profile-name">{{ userInfo.name || authStore.user?.name || '—' }}</div>
                  <span class="profile-type-badge">{{ userInfo.type || authStore.user?.type || '—' }}</span>
                </div>
              </div>
              <div class="profile-grid">
                <div class="profile-item"><span class="pkey">Email</span><span class="pval">{{ userInfo.email || authStore.user?.email || '—' }}</span></div>
                <div class="profile-item"><span class="pkey">Age</span><span class="pval">{{ userAge != null ? userAge + ' yrs' : '—' }}</span></div>
                <div class="profile-item"><span class="pkey">Born</span><span class="pval">{{ userInfo.birth_date ? new Date(userInfo.birth_date).toLocaleDateString() : '—' }}</span></div>
                <div class="profile-item"><span class="pkey">Member since</span><span class="pval">{{ userInfo.created_at ? new Date(userInfo.created_at).toLocaleDateString() : '—' }}</span></div>
              </div>
            </div>

            <!-- events card -->
            <div class="card card-events">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  <span class="card-title">Events Feed</span>
                </div>
                <span v-if="events.length" class="count-badge">{{ events.length }}</span>
              </div>
              <div v-if="!events.length" class="events-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".25"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
                <p>No recent events</p>
              </div>
              <div v-else class="events-table-wrap">
                <table class="events-table">
                  <thead>
                    <tr><th>Event</th><th>Type</th><th>Description</th><th>Time</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="event in events" :key="event.id">
                      <td class="ev-name">{{ event.name }}</td>
                      <td>
                        <span
                          :class="['type-badge', isAlertEvent(event) ? 'type-badge--alert' : 'type-badge--ok']"
                          :style="isAlertEvent(event) ? { backgroundColor: currentAlertColor, transition: 'background-color 90ms linear' } : {}"
                        >{{ event.type }}</span>
                      </td>
                      <td class="ev-desc">{{ event.description }}</td>
                      <td class="ev-time">{{ new Date(event.created_at).toLocaleString() }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        <!-- - - - - geofence tab - - - - -->
        <div v-show="activeTab === 'geofence'" class="tab-pane tab-pane--gf">
          <div class="gf-layout">

            <!-- full map panel -->
            <div class="gf-map-panel">
              <div id="map" class="full-map"></div>
            </div>

            <!-- controls panel -->
            <div class="gf-controls-panel">
              <div class="gf-ctrl-head">
                <h3 class="gf-ctrl-title">Safety Zones</h3>
                <div class="gf-ctrl-meta">
                  <span v-if="geofences.length" class="count-badge">{{ geofences.length }}</span>
                  <span v-if="geofenceLoading" class="loading-text">Loading…</span>
                </div>
              </div>

              <div class="gf-form">
                <div class="field">
                  <label class="field-label">Zone Name</label>
                  <input v-model.trim="geofenceName" type="text" maxlength="60" class="field-input" placeholder="e.g. Home perimeter" />
                </div>
                <div class="field">
                  <div class="field-label-row">
                    <label class="field-label">Radius</label>
                    <span class="field-accent">{{ geofenceRadius }}m</span>
                  </div>
                  <input type="range" min="50" max="5000" step="50" v-model="geofenceRadius" @input="updateRadius" class="slider" />
                  <div class="slider-ticks"><span>50m</span><span>2.5km</span><span>5km</span></div>
                </div>
                <p class="gf-hint">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  Click the map to place or move the zone marker.
                </p>
                <div class="gf-btns">
                  <button @click="saveGeofence" class="btn btn-primary" :disabled="!geofenceMarker || geofenceSaving || geofenceDeleting">
                    {{ geofenceSaving ? 'Saving…' : geofence?.id ? 'Update Zone' : 'Save Zone' }}
                  </button>
                  <button v-if="geofence?.id" @click="resetGeofenceDraft" class="btn btn-ghost" :disabled="geofenceSaving || geofenceDeleting">+ New</button>
                  <button @click="deleteSelectedGeofence()" class="btn btn-danger" :disabled="!geofence?.id || geofenceSaving || geofenceDeleting">
                    {{ geofenceDeleting ? 'Removing…' : 'Delete' }}
                  </button>
                </div>
                <div v-if="geofenceSaveMessage" :class="['gf-msg', geofenceSaveMessageType === 'success' ? 'gf-msg--ok' : 'gf-msg--err']">
                  {{ geofenceSaveMessage }}
                </div>
              </div>

              <div class="gf-divider"></div>

              <div v-if="geofences.length" class="gf-zones">
                <p class="gf-zones-title">Saved Zones</p>
                <div class="gf-zones-list">
                  <div
                    v-for="item in geofences" :key="item.id"
                    :class="['zone-row', { 'zone-row--active': item.id === selectedGeofenceId }]"
                  >
                    <button class="zone-row-body" @click="selectExistingGeofence(item.id)">
                      <span class="zone-dot" :class="{ 'zone-dot--sel': item.id === selectedGeofenceId }"></span>
                      <span class="zone-name">{{ item.name || 'Zone' }}</span>
                      <span class="zone-radius">{{ Math.round(Number(item.radius) || 0) }}m</span>
                    </button>
                    <button class="zone-del" :disabled="geofenceDeleting || geofenceSaving" @click.stop="deleteSelectedGeofence(item.id)" title="Delete">✕</button>
                  </div>
                </div>
              </div>
              <div v-else-if="!geofenceLoading" class="gf-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".3"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
                <p>No zones yet.<br/>Click the map to create one.</p>
              </div>
            </div>

          </div>
        </div>

        <!-- - - - - settings tab - - - - -->
        <div v-show="activeTab === 'settings'" class="tab-pane">
          <div class="settings-grid">

            <!-- account card -->
            <div class="card">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                  <span class="card-title">Account</span>
                </div>
              </div>
              <div class="settings-rows">
                <div class="srow"><span class="skey">Name</span><span class="sval">{{ userInfo.name || authStore.user?.name || '—' }}</span></div>
                <div class="srow"><span class="skey">Email</span><span class="sval">{{ userInfo.email || authStore.user?.email || '—' }}</span></div>
                <div class="srow"><span class="skey">Role</span><span class="sval">{{ userInfo.type || authStore.user?.type || '—' }}</span></div>
                <div class="srow"><span class="skey">Age</span><span class="sval">{{ userAge != null ? userAge + ' years old' : '—' }}</span></div>
                <div class="srow"><span class="skey">Birth Date</span><span class="sval">{{ userInfo.birth_date ? new Date(userInfo.birth_date).toLocaleDateString() : '—' }}</span></div>
                <div class="srow"><span class="skey">Home Location</span><span class="sval">{{ userInfo.home_lat ? userInfo.home_lat.toFixed(4) + ', ' + userInfo.home_long.toFixed(4) : '—' }}</span></div>
              </div>
            </div>

            <!-- custom marker card -->
            <div class="card">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span class="card-title">Custom Map Marker</span>
                </div>
              </div>
              <p class="settings-desc">Paste a direct image URL to use as the cane user's map pin.</p>
              <div class="marker-preview-row">
                <img v-if="customMarkerUrl" :src="customMarkerUrl" class="marker-preview" alt="Custom marker" @error="(e) => e.target.style.display='none'" />
                <div v-else class="marker-placeholder">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".4"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Default marker</span>
                </div>
              </div>
              <div class="field">
                <label class="field-label">Image URL</label>
                <input v-model="customMarkerUrl" type="url" class="field-input" placeholder="https://example.com/icon.png" />
              </div>
              <div class="settings-btns">
                <button @click="saveCustomMarker" class="btn btn-primary">{{ customMarkerSaved ? '✓ Saved!' : 'Apply Marker' }}</button>
                <button v-if="customMarkerUrl" @click="clearCustomMarker" class="btn btn-ghost">Reset to Default</button>
              </div>
            </div>

            <!-- device status card -->
            <div class="card">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="20" x="5" y="2" rx="3"/><path d="M12 18h.01"/></svg>
                  <span class="card-title">Device Status</span>
                </div>
                <span class="live-pill-sm"><span class="live-dot"></span>Live</span>
              </div>
              <div class="settings-rows">
                <div class="srow"><span class="skey">Battery</span><span class="sval" :style="{ color: batteryTextColor }">{{ batteryPercentage }}%</span></div>
                <div class="srow"><span class="skey">Heart Rate</span><span class="sval" :style="{ color: currentHeartTextColor }">{{ status.heart_rate ? status.heart_rate + ' bpm' : 'No data' }}</span></div>
                <div class="srow"><span class="skey">Location</span><span class="sval">{{ nearestPlaceLabel || 'No data' }}</span></div>
                <div class="srow"><span class="skey">Coordinates</span><span class="sval">{{ status.latitude ? status.latitude.toFixed(5) + ', ' + status.longitude.toFixed(5) : '—' }}</span></div>
                <div class="srow"><span class="skey">Last Update</span><span class="sval">{{ status.created_at ? new Date(status.created_at).toLocaleTimeString() : '—' }}</span></div>
                <div class="srow"><span class="skey">Safety Zones</span><span class="sval">{{ geofences.length }} configured</span></div>
              </div>
            </div>

            <!-- about card -->
            <div class="card">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  <span class="card-title">About SenseWay</span>
                </div>
              </div>
              <div class="about-body">
                <img src="https://i.gyazo.com/5ebc3dc6c713fc1ae66bcc5d4704a0bd.png" class="about-logo" alt="SenseWay logo" />
                <p class="about-desc">SenseWay™ is a smart health monitoring platform for cane users and their caregivers. Real-time GPS tracking, heart rate monitoring, and geofencing to keep your loved ones safe.</p>
                <div class="about-tags">
                  <span class="about-tag">GPS Tracking</span>
                  <span class="about-tag">Heart Rate</span>
                  <span class="about-tag">Geofencing</span>
                  <span class="about-tag">Live Alerts</span>
                </div>
                <p class="about-copy">SenseWay™ © 2025 · Non-Profit Organization</p>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  </div>
</template>

<style scoped>

.about-desc {
  color: #ffffff;
}
/* ── design tokens ── */
:root {
  --bg:      #080810;
  --surf:    #0e0e18;
  --surf2:   #13131f;
  --border:  rgba(255,255,255,0.07);
  --border2: rgba(255,255,255,0.14);
  --text:    #ffffff;
  --muted:   #ffffff;
  --dim:     #c8c8d8;
  --accent:  #4f8ff7;
  --r:       20px;
  --r-sm:    14px;
  --r-xs:    10px;
}

/* ── shell ── */
.app-shell {
  display: flex;
  flex-direction: row;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── sidebar ── */
.sidebar {
  width: 76px;
  flex-shrink: 0;
  height: 100vh;
  position: sticky;
  top: 0;
  background: #060610;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  z-index: 30;
}

.sidebar-logo {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.logo-img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  border-radius: 50%;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.sidebar-foot {
  padding-bottom: 8px;
}

.nav-btn {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  border: none;
  background: transparent;
  color: var(--dim);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  padding: 0;
}

.nav-btn:hover {
  background: rgba(255,255,255,0.06);
  color: var(--muted);
}

.nav-btn--active {
  background: rgba(79,143,247,0.14);
  color: var(--accent);
}

.nav-btn--logout {
  color: #f87171;
}

.nav-btn--logout:hover {
  background: rgba(239,68,68,0.12);
  color: #fca5a5;
}

.nav-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: inherit;
}

/* ── app body ── */
.app-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ── topbar ── */
.topbar {
  height: 60px;
  background: rgba(8,8,16,0.92);
  backdrop-filter: blur(24px) saturate(1.4);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 20;
  flex-shrink: 0;
}

.topbar-inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 20px;
}

.topbar-left {
  flex-shrink: 0;
  padding-right: 20px;
  border-right: 1px solid var(--border2);
}

.page-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
  letter-spacing: 0.01em;
}

.topbar-center {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 20px;
  min-width: 0;
  overflow: hidden;
}

.topbar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 20px;
  border-left: 1px solid var(--border2);
}

.live-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 100px;
  background: rgba(239,68,68,0.12);
  border: 1px solid rgba(239,68,68,0.25);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #f87171;
  flex-shrink: 0;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse-dot 1.4s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,100% { opacity:1; transform:scale(1); }
  50%      { opacity:.35; transform:scale(.65); }
}

.tb-divider {
  width: 1px;
  height: 18px;
  background: var(--border2);
  flex-shrink: 0;
  margin: 0 10px;
}

.tb-stat {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  flex-shrink: 0;
}

.tb-stat svg {
  opacity: 0.5;
  flex-shrink: 0;
}

.bpm-unit {
  font-size: 10px;
  opacity: 0.6;
}

/* location chip in topbar */
.tb-loc-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px 4px 8px;
  border-radius: 100px;
  background: rgba(79,143,247,0.1);
  border: 1px solid rgba(79,143,247,0.22);
  max-width: 280px;
  overflow: hidden;
  flex-shrink: 1;
}

/* radar pulse animation */
.tb-loc-radar {
  position: relative;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tb-loc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4f8ff7;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.tb-loc-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px solid #4f8ff7;
  animation: loc-radar 1.8s ease-out infinite;
}

@keyframes loc-radar {
  0%   { transform: scale(0.4); opacity: 0.9; }
  100% { transform: scale(2.4); opacity: 0; }
}

.tb-loc-country {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.06em;
}

.tb-loc-text {
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tb-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surf2);
  border: 1px solid var(--border2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dim);
  flex-shrink: 0;
}

.tb-user-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.tb-user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.2;
}

.tb-user-role {
  font-size: 10px;
  color: var(--dim);
  line-height: 1.2;
}

/* ── main content area ── */
.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tab-pane {
  animation: fade-in 0.2s ease;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── card base ── */
.card {
  background: var(--surf);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 18px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.card-head-left {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--dim);
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.live-pill-sm {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #f87171;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 7px;
  border-radius: 100px;
  background: rgba(79,143,247,0.15);
  border: 1px solid rgba(79,143,247,0.25);
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
}

.loading-text {
  font-size: 11px;
  color: var(--dim);
}

/* ── dashboard grid ── */
.dash-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 16px;
}

.card-map {
  grid-column: 1;
  grid-row: 1;
}

.metrics-col {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-profile {
  grid-column: 1;
  grid-row: 2;
}

.card-events {
  grid-column: 2;
  grid-row: 2;
}

/* ── mini map ── */
.mini-map {
  height: 240px;
  width: 100%;
  border-radius: var(--r-sm);
  overflow: hidden;
}

/* ── address bar ── */
.loc-address-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: var(--r-sm);
  background: rgba(79,143,247,0.08);
  border: 1px solid rgba(79,143,247,0.18);
  min-width: 0;
}

.loc-radar-wrap {
  position: relative;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loc-dot-inner {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4f8ff7;
  position: relative;
  z-index: 1;
}

.loc-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px solid #4f8ff7;
  animation: loc-radar 1.8s ease-out infinite;
}

@keyframes loc-radar {
  0%   { transform: scale(0.4); opacity: 0.9; }
  100% { transform: scale(2.6); opacity: 0; }
}

.loc-country-code {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.06em;
}

.loc-address-text {
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

/* ── location detail grid ── */
.loc-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  margin-top: 10px;
  border-radius: var(--r-sm);
  overflow: hidden;
  border: 1px solid var(--border);
}

.loc-detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.02);
}

.loc-detail-item:hover {
  background: rgba(255,255,255,0.04);
}

.loc-detail-key {
  font-size: 9px;
  font-weight: 700;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.loc-detail-val {
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── weather strip ── */
.loc-weather-strip {
  margin-top: 10px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  overflow: hidden;
}

.loc-weather-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
}

.loc-wx-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.02);
}

.loc-wx-key {
  font-size: 9px;
  font-weight: 700;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.loc-wx-val {
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
}

/* pavement condition bar */
.loc-pavement {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.02);
  border-top: 1px solid var(--border);
}

.loc-pavement-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.loc-pavement--ok   .loc-pavement-dot { background: #4ade80; }
.loc-pavement--warn .loc-pavement-dot { background: #fbbf24; animation: pulse-dot 1.2s ease-in-out infinite; }
.loc-pavement--danger .loc-pavement-dot { background: #f87171; animation: pulse-dot 0.7s ease-in-out infinite; }

.loc-pavement-label {
  font-size: 12px;
  font-weight: 600;
}

.loc-pavement--ok     .loc-pavement-label { color: #4ade80; }
.loc-pavement--warn   .loc-pavement-label { color: #fbbf24; }
.loc-pavement--danger .loc-pavement-label { color: #f87171; }

/* ── metric cards ── */
.metric-card {
  flex: 1;
}

.metric-body {
  display: flex;
  align-items: center;
  gap: 14px;
}

.metric-img {
  width: 56px;
  height: 56px;
  object-fit: contain;
  flex-shrink: 0;
}

.metric-val-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.metric-val {
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--text);
}

.metric-unit {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.7;
}

.metric-sub {
  font-size: 11px;
  color: var(--dim);
}

.bar-track {
  height: 4px;
  width: 100%;
  background: rgba(255,255,255,0.08);
  border-radius: 100px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 100px;
  transition: width 0.5s ease, background 0.3s ease;
}

/* ── heart animation ── */
.heart-wrap {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}

.heart-glow {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  filter: blur(12px);
  opacity: 0.6;
  transition: background-color 50ms linear;
}

.heart-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* ── profile card ── */
.profile-avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.profile-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(79,143,247,0.12);
  border: 1px solid rgba(79,143,247,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  flex-shrink: 0;
}

.profile-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.profile-type-badge {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 10px;
  border-radius: 100px;
  background: rgba(79,143,247,0.12);
  border: 1px solid rgba(79,143,247,0.2);
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.04em;
}

.profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.profile-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pkey {
  font-size: 10px;
  font-weight: 600;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.pval {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── events card ── */
.events-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  color: var(--dim);
}

.events-empty p {
  font-size: 13px;
  margin: 0;
  color: var(--dim);
}

.events-table-wrap {
  overflow-x: auto;
}

.events-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.events-table thead th {
  padding: 6px 10px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--dim);
  border-bottom: 1px solid var(--border);
}

.events-table tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}

.events-table tbody tr:hover {
  background: rgba(255,255,255,0.03);
}

.events-table tbody tr:last-child {
  border-bottom: none;
}

.events-table td {
  padding: 8px 10px;
  color: var(--text);
  vertical-align: middle;
}

.ev-name {
  font-weight: 600;
  white-space: nowrap;
  color: var(--text);
}

.ev-desc {
  color: var(--muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ev-time {
  color: var(--dim);
  white-space: nowrap;
  font-size: 11px;
}

.type-badge {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.type-badge--ok {
  background: rgba(16,185,129,0.12);
  color: #6ee7b7;
  border: 1px solid rgba(16,185,129,0.2);
}

.type-badge--alert {
  color: #fff;
  border: 1px solid rgba(239,68,68,0.4);
}

/* ── geofence tab ── */
.tab-pane--gf {
  padding: 0;
  margin: -20px;
}

.gf-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  height: calc(100vh - 60px);
  gap: 0;
}

.gf-map-panel {
  position: relative;
  padding: 16px 0 16px 16px;
}

.full-map {
  height: 100%;
  width: 100%;
  border-radius: var(--r);
  overflow: hidden;
}

.gf-controls-panel {
  background: var(--surf);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto;
  gap: 0;
}

.gf-ctrl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.gf-ctrl-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.gf-ctrl-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gf-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-accent {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}

.field-input {
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border2);
  background: rgba(255,255,255,0.04);
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(79,143,247,0.15);
}

.field-input::placeholder {
  color: var(--dim);
}

.slider {
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
}

.slider-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--dim);
  margin-top: 2px;
}

.gf-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--dim);
  margin: 0;
}

.gf-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--r-sm);
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s;
  white-space: nowrap;
  color: var(--text);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
  flex: 1;
}

.btn-primary:not(:disabled):hover {
  opacity: 0.88;
}

.btn-ghost {
  background: rgba(255,255,255,0.07);
  border: 1px solid var(--border2);
  color: var(--text);
}

.btn-ghost:not(:disabled):hover {
  background: rgba(255,255,255,0.12);
}

.btn-danger {
  background: rgba(239,68,68,0.12);
  border: 1px solid rgba(239,68,68,0.25);
  color: #f87171;
}

.btn-danger:not(:disabled):hover {
  background: rgba(239,68,68,0.2);
}

.gf-msg {
  padding: 10px 14px;
  border-radius: var(--r-xs);
  border: 1px solid;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.gf-msg--ok  { background: rgba(34,197,94,0.1);  border-color: rgba(34,197,94,0.25);  color: #86efac; }
.gf-msg--err { background: rgba(239,68,68,0.1);   border-color: rgba(239,68,68,0.25);   color: #fda4af; }

.gf-divider {
  height: 1px;
  background: var(--border);
  margin: 18px 0;
}

.gf-zones-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--dim);
  margin: 0 0 10px;
}

.gf-zones-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
}

.gf-zones-list::-webkit-scrollbar { width: 4px; }
.gf-zones-list::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 100px; }

.zone-row {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
  border-radius: var(--r-xs);
  overflow: hidden;
  transition: border-color 0.15s;
}

.zone-row--active {
  border-color: #f97316;
  box-shadow: 0 0 0 1px rgba(249,115,22,0.25);
}

.zone-row-body {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--text);
}

.zone-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ade80;
  flex-shrink: 0;
}

.zone-dot--sel {
  background: #f97316;
}

.zone-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zone-radius {
  font-size: 11px;
  color: var(--dim);
  flex-shrink: 0;
}

.zone-del {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: #71717a;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-xs);
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
  margin-right: 4px;
}

.zone-del:not(:disabled):hover {
  background: rgba(239,68,68,0.12);
  color: #f87171;
}

.zone-del:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.gf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 0;
  text-align: center;
  color: var(--dim);
}

.gf-empty p {
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  color: var(--dim);
}

/* ── settings tab ── */
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.settings-rows {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.srow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.srow:last-child {
  border-bottom: none;
}

.skey {
  font-size: 12px;
  color: var(--dim);
  font-weight: 500;
}

.sval {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 55%;
}

.settings-desc {
  font-size: 12px;
  color: var(--dim);
  margin: 0 0 14px;
  line-height: 1.5;
}

.marker-preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  min-height: 56px;
}

.marker-preview {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid var(--border2);
  background: rgba(255,255,255,0.04);
  padding: 4px;
}

.marker-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px dashed var(--border2);
  color: var(--dim);
  font-size: 12px;
}

.settings-btns {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  flex-wrap: wrap;
}

/* ── about card ── */
.about-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.about-logo {
  height: 32px;
  object-fit: contain;
}

.about-desc {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.6;
  margin: 0;
}

.about-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.about-tag {
  padding: 4px 12px;
  border-radius: 100px;
  background: rgba(79,143,247,0.1);
  border: 1px solid rgba(79,143,247,0.18);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
}

.about-copy {
  font-size: 11px;
  color: var(--dim);
  margin: 0;
}

/* ── leaflet popup dark override ── */
:deep(.leaflet-popup-content-wrapper) {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  border-radius: 16px;
}

:deep(.leaflet-popup-tip) {
  display: none;
}

:deep(.leaflet-popup-content) {
  margin: 0;
}

:deep(.leaflet-container) {
  font-family: inherit;
}

/* ── scrollbar ── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 100px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
</style>
