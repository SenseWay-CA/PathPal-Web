<script setup>
import { useRouter } from 'vue-router'
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import FlipWords from '@/components/FlipWords.vue'
import CircularProgress from '@/components/CircularProgress.vue'
import HyperText from '@/components/HyperText.vue'
import AppConfetti from '@/components/AppConfetti.vue'
import SpringCalendar from '@/components/SpringCalendar.vue'
import { listAppointments, createAppointment as createAppointmentApi, deleteAppointment as deleteAppointmentApi } from '@/services/appointmentsApi'
import AnimatedBattery from '@/components/AnimatedBattery.vue'
import { Sun, CloudSun, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Cloud, Thermometer, Wind, Droplets, MapPin, Building2, Navigation2, Hash, Mountain, Globe, Home, Settings, LogOut, CheckCircle, AlertTriangle, X, ChevronDown, Edit2, Save, Briefcase, GraduationCap, Hospital, Pill, Leaf, ShoppingCart, Dumbbell, Layers } from 'lucide-vue-next'

// ── click-outside directive ──
const vClickOutside = {
  mounted(el, binding) {
    el.__clickOutsideHandler = (e) => {
      if (!el.contains(e.target)) binding.value(e)
    }
    document.addEventListener('click', el.__clickOutsideHandler)
  },
  unmounted(el) {
    document.removeEventListener('click', el.__clickOutsideHandler)
  },
}

// ── spotlight card directive ──
const vSpotlight = {
  mounted(el) {
    el.__spotMouse = (e) => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--sx', (e.clientX - rect.left) + 'px')
      el.style.setProperty('--sy', (e.clientY - rect.top) + 'px')
      el.style.setProperty('--so', '1')
    }
    el.__spotLeave = () => el.style.setProperty('--so', '0')
    el.addEventListener('mousemove', el.__spotMouse)
    el.addEventListener('mouseleave', el.__spotLeave)
  },
  unmounted(el) {
    el.removeEventListener('mousemove', el.__spotMouse)
    el.removeEventListener('mouseleave', el.__spotLeave)
  },
}

// ── visual enhancement state ──
const confettiRef = ref(null)
const isLoading = ref(true)
const topoCanvasRef = ref(null)
const loadingTyped = ref('')
const loadingProgress = ref(0)
let topoAnimFrame = null
import { useAuthStore } from '@/stores/auth'
import {
  listGeofences,
  createGeofence,
  updateGeofence as updateGeofenceApi,
  deleteGeofence as deleteGeofenceApi,
} from '@/services/geofenceApi'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// app core

const url = 'https://api.senseway.ca'
const authStore = useAuthStore()
const router = useRouter()

const handleLogout = async () => {
  await authStore.logout()
  router.push({ name: 'home' })
}

// user id from auth store
const id = computed(() => authStore.user?.user_id || '')

// signal: tracks when the last successful status fetch arrived
const lastDataReceived = ref(0)
const signalNow = ref(Date.now())

// 3 = great (<5s), 2 = ok (<12s), 1 = weak (<25s), 0 = offline
const signalBars = computed(() => {
  if (lastDataReceived.value === 0) return 0
  const age = signalNow.value - lastDataReceived.value
  if (age < 5000)  return 3
  if (age < 12000) return 2
  if (age < 25000) return 1
  return 0
})

// tick signalNow every second so signalBars stays fresh
let signalTick = null
onMounted(() => { signalTick = setInterval(() => { signalNow.value = Date.now() }, 1000) })
onUnmounted(() => clearInterval(signalTick))

// navigation / tabs

const activeTab = ref('dashboard')
const tabSwitchKey = ref(0)

const pageTitle = computed(() => {
  if (activeTab.value === 'dashboard') return 'Dashboard'
  if (activeTab.value === 'geofence') return 'Safety Zones'
  if (activeTab.value === 'events') return 'Events'
  if (activeTab.value === 'calendar') return 'Calendar'
  if (activeTab.value === 'settings') return 'Settings'
  return 'SenseWay'
})

function setTab(tab) {
  activeTab.value = tab
  tabSwitchKey.value++
  nextTick(() => {
    if (tab === 'geofence' && map.value) {
      map.value.invalidateSize()
      renderGeofencesOnMap()
    }
    if (tab === 'dashboard' && mapMini.value) {
      mapMini.value.invalidateSize()
    }
    if (tab === 'events' && id.value) {
      getEvents(id.value)
    }
    if (tab === 'calendar') {
      loadCalendarData()
    }
  })
}

// map instances

const map = ref(null)
const marker = ref(null)
const mapMini = ref(null)
const miniMarker = ref(null)

// custom marker persisted in localstorage
const customMarkerUrl = ref(localStorage.getItem('sw_custom_marker') || '')

function buildIcon(url, scale = 1) {
  const sz = Math.round(38 * scale)
  return L.icon({
    iconUrl: url || 'https://i.gyazo.com/2c2f86cbde1c24b59b380f1da714df48.png',
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
    popupAnchor: [0, -(sz / 2 + 4)],
    shadowUrl: null,
  })
}

// update both map markers when custom icon changes
watch(customMarkerUrl, (newUrl) => {
  const icon = buildIcon(newUrl)
  if (marker.value) marker.value.setIcon(icon)
  if (miniMarker.value) miniMarker.value.setIcon(icon)
})

// status / events / user data

const events = ref([])

const status = ref({
  id: 0,
  user_id: '',
  longitude: 0,
  latitude: 0,
  battery: 75, // HARDCODED — live value commented out
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

// geofence state

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
// add-zone mode: map clicks only place a marker when this is true
const addZoneMode = ref(false)

let geofenceMessageTimer = null

// zone type presets and colors

const ZONE_PRESETS = [
  { id: 'home',     label: 'Home'      },
  { id: 'work',     label: 'Work'      },
  { id: 'school',   label: 'School'    },
  { id: 'hospital', label: 'Hospital'  },
  { id: 'pharmacy', label: 'Pharmacy'  },
  { id: 'park',     label: 'Park'      },
  { id: 'grocery',  label: 'Grocery'   },
  { id: 'gym',      label: 'Gym'       },
  { id: 'other',    label: 'Other'     },
]

const ZONE_COLORS = {
  home:     '#4f8ff7',
  work:     '#a855f7',
  school:   '#f59e0b',
  hospital: '#ef4444',
  pharmacy: '#10b981',
  park:     '#22c55e',
  grocery:  '#f97316',
  gym:      '#06b6d4',
  other:    '#71717a',
}

// Lucide SVG path data (24×24 viewBox, no fill, stroke=white applied via wrapper)
const ZONE_SVG = {
  home:     `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
  work:     `<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>`,
  school:   `<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>`,
  hospital: `<path d="M12 7v4"/><path d="M14 9h-4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"/>`,
  pharmacy: `<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>`,
  park:     `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`,
  grocery:  `<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>`,
  gym:      `<path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m9.6 14.4 4.8-4.8"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/>`,
  other:    `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`,
}

const selectedZoneType = ref('home')
const customZoneName   = ref('')

// zone preset icon component map (for template rendering)
const ZONE_ICON_COMPONENT = {
  home: Home, work: Briefcase, school: GraduationCap,
  hospital: Hospital, pharmacy: Pill, park: Leaf,
  grocery: ShoppingCart, gym: Dumbbell, other: MapPin,
}

function detectZoneType(name) {
  const lower = (name || '').toLowerCase().trim()
  const match = ZONE_PRESETS.find(p => p.id !== 'other' && p.label.toLowerCase() === lower)
  return match ? match.id : 'other'
}

function buildZoneDivIcon(zoneType, scale = 1) {
  const sz  = Math.round(40 * scale)
  const isz = Math.round(19 * scale)
  const bw  = Math.max(1.5, 2.5 * scale).toFixed(1)
  const color = ZONE_COLORS[zoneType] || ZONE_COLORS.other
  const paths = ZONE_SVG[zoneType]   || ZONE_SVG.other
  const pinHtml =
    `<div style="width:${sz}px;height:${sz}px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:${color};border:${bw}px solid rgba(255,255,255,0.9);box-shadow:0 6px 20px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">`
    + `<svg style="transform:rotate(45deg)" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="${isz}" height="${isz}">${paths}</svg>`
    + `</div>`
  return L.divIcon({
    html: pinHtml,
    className: '',
    iconSize:   [sz, sz],
    iconAnchor: [sz / 2, sz],
    popupAnchor:[0, -(sz + 4)],
  })
}

// map tile layer toggle

const mapTileMode = ref('dark')
let geoTileLayer = null

const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    opts: { subdomains: 'abcd', maxZoom: 19, attribution: '© SenseWay 2026', updateWhenIdle: true, keepBuffer: 4, updateWhenZooming: false },
  },
  map: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    opts: { subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap · © CARTO', updateWhenIdle: true, keepBuffer: 4, updateWhenZooming: false },
  },
}

function playZoneSaveSound() {
  try {
    const ctx = new (window.AudioContext || window['webkitAudioContext'])()
    // gentle ascending chime: C5 → E5 → G5
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
      osc.start(t); osc.stop(t + 0.5)
    })
  } catch (_) {}
}

function openGoogleMaps() {
  const lat = status.value?.latitude
  const lon = status.value?.longitude
  if (lat == null || lon == null) return
  window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank', 'noopener')
}

function switchTileLayer(mode) {
  if (!map.value) return
  // freeze the current view — prevents any drift during layer swap
  const center = map.value.getCenter()
  const zoom   = map.value.getZoom()

  if (geoTileLayer) {
    map.value.removeLayer(geoTileLayer)
    geoTileLayer = null
  }

  const { url, opts } = TILE_LAYERS[mode] || TILE_LAYERS.dark
  geoTileLayer = L.tileLayer(url, { ...opts, keepBuffer: 4 })
  geoTileLayer.addTo(map.value)
  geoTileLayer.bringToBack()
  mapTileMode.value = mode

  // restore exact view in case leaflet drifted during the swap
  map.value.setView(center, zoom, { animate: false })
}

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

// clamp radius between 25m and 1km
watch(geofenceRadius, (v) => {
  if (v < 25) geofenceRadius.value = 25
  else if (v > 1000) geofenceRadius.value = 1000
})

// reverse geocoding

const nearestPlace = ref({
  name: '', road: '', building: '', neighbourhood: '',
  city: '', state: '', country: '', postcode: '',
  buildingName: '', buildingType: '',
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

const coordinatesText = computed(() => {
  const lat = status.value.latitude
  const lon = status.value.longitude
  if (!lat && !lon) return '—'
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
})

// country flag badge — uses Wikimedia flag SVGs for known countries, falls back to ISO text
const FLAG_URLS = {
  CA: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Flag_of_Canada_%28Pantone%29.svg',
  US: 'https://upload.wikimedia.org/wikipedia/en/a/a4/Flag_of_the_United_States.svg',
  MX: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Flag_of_Mexico.svg',
  GB: 'https://upload.wikimedia.org/wikipedia/en/a/ae/Flag_of_the_United_Kingdom.svg',
  AU: 'https://upload.wikimedia.org/wikipedia/en/b/b9/Flag_of_Australia.svg',
  IN: 'https://upload.wikimedia.org/wikipedia/en/4/41/Flag_of_India.svg',
  FR: 'https://upload.wikimedia.org/wikipedia/en/c/c3/Flag_of_France.svg',
  DE: 'https://upload.wikimedia.org/wikipedia/en/b/ba/Flag_of_Germany.svg',
}
const countryCode = computed(() => {
  const c = (nearestPlace.value.country || '').toLowerCase()
  if (c.includes('canada'))                               return { code: 'CA', color: '#d52b1e', flag: FLAG_URLS.CA }
  if (c.includes('united states') || c.includes('usa'))  return { code: 'US', color: '#3c3b6e', flag: FLAG_URLS.US }
  if (c.includes('mexico'))                              return { code: 'MX', color: '#006847', flag: FLAG_URLS.MX }
  if (c.includes('united kingdom') || c.includes('great britain')) return { code: 'GB', color: '#012169', flag: FLAG_URLS.GB }
  if (c.includes('australia'))                           return { code: 'AU', color: '#00008b', flag: FLAG_URLS.AU }
  if (c.includes('india'))                               return { code: 'IN', color: '#ff9933', flag: FLAG_URLS.IN }
  if (c.includes('france'))                              return { code: 'FR', color: '#002395', flag: FLAG_URLS.FR }
  if (c.includes('germany') || c.includes('deutschland')) return { code: 'DE', color: '#000000', flag: FLAG_URLS.DE }
  if (c.includes('cuba'))                                return { code: 'CU', color: '#002a8f', flag: null }
  if (c.includes('bahamas'))                             return { code: 'BS', color: '#00778b', flag: null }
  if (c.includes('jamaica'))                             return { code: 'JM', color: '#000000', flag: null }
  if (c.includes('greenland'))                           return { code: 'GL', color: '#003f87', flag: null }
  return null
})

// weather + location details

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

const WeatherIconComponent = computed(() => {
  const c = weatherData.value.code
  if (c == null) return Cloud
  if (c === 0) return Sun
  if (c <= 3) return CloudSun
  if (c <= 48) return CloudFog
  if (c <= 55) return CloudDrizzle
  if (c <= 65) return CloudRain
  if (c <= 77 || (c >= 85 && c <= 86)) return CloudSnow
  if (c >= 95) return CloudLightning
  return Cloud
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
let lastGeocodeCoords = { lat: null, lon: null }

async function fetchNearestPlace(lat, lon) {
  if (lat == null || lon == null) return
  // throttle to once per 10 seconds
  if (Date.now() - lastGeocodeFetch < 10000) return
  // skip if position moved less than ~55 m (0.0005°) — avoids redundant calls
  if (lastGeocodeCoords.lat != null) {
    const dlat = Math.abs(lat - lastGeocodeCoords.lat)
    const dlon = Math.abs(lon - lastGeocodeCoords.lon)
    if (dlat < 0.0005 && dlon < 0.0005) return
  }
  lastGeocodeFetch = Date.now()
  lastGeocodeCoords = { lat, lon }
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&extratags=1&namedetails=1`,
    )
    if (!resp.ok) return
    const data = await resp.json()
    const a = data.address || {}
    const ex = data.extratags || {}
    // building/place name: prefer the feature name, then address amenity
    const featureName = data.name || a.amenity || a.shop || a.leisure || a.tourism || a.office || ''
    // human-readable building type label
    const rawType = data.type || data.category || ''
    const TYPE_LABELS = {
      university: 'University', college: 'College', school: 'School',
      hospital: 'Hospital', clinic: 'Clinic', pharmacy: 'Pharmacy',
      library: 'Library', museum: 'Museum', park: 'Park',
      restaurant: 'Restaurant', cafe: 'Café', fast_food: 'Fast Food',
      supermarket: 'Supermarket', convenience: 'Convenience Store',
      office: 'Office', commercial: 'Commercial', retail: 'Retail',
      hotel: 'Hotel', gym: 'Gym', sports_centre: 'Sports Centre',
      stadium: 'Stadium', theatre: 'Theatre', cinema: 'Cinema',
      bank: 'Bank', atm: 'ATM', post_office: 'Post Office',
      taxi: 'Taxi Stand', bus_station: 'Bus Station', railway: 'Train Station',
      fuel: 'Gas Station', parking: 'Parking', building: 'Building',
    }
    const buildingType = ex['building:use'] || ex['amenity'] || TYPE_LABELS[rawType] || ''
    nearestPlace.value = {
      name:          featureName,
      buildingName:  ex['name'] || ex['official_name'] || featureName,
      buildingType,
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

// computed vitals

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
  // HARDCODED to 75% — live backend value commented out
  return 75
  // const v = Number(status.value.battery)
  // if (Number.isNaN(v) || v < 0) return 0
  // return Math.min(v, 100)
})


const batteryTextColor = computed(() => {
  // HARDCODED — always green to match 75% hardcoded battery
  return '#4ade80'
  // const p = batteryPercentage.value
  // if (p > 51) return '#4ade80'
  // if (p >= 10) return '#fbbf24'
  // return '#f87171'
})

const heartRateProgress = computed(() => {
  const hr = Number(status.value.heart_rate)
  if (!hr || Number.isNaN(hr)) return 0
  // map 40–180 bpm → 0–100%
  return Math.min(Math.max(((hr - 40) / 140) * 100, 4), 100)
})

const heartRateArcColor = computed(() => {
  const hr = Number(status.value.heart_rate)
  if (!hr || Number.isNaN(hr)) return 'rgba(255,255,255,0.15)'
  if (hr >= 60 && hr <= 100) return '#22c55e'
  if (hr > 100 && hr <= 140) return '#f59e0b'
  return '#ef4444'
})

const isAlertEvent = (event) => {
  if (!event) return false
  const type = (event.type || '').toLowerCase()
  const name = (event.name || '').toLowerCase()
  return type.includes('fall') || type.includes('sos') || name.includes('fall') || name.includes('sos')
}

// ── haversine distance (metres) ──
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── current geofence status ──
const currentGeofenceStatus = computed(() => {
  const lat = status.value?.latitude
  const lon = status.value?.longitude
  if (!lat || !lon || (lat === 0 && lon === 0)) return null
  if (!geofences.value.length) return { inside: false, fence: null, distance: null }
  let nearest = null, nearestDist = Infinity
  for (const fence of geofences.value) {
    const dist = haversineDistance(lat, lon, fence.latitude, fence.longitude)
    if (dist <= Number(fence.radius)) return { inside: true, fence, distance: Math.round(dist) }
    if (dist < nearestDist) { nearestDist = dist; nearest = fence }
  }
  return { inside: false, fence: nearest, distance: Math.round(nearestDist) }
})

// ── events tab stats ──
const eventStats = computed(() => {
  const all = events.value
  const counts = {}
  all.forEach(e => {
    const t = e.type || 'Unknown'
    counts[t] = (counts[t] || 0) + 1
  })
  const sos = all.filter(e => (e.type || '').toLowerCase().includes('sos') || (e.name || '').toLowerCase().includes('sos')).length
  const fall = all.filter(e => (e.type || '').toLowerCase().includes('fall') || (e.name || '').toLowerCase().includes('fall')).length
  const battery = all.filter(e => (e.type || '').toLowerCase().includes('battery')).length
  const geofenceEvts = all.filter(e => (e.type || '').toLowerCase().includes('geofence')).length
  const other = all.length - sos - fall - battery - geofenceEvts
  const breakdown = [
    { label: 'SOS',       count: sos,          color: '#ef4444' },
    { label: 'Fall',      count: fall,         color: '#f97316' },
    { label: 'Battery',   count: battery,      color: '#f59e0b' },
    { label: 'Geofence',  count: geofenceEvts, color: '#4f8ff7' },
    { label: 'Other',     count: Math.max(0, other), color: '#71717a' },
  ].filter(b => b.count > 0)
  const maxCount = Math.max(...breakdown.map(b => b.count), 1)
  return { total: all.length, sos, fall, battery, geofenceEvts, breakdown, maxCount, counts }
})

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

// api fetchers

async function getUserInfo(newID) {
  const uid = (newID || '').trim()
  if (!uid) return
  try {
    const response = await fetch(`${url}/user?user_id=${uid}`, { credentials: 'include' })
    if (!response.ok) throw new Error(`status: ${response.status}`)
    const data = await response.json()
    userInfo.value = data
    // sync avatar from DB (overrides localStorage fallback)
    if (data.avatar_url) saveProfilePic(data.avatar_url)
    // trigger home geo label fetch on first load
    if (data.home_lat) fetchHomeGeoLabel(data.home_lat, data.home_long)
  } catch (error) {
    console.error('user info fetch failed:', error.message)
  }
}

async function getEvents(currentId) {
  if (!currentId) return
  try {
    const response = await fetch(`${url}/events?user_id=${currentId}&quantity=100`)
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
    const data = await response.json()
    // HARDCODED battery — live battery value from backend is ignored
    status.value = { ...data, battery: 75 }
    lastDataReceived.value = Date.now()
    const lat = status.value.latitude
    const lon = status.value.longitude
    if (lat == null || lon == null || (lat === 0 && lon === 0)) return
    initializeOrUpdateMap(lat, lon)
    initMiniMap(lat, lon)
    fetchNearestPlace(lat, lon)
    fetchWeather(lat, lon)
  } catch (error) {
    console.error('status fetch failed:', error.message)
  }
}

// map: geofence (full)

function initializeOrUpdateMap(lat, lon) {
  const mapElement = document.getElementById('map')
  if (!mapElement) return

  if (map.value) {
    // Don't reset zoom/pan — user may be zoomed in; just move the marker
    if (marker.value) marker.value.setLatLng([lat, lon])
    else marker.value = L.marker([lat, lon], { icon: buildIcon(customMarkerUrl.value) }).addTo(map.value)
  } else {
    try {
      map.value = L.map('map', { preferCanvas: true }).setView([lat, lon], 17)
      const { url, opts } = TILE_LAYERS[mapTileMode.value] || TILE_LAYERS.dark
      geoTileLayer = L.tileLayer(url, opts).addTo(map.value)
      geoTileLayer.bringToBack()
      marker.value = L.marker([lat, lon], { icon: buildIcon(customMarkerUrl.value, currentZoomScale) }).addTo(map.value)
      map.value.on('zoomend', updateMarkerScales)
    } catch (err) {
      console.error('map init failed:', err)
    }
  }

  if (map.value) {
    map.value.off('click', handleMapClick)
    map.value.on('click', handleMapClick)
  }
}

// map: dashboard (mini)

function initMiniMap(lat, lon) {
  const el = document.getElementById('map-mini')
  if (!el) return

  if (mapMini.value) {
    if (miniMarker.value) miniMarker.value.setLatLng([lat, lon])
    else miniMarker.value = L.marker([lat, lon], { icon: buildIcon(customMarkerUrl.value) }).addTo(mapMini.value)
    // pan only if the new position is outside the visible bounds
    if (!mapMini.value.getBounds().contains([lat, lon])) {
      mapMini.value.panTo([lat, lon], { animate: true, duration: 0.5 })
    }
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
        zoomAnimation: false,
      }).setView([lat, lon], 15, { animate: false })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 4,
      }).addTo(mapMini.value)
      miniMarker.value = L.marker([lat, lon], { icon: buildIcon(customMarkerUrl.value) }).addTo(mapMini.value)
    } catch (err) {
      console.error('mini map init failed:', err)
    }
  }
}

// geofence: map helpers

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
  fencePrints.clear()
  geofenceIconLayers.forEach((m) => {
    if (map.value && m) map.value.removeLayer(m)
  })
  geofenceIconLayers.clear()
}

function resetGeofenceDraft() {
  clearGeofenceDraftLayers()
  geofence.value = null
  selectedGeofenceId.value = null
  geofenceRadius.value = 100
  selectedZoneType.value = 'home'
  customZoneName.value = ''
  geofenceName.value = 'Home'
  addZoneMode.value = false
  isTimedFence.value    = false
  fenceStartAt.value    = ''
  fenceEndAt.value      = ''
  fenceTimedTitle.value = ''
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

// auto-populate name when preset changes
watch(selectedZoneType, (type) => {
  if (type !== 'other') {
    const preset = ZONE_PRESETS.find(p => p.id === type)
    if (preset) geofenceName.value = preset.label
  }
  // update the marker icon live if marker is already placed
  if (geofenceMarker.value && map.value) {
    geofenceMarker.value.setIcon(buildZoneDivIcon(type))
  }
})

function applyGeofenceDraft(latlng) {
  if (!map.value) return
  const icon = buildZoneDivIcon(selectedZoneType.value)
  if (!geofenceMarker.value) {
    geofenceMarker.value = L.marker(latlng, { icon, draggable: true }).addTo(map.value)
    geofenceMarker.value.on('drag', (e) => updateGeofenceCircle(e.target.getLatLng()))
  } else {
    geofenceMarker.value.setLatLng(latlng)
    geofenceMarker.value.setIcon(icon)
  }
  updateGeofenceCircle(latlng)
}

function handleMapClick(e) {
  if (!addZoneMode.value) return
  if (geofenceSaving.value || geofenceDeleting.value) return
  geofenceSaveMessage.value = ''
  geofenceSaveMessageType.value = ''
  applyGeofenceDraft(e.latlng)
  // auto-exit add mode once marker placed
  addZoneMode.value = false
}

function enterAddZoneMode() {
  // reset any existing draft when starting fresh
  clearGeofenceDraftLayers()
  geofence.value = null
  selectedGeofenceId.value = null
  geofenceRadius.value = 100
  selectedZoneType.value = 'home'
  customZoneName.value = ''
  geofenceName.value = 'Home'
  addZoneMode.value = true
  renderGeofencesOnMap()
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

// track saved-fence icon markers separately
const geofenceIconLayers = new Map()
// fingerprint per fence to skip needless redraws
const fencePrints = new Map()
// current zoom-based scale applied to all markers
let currentZoomScale = 1

// build a string fingerprint for a fence — used to detect changes without full redraw
function fencePrint(fence, isSelected) {
  return `${fence.latitude},${fence.longitude},${fence.radius},${fence.name},${isSelected}`
}

function renderGeofencesOnMap() {
  if (!map.value) return

  const knownIds = new Set(geofences.value.map((f) => f.id))

  // remove layers for fences that no longer exist
  geofenceLayers.forEach((layer, id) => {
    if (!knownIds.has(id)) {
      map.value.removeLayer(layer)
      geofenceLayers.delete(id)
      fencePrints.delete(id)
    }
  })
  geofenceIconLayers.forEach((m, id) => {
    if (!knownIds.has(id)) {
      map.value.removeLayer(m)
      geofenceIconLayers.delete(id)
    }
  })

  geofences.value.forEach((fence) => {
    if (!fence?.id) return
    const isSelected = selectedGeofenceId.value === fence.id
    const print = fencePrint(fence, isSelected)

    // skip unchanged fences — no flicker, no wasted work
    if (fencePrints.get(fence.id) === print && geofenceLayers.has(fence.id)) return

    // remove old layers for this fence before replacing
    const prev = geofenceLayers.get(fence.id)
    if (prev) map.value.removeLayer(prev)
    const prevIcon = geofenceIconLayers.get(fence.id)
    if (prevIcon) map.value.removeLayer(prevIcon)

    const zoneType = detectZoneType(fence.name)
    const zoneColor = ZONE_COLORS[zoneType] || ZONE_COLORS.other

    const layer = L.circle([fence.latitude, fence.longitude], {
      radius: Number(fence.radius),
      color:       isSelected ? '#f97316' : zoneColor,
      fillColor:   isSelected ? '#fb923c' : zoneColor,
      fillOpacity: 0.15,
      weight:      isSelected ? 3 : 2,
    }).addTo(map.value)

    const iconMarker = L.marker([fence.latitude, fence.longitude], {
      icon: buildZoneDivIcon(zoneType, currentZoomScale),
      interactive: false,
    }).addTo(map.value)

    geofenceIconLayers.set(fence.id, iconMarker)
    layer.bindPopup(buildGeofencePopupHTML(fence))
    layer.on('click', () => selectExistingGeofence(fence.id, false))
    layer.on('popupopen', () => {
      const editBtn = document.getElementById(`geofence-edit-${fence.id}`)
      if (editBtn) editBtn.onclick = () => selectExistingGeofence(fence.id, true)
      const delBtn = document.getElementById(`geofence-delete-${fence.id}`)
      if (delBtn) delBtn.onclick = () => deleteSelectedGeofence(fence.id)
    })
    geofenceLayers.set(fence.id, layer)
    fencePrints.set(fence.id, print)
  })
}

// scale factor based on zoom level (base zoom 17)
function getZoomScale(zoom) {
  return Math.max(0.5, Math.min(2.0, zoom / 17))
}

// update all marker icons when zoom changes — markers scale with the map
function updateMarkerScales() {
  if (!map.value) return
  currentZoomScale = getZoomScale(map.value.getZoom())
  if (marker.value) marker.value.setIcon(buildIcon(customMarkerUrl.value, currentZoomScale))
  geofenceIconLayers.forEach((m, id) => {
    const fence = geofences.value.find((f) => f.id === id)
    if (fence) m.setIcon(buildZoneDivIcon(detectZoneType(fence.name), currentZoomScale))
  })
  if (geofenceMarker.value) {
    geofenceMarker.value.setIcon(buildZoneDivIcon(selectedZoneType.value, currentZoomScale))
  }
}

function selectExistingGeofence(fenceId, closePopup = false) {
  const selected = geofences.value.find((item) => item.id === fenceId)
  if (!selected) return
  selectedGeofenceId.value = selected.id
  geofence.value = { ...selected }
  geofenceRadius.value = Number(selected.radius)
  geofenceName.value = selected.name || 'Home'
  const detectedType = detectZoneType(selected.name)
  selectedZoneType.value = detectedType
  if (detectedType === 'other') customZoneName.value = selected.name || ''
  else customZoneName.value = ''
  applyGeofenceDraft({ lat: selected.latitude, lng: selected.longitude })
  renderGeofencesOnMap()
  if (closePopup) geofenceLayers.get(selected.id)?.closePopup()
}

// geofence: crud

async function fetchGeofences() {
  const userId = (id.value || '').trim()
  if (!userId) return
  geofenceLoading.value = true
  try {
    const result = await listGeofences(userId)
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
  const finalName = selectedZoneType.value === 'other'
    ? normalizeGeofenceName(customZoneName.value)
    : normalizeGeofenceName(geofenceName.value)
  const isTimed = isTimedFence.value && fenceStartAt.value && fenceEndAt.value && fenceTimedTitle.value.trim()
  const payload = {
    user_id: id.value,
    name: finalName,
    // timed fences start disabled; checkTimedFences activates them on schedule
    enabled: isTimed ? false : true,
    latitude: markerLatLng.lat,
    longitude: markerLatLng.lng,
    radius,
    ...(geofenceId
      ? {
          set_timed: true,
          starts_at: isTimed ? new Date(fenceStartAt.value).toISOString() : null,
          ends_at:   isTimed ? new Date(fenceEndAt.value).toISOString()   : null,
          timed_title: isTimed ? fenceTimedTitle.value.trim() : '',
        }
      : {
          starts_at: isTimed ? new Date(fenceStartAt.value).toISOString() : null,
          ends_at:   isTimed ? new Date(fenceEndAt.value).toISOString()   : null,
          timed_title: isTimed ? fenceTimedTitle.value.trim() : '',
        }),
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
    playZoneSaveSound()
  } catch (error) {
    const msg = error?.message || 'unknown error'
    showGeofenceMessage(`Failed to save: ${msg}`, 'error')
    console.error('saveGeofence failed:', error)
  } finally {
    geofenceSaving.value = false
  }
}

async function deleteAllGeofences() {
  if (!id.value || geofenceDeleting.value || geofenceSaving.value) return
  const all = [...geofences.value]
  if (!all.length) return
  geofenceDeleting.value = true
  geofenceSaveMessage.value = ''
  try {
    await Promise.all(all.map(f => deleteGeofenceApi(f.id, id.value)))
    clearAllGeofenceLayers()
    clearGeofenceDraftLayers()
    geofences.value = []
    geofence.value = null
    selectedGeofenceId.value = null
    addZoneMode.value = false
    showGeofenceMessage('All zones deleted.', 'success')
  } catch (error) {
    showGeofenceMessage('Failed to delete all zones.', 'error')
  } finally {
    geofenceDeleting.value = false
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

// calendar state

const calendarAppointments = ref([])
// timed fences are derived from geofences that have a starts_at field (server-stored)
const calendarTimedFences = computed(() =>
  geofences.value
    .filter(f => f.starts_at)
    .map(f => ({
      id: f.id,
      fenceServerId: f.id,
      title: f.timed_title || f.name,
      startAt: f.starts_at,
      endAt: f.ends_at,
    }))
)

const showApptModal        = ref(false)
const apptModalDate        = ref(null)

const apptForm = ref({
  title: '', location: '', description: '', startAt: '', endAt: '', fenceId: null,
})

async function loadCalendarData() {
  const uid = id.value
  if (!uid) return
  try {
    calendarAppointments.value = await listAppointments(uid)
  } catch (_) {
    calendarAppointments.value = []
  }
}

function openApptModal(date) {
  // pre-fill start time to the given date at 9:00 AM
  const d = new Date(date)
  d.setHours(9, 0, 0, 0)
  // format as datetime-local string
  const pad = (n) => String(n).padStart(2,'0')
  const iso = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  apptForm.value = { title:'', location:'', description:'', startAt:iso, endAt:'', fenceId:null }
  apptModalDate.value = date
  showApptModal.value = true
}

async function saveAppt() {
  const uid = id.value
  if (!uid || !apptForm.value.title.trim() || !apptForm.value.startAt) return
  showApptModal.value = false
  try {
    await createAppointmentApi({
      user_id: uid,
      title: apptForm.value.title.trim(),
      location: apptForm.value.location.trim(),
      description: apptForm.value.description.trim(),
      start_at: new Date(apptForm.value.startAt).toISOString(),
      end_at: apptForm.value.endAt ? new Date(apptForm.value.endAt).toISOString() : null,
      fence_id: apptForm.value.fenceId || null,
    })
    loadCalendarData()
  } catch (e) {
    console.error('Failed to save appointment:', e)
  }
}

async function deleteAppt(apptId) {
  try {
    await deleteAppointmentApi(apptId, id.value)
    loadCalendarData()
  } catch (e) {
    console.error('Failed to delete appointment:', e)
  }
}

// timed geofence state

const isTimedFence   = ref(false)
const fenceStartAt   = ref('')
const fenceEndAt     = ref('')
const fenceTimedTitle = ref('')

function minDateTimeLocal() {
  // minimum allowed: 5 minutes from now
  const d = new Date(Date.now() + 5 * 60 * 1000)
  const pad = (n) => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function deleteTimedFenceFromCalendar(fenceId) {
  const uid = id.value
  deleteGeofenceApi(fenceId, uid)
    .then(() => removeGeofenceFromState(fenceId))
    .catch(() => {})
}

// check timed fences every poll cycle — enable/disable based on current time
function checkTimedFences() {
  const uid = id.value
  if (!uid) return
  const now = new Date()
  for (const fence of geofences.value) {
    if (!fence.starts_at) continue
    const start = new Date(fence.starts_at)
    const end   = new Date(fence.ends_at)
    if (now >= start && now <= end && !fence.enabled) {
      // time window active — enable the fence
      updateGeofenceApi(fence.id, { user_id: uid, enabled: true })
        .then(() => { fence.enabled = true })
    } else if (now > end) {
      // expired — delete it from server and local state
      deleteGeofenceApi(fence.id, uid)
        .then(() => removeGeofenceFromState(fence.id))
    }
  }
}

// settings state

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

// lifecycle

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
    loadCalendarData()
    if (dataInterval) clearInterval(dataInterval)
    dataInterval = setInterval(() => {
      getEvents(userId)
      getStatus(userId)
      checkTimedFences()
    }, 3000)
  }
})

// re-render when geofences array is replaced — handles map/data race on first load
watch(geofences, () => renderGeofencesOnMap())

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
        checkTimedFences()
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
  if (map.value) { try { map.value.stop(); map.value.remove() } catch(_) {} map.value = null }
  if (mapMini.value) { try { mapMini.value.stop(); mapMini.value.remove() } catch(_) {} mapMini.value = null }
  marker.value = null
  miniMarker.value = null
  geofence.value = null
  geofences.value = []
  geoTileLayer = null
  if (topoAnimFrame) cancelAnimationFrame(topoAnimFrame)
})

// topography canvas background + loading screen
onMounted(() => {
  nextTick(() => {
    const canvas = topoCanvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let tick = 0

    function resize() {
      const w = window.innerWidth, h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // pause animation when tab is not visible to save resources
    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(topoAnimFrame)
        topoAnimFrame = null
      } else if (!topoAnimFrame) {
        drawTopo()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    function getH(x, t) {
      const s = 0.003
      return (
        Math.sin(x * s * 2 + t) * 30 +
        Math.sin(x * s * 3.7 + t * 0.7) * 20 +
        Math.sin(x * s * 1.3 - t * 0.5) * 40 +
        Math.sin(x * s * 5.1 + t * 1.2) * 10 +
        Math.sin(x * s * 0.7 + t * 0.3) * 50
      )
    }

    function drawTopo() {
      tick += 0.006
      const w = window.innerWidth, h = window.innerHeight
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(79,143,247,0.07)'
      ctx.lineWidth = 0.8
      ctx.lineCap = 'round'
      const n = 22
      const sp = h / (n - 1)
      for (let i = 0; i < n; i++) {
        const base = sp * i
        ctx.beginPath()
        let started = false
        for (let x = -60; x <= w + 60; x += 4) {
          const y = base + getH(x + i * 120, tick)
          if (!started) { ctx.moveTo(x, y); started = true }
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      topoAnimFrame = requestAnimationFrame(drawTopo)
    }
    drawTopo()
  })

  // typewriter
  const full = 'Initializing your dashboard...'
  let idx = 0
  const tw = setInterval(() => {
    if (idx < full.length) loadingTyped.value = full.slice(0, ++idx)
    else clearInterval(tw)
  }, 55)

  // progress bar fills over 2.8 s
  const t0 = Date.now()
  const prog = setInterval(() => {
    const elapsed = Date.now() - t0
    loadingProgress.value = Math.min((elapsed / 2800) * 100, 100)
    if (loadingProgress.value >= 100) clearInterval(prog)
  }, 40)

  // hide loading screen after 3 s
  setTimeout(() => { isLoading.value = false }, 3000)
})

// notifications + confirm dialog

let notifIdCounter = 0
const notifications = ref([])

function addNotification(type, title, message) {
  const id = ++notifIdCounter
  notifications.value.push({ id, type, title, message })
  setTimeout(() => {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }, 4500)
}

function dismissNotif(id) {
  notifications.value = notifications.value.filter((n) => n.id !== id)
}

const confirmDialog = ref({ show: false, title: '', message: '', disclaimer: '', onConfirm: null })

function showConfirm(title, message, disclaimer, onConfirm) {
  confirmDialog.value = { show: true, title, message, disclaimer, onConfirm }
}

function confirmOk() {
  if (confirmDialog.value.onConfirm) confirmDialog.value.onConfirm()
  confirmDialog.value.show = false
}

function confirmCancel() {
  confirmDialog.value.show = false
}

// avatar dropdown

const showAvatarMenu = ref(false)

function toggleAvatarMenu() {
  showAvatarMenu.value = !showAvatarMenu.value
}

function closeAvatarMenu() {
  showAvatarMenu.value = false
}

// profile picture

const profilePicUrl = ref(authStore.user?.avatar_url || localStorage.getItem('sw_profile_pic') || '')

function saveProfilePic(url) {
  profilePicUrl.value = url
  localStorage.setItem('sw_profile_pic', url)
}

// account editing

const editMode = ref(false)
const profilePicInput = ref('')
const avatarFileInputRef = ref(null)

function handleAvatarFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  if (file.size > 300 * 1024) {
    addNotification('error', 'Image too large', 'Please choose an image under 300 KB.')
    event.target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => { profilePicInput.value = e.target.result }
  reader.readAsDataURL(file)
}

const profileForm = ref({
  name: '', email: '', birth_date: '', newPassword: '', confirmPassword: '',
})

function openEditMode() {
  profileForm.value = {
    name: userInfo.value.name || authStore.user?.name || '',
    email: userInfo.value.email || authStore.user?.email || '',
    birth_date: userInfo.value.birth_date
      ? new Date(userInfo.value.birth_date).toISOString().slice(0, 10)
      : '',
    newPassword: '',
    confirmPassword: '',
  }
  profilePicInput.value = profilePicUrl.value
  editMode.value = true
}

function cancelEditMode() {
  editMode.value = false
}

async function doSaveProfile() {
  const f = profileForm.value
  if (f.newPassword && f.newPassword !== f.confirmPassword) {
    addNotification('error', 'Password mismatch', 'New password and confirmation do not match.')
    return
  }

  const payload = {
    user_id: id.value,
    email: f.email.trim(),
    name: f.name.trim(),
    type: userInfo.value.type || authStore.user?.type || '',
    birth_date: f.birth_date ? new Date(f.birth_date).toISOString() : new Date(userInfo.value.birth_date).toISOString(),
    home_long: userInfo.value.home_long || 0,
    home_lat: userInfo.value.home_lat || 0,
    avatar_url: profilePicInput.value || '',
    ...(f.newPassword ? { password: f.newPassword } : {}),
  }

  try {
    const resp = await fetch(`${url}/user`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.error || `Server error ${resp.status}`)
    }
    const updated = await resp.json()
    userInfo.value = { ...userInfo.value, ...updated }
    authStore.updateCachedUser({ name: updated.name, email: updated.email, avatar_url: updated.avatar_url })
    saveProfilePic(updated.avatar_url || '')
    editMode.value = false
    confettiRef.value?.fire()
    addNotification('success', 'Profile updated', 'Your account details have been saved successfully.')
  } catch (err) {
    addNotification('error', 'Update failed', err.message || 'Could not save changes.')
  }
}

function requestSaveProfile() {
  showConfirm(
    'Save Account Changes',
    'Are you sure you want to update your account information?',
    '⚠️ Ensure your details are accurate. This information may be used by emergency services.',
    doSaveProfile,
  )
}

// home location geocoding

const homeGeoLabel = ref('')

async function fetchHomeGeoLabel(lat, lon) {
  if (!lat || !lon || (lat === 0 && lon === 0)) return
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
    )
    if (!resp.ok) return
    const data = await resp.json()
    const a = data.address || {}
    const parts = [a.city || a.town || a.village || '', a.country || ''].filter(Boolean)
    homeGeoLabel.value = parts.join(', ')
  } catch (_) {}
}

watch(
  () => userInfo.value.home_lat,
  (lat) => {
    fetchHomeGeoLabel(lat, userInfo.value.home_long)
  },
  { immediate: false },
)

</script>

<template>
  <!-- Topography canvas background -->
  <canvas ref="topoCanvasRef" class="topo-canvas"></canvas>

  <!-- Confetti layer (fixed, pointer-events none) -->
  <AppConfetti ref="confettiRef" />

  <!-- notification toasts -->
  <Teleport to="body">
    <div class="notif-stack" role="region" aria-live="polite" aria-label="Notifications">
      <TransitionGroup name="notif">
        <div
          v-for="n in notifications"
          :key="n.id"
          :class="['notif-toast', `notif-toast--${n.type}`]"
          role="status"
        >
          <CheckCircle v-if="n.type === 'success'" :size="16" class="notif-icon" />
          <AlertTriangle v-else :size="16" class="notif-icon" />
          <div class="notif-body">
            <span class="notif-title">{{ n.title }}</span>
            <span v-if="n.message" class="notif-msg">{{ n.message }}</span>
          </div>
          <button class="notif-close" @click="dismissNotif(n.id)" :aria-label="'Dismiss: ' + n.title"><X :size="13" /></button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>

  <!-- confirm dialog -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="confirmDialog.show" class="modal-backdrop" @click.self="confirmCancel" role="alertdialog" aria-modal="true" :aria-labelledby="'modal-title'" :aria-describedby="'modal-desc'">
        <div class="modal-box">
          <div class="modal-head">
            <AlertTriangle :size="20" class="modal-icon" />
            <h3 class="modal-title" id="modal-title">{{ confirmDialog.title }}</h3>
          </div>
          <p class="modal-body" id="modal-desc">{{ confirmDialog.message }}</p>
          <p v-if="confirmDialog.warning" class="modal-warning">{{ confirmDialog.warning }}</p>
          <div class="modal-foot">
            <button class="btn btn-ghost" @click="confirmCancel">Cancel</button>
            <button class="btn btn-primary" @click="confirmOk">Confirm</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- 6-second loading screen -->
  <Transition name="loading-fade">
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-center">
        <div class="loading-logo-wrap">
          <div class="loading-logo-ring"></div>
          <img src="https://i.gyazo.com/465fb186323ea1edccb73b28fb4b8bd4.png" class="loading-logo" alt="SenseWay" />
        </div>
        <h1 class="loading-title">SenseWay</h1>
        <p class="loading-tagline">Smart Cane · Health Monitoring · Safety</p>
        <p class="loading-sub">{{ loadingTyped }}<span class="loading-cursor">|</span></p>
        <div class="loading-bar-track">
          <div class="loading-bar-fill" :style="{ width: loadingProgress + '%' }"></div>
        </div>
      </div>
    </div>
  </Transition>

  <div class="app-shell">

    <!-- ==================== sidebar ==================== -->
    <nav class="sidebar">
      <div class="sidebar-logo">
        <img src="https://i.gyazo.com/465fb186323ea1edccb73b28fb4b8bd4.png" class="logo-img" alt="SenseWay" />
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

        <button :class="['nav-btn', { 'nav-btn--active': activeTab === 'events' }]" @click="setTab('events')" title="Events" style="position:relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="events.some(e => isAlertEvent(e)) && activeTab !== 'events' ? 'icon-bell-ring' : ''">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <!-- red dot when there are unread alert events -->
          <span v-if="events.some(e => isAlertEvent(e)) && activeTab !== 'events'" class="nav-alert-dot"></span>
          <span class="nav-label">Events</span>
        </button>

        <button :class="['nav-btn', { 'nav-btn--active': activeTab === 'calendar' }]" @click="setTab('calendar')" title="Calendar">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span class="nav-label">Calendar</span>
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

          <!-- left: liquid page title -->
          <div class="topbar-left">
            <h1 class="page-title">{{ pageTitle }}</h1>
          </div>

          <!-- center: status pills -->
          <div class="topbar-center">
            <!-- LIVE -->
            <span class="tb-pill tb-pill--live">
              <span class="live-dot"></span>LIVE
            </span>

            <!-- signal strength -->
            <span class="tb-pill tb-pill--signal" :class="signalBars === 0 ? 'tb-pill--signal-off' : ''">
              <span class="signal-bars" :data-bars="signalBars" aria-label="Signal strength">
                <span class="signal-bar" :class="{ 'signal-bar--on': signalBars >= 1 }"></span>
                <span class="signal-bar" :class="{ 'signal-bar--on': signalBars >= 2 }"></span>
                <span class="signal-bar" :class="{ 'signal-bar--on': signalBars >= 3 }"></span>
              </span>
              <span class="tb-pill-val signal-label">{{ signalBars === 3 ? 'Strong' : signalBars === 2 ? 'Good' : signalBars === 1 ? 'Weak' : 'No Signal' }}</span>
            </span>

            <!-- battery -->
            <span class="tb-pill" :class="{ 'tb-pill--battery-warn': batteryPercentage < 20 }" :style="{ '--pill-accent': batteryTextColor }">
              <AnimatedBattery :percentage="batteryPercentage" :color="batteryTextColor" :size="14" />
              <span class="tb-pill-val" :style="{ color: batteryTextColor }">{{ batteryPercentage }}<span class="tb-pill-unit">%</span></span>
            </span>

            <!-- heart rate -->
            <span class="tb-pill" :style="{ '--pill-accent': currentHeartTextColor }">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="currentHeartTextColor" stroke-width="2.2" class="tb-pill-icon icon-heartbeat"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              <span class="tb-pill-val" :style="{ color: currentHeartTextColor }">{{ status.heart_rate || '—' }}<span v-if="status.heart_rate" class="tb-pill-unit"> bpm</span></span>
            </span>

            <!-- location -->
            <span v-if="locationShort" class="tb-pill tb-pill--loc">
              <span class="tb-loc-radar">
                <span class="tb-loc-ring"></span>
                <span class="tb-loc-dot"></span>
              </span>
              <span v-if="countryCode" class="tb-loc-country" :style="countryCode.flag ? {} : { background: countryCode.color }">
                <img v-if="countryCode.flag" :src="countryCode.flag" class="flag-img" :alt="countryCode.code" />
                <span v-else>{{ countryCode.code }}</span>
              </span>
              <span class="tb-loc-text">{{ locationShort }}</span>
            </span>
          </div>

          <!-- right: avatar -->
          <div class="topbar-right">
            <div class="avatar-wrap" @click="toggleAvatarMenu" v-click-outside="closeAvatarMenu">
              <div class="tb-avatar" :class="{ 'tb-avatar--active': showAvatarMenu }">
                <img v-if="profilePicUrl" :src="profilePicUrl" class="tb-avatar-img" alt="avatar" @error="(e) => e.target.style.display='none'" />
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
              </div>
              <div class="tb-user-info">
                <span class="tb-user-name">{{ authStore.user?.name || 'User' }}</span>
                <span class="tb-user-role">{{ authStore.user?.type || '—' }}</span>
              </div>
              <ChevronDown :size="14" class="tb-chevron" :class="{ 'tb-chevron--open': showAvatarMenu }" />

              <!-- dropdown -->
              <Transition name="dropdown">
                <div v-if="showAvatarMenu" class="avatar-dropdown" @click.stop>
                  <div class="avd-header">
                    <div class="avd-avatar">
                      <img v-if="profilePicUrl" :src="profilePicUrl" class="avd-avatar-img" alt="avatar" @error="(e) => e.target.style.display='none'" />
                      <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                    </div>
                    <div class="avd-info">
                      <span class="avd-name">{{ authStore.user?.name || 'User' }}</span>
                      <span class="avd-email">{{ authStore.user?.email || '' }}</span>
                    </div>
                  </div>
                  <div class="avd-divider"></div>
                  <button class="avd-item" @click="setTab('settings'); closeAvatarMenu()">
                    <Settings :size="14" />
                    <span>Settings</span>
                  </button>
                  <div class="avd-divider"></div>
                  <button class="avd-item avd-item--danger" @click="handleLogout">
                    <LogOut :size="14" />
                    <span>Log out</span>
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </header>

      <!-- ==================== tab content ==================== -->
      <main class="app-main">

        <!-- - - - - dashboard - - - - -->
        <div v-show="activeTab === 'dashboard'" class="tab-pane">

          <!-- welcome hero -->
          <div class="dash-hero">
            <div class="dash-hero-left">
              <p class="dash-hero-greet">Welcome back, <HyperText :text="authStore.user?.name?.split(' ')[0] || 'there'" :color-cycle="true" :trigger="tabSwitchKey" class="dash-hero-name" /></p>
              <div class="dash-hero-tagline">
                Monitoring <FlipWords :words="['every step.', 'vital signs.', 'real-time location.', 'safety zones.', 'health data.']" :duration="2600" color="#4f8ff7" />
                Keep <FlipWords :words="['them safe.', 'moving forward.', 'loved ones close.', 'track of everything.', 'peace of mind.']" :duration="3000" color="#a855f7" />
              </div>
            </div>
            <div class="dash-hero-right">
              <div class="dh-stat">
                <span class="dh-stat-val" :style="{ color: batteryTextColor }">{{ batteryPercentage }}<span class="dh-stat-unit">%</span></span>
                <span class="dh-stat-key">Battery</span>
              </div>
              <div class="dh-divider"></div>
              <div class="dh-stat">
                <span class="dh-stat-val" :style="{ color: currentHeartTextColor }">{{ status.heart_rate || '—' }}<span v-if="status.heart_rate" class="dh-stat-unit"> bpm</span></span>
                <span class="dh-stat-key">Heart Rate</span>
              </div>
              <div class="dh-divider"></div>
              <div class="dh-stat">
                <span class="dh-stat-val">{{ geofences.length }}</span>
                <span class="dh-stat-key">Safe Zones</span>
              </div>
            </div>
          </div>

          <div class="dash-grid">

            <!-- mini map + location details -->
            <div v-spotlight class="card card-map">
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
                <span v-if="countryCode" class="loc-country-code" :style="countryCode.flag ? {} : { background: countryCode.color }">
                  <img v-if="countryCode.flag" :src="countryCode.flag" class="flag-img" :alt="countryCode.code" />
                  <span v-else>{{ countryCode.code }}</span>
                </span>
                <span class="loc-address-text">
                  {{ [nearestPlace.name, nearestPlace.road, nearestPlace.city, nearestPlace.country].filter(Boolean).join(', ') || '—' }}
                </span>
                <button class="gmaps-btn" @click="openGoogleMaps" title="Open in Google Maps" type="button">
                  <img src="https://www.google.com/favicon.ico" class="gmaps-icon" alt="" />
                  Open in Maps
                </button>
              </div>

              <!-- location detail grid -->
              <div class="loc-detail-grid">
                <!-- neighbourhood -->
                <div v-if="nearestPlace.neighbourhood" class="loc-detail-item">
                  <span class="loc-detail-key"><Building2 :size="10" class="loc-dk-icon" /> Neighbourhood</span>
                  <span class="loc-detail-val"><HyperText :text="nearestPlace.neighbourhood" :trigger="tabSwitchKey" /></span>
                </div>
                <!-- road -->
                <div v-if="nearestPlace.road" class="loc-detail-item">
                  <span class="loc-detail-key"><Navigation2 :size="10" class="loc-dk-icon" /> Street</span>
                  <span class="loc-detail-val"><HyperText :text="nearestPlace.road" :trigger="tabSwitchKey" /></span>
                </div>
                <!-- postcode -->
                <div v-if="nearestPlace.postcode" class="loc-detail-item">
                  <span class="loc-detail-key"><Hash :size="10" class="loc-dk-icon" /> Postal Code</span>
                  <span class="loc-detail-val"><HyperText :text="nearestPlace.postcode" :trigger="tabSwitchKey" /></span>
                </div>
                <!-- state -->
                <div v-if="nearestPlace.state" class="loc-detail-item">
                  <span class="loc-detail-key"><Globe :size="10" class="loc-dk-icon" /> Province / State</span>
                  <span class="loc-detail-val"><HyperText :text="nearestPlace.state" :trigger="tabSwitchKey" /></span>
                </div>
                <!-- elevation -->
                <div v-if="weatherData.elevation != null" class="loc-detail-item">
                  <span class="loc-detail-key"><Mountain :size="10" class="loc-dk-icon" /> Elevation</span>
                  <span class="loc-detail-val"><HyperText :text="String(weatherData.elevation) + ' m'" :trigger="tabSwitchKey" /></span>
                </div>
                <!-- nearest building / place -->
                <div v-if="nearestPlace.name" class="loc-detail-item loc-detail-item--building">
                  <span class="loc-detail-key"><Building2 :size="10" class="loc-dk-icon" /> Nearest Place</span>
                  <span class="loc-detail-val loc-building-val">
                    <span class="loc-building-name"><HyperText :text="nearestPlace.name" :trigger="tabSwitchKey" /></span>
                    <span v-if="nearestPlace.buildingType" class="loc-building-type"><HyperText :text="nearestPlace.buildingType" :trigger="tabSwitchKey" /></span>
                  </span>
                </div>
                <!-- coordinates -->
                <div class="loc-detail-item">
                  <span class="loc-detail-key"><MapPin :size="10" class="loc-dk-icon" /> Coordinates</span>
                  <span class="loc-detail-val"><HyperText :text="coordinatesText" :trigger="tabSwitchKey" /></span>
                </div>
              </div>

              <!-- geofence status strip -->
              <div v-if="currentGeofenceStatus" :class="['gf-status-strip', currentGeofenceStatus.inside ? 'gf-status-strip--in' : 'gf-status-strip--out']">
                <div class="gf-status-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
                </div>
                <div class="gf-status-text">
                  <span v-if="currentGeofenceStatus.inside" class="gf-status-label">Within Safe Zone</span>
                  <span v-else class="gf-status-label">Outside All Safe Zones</span>
                  <span v-if="currentGeofenceStatus.fence" class="gf-status-sub">
                    <template v-if="currentGeofenceStatus.inside">{{ currentGeofenceStatus.fence.name }} · {{ currentGeofenceStatus.distance }}m from centre</template>
                    <template v-else>Nearest: {{ currentGeofenceStatus.fence.name }} ({{ currentGeofenceStatus.distance }}m away)</template>
                  </span>
                  <span v-else class="gf-status-sub">No zones configured yet</span>
                </div>
                <div class="gf-status-dot" :class="currentGeofenceStatus.inside ? 'gf-status-dot--in' : 'gf-status-dot--out'"></div>
              </div>

              <!-- weather strip -->
              <div v-if="weatherLabel" class="loc-weather-strip">
                <div class="loc-weather-row">
                  <div class="loc-wx-item">
                    <span class="loc-wx-key">
                      <component :is="WeatherIconComponent" :size="11" class="wx-icon" />
                      Weather
                    </span>
                    <span class="loc-wx-val"><HyperText :text="weatherLabel" :trigger="tabSwitchKey" /></span>
                  </div>
                  <div v-if="weatherData.temp != null" class="loc-wx-item">
                    <span class="loc-wx-key">
                      <Thermometer :size="11" class="wx-icon" />
                      Temperature
                    </span>
                    <span class="loc-wx-val"><HyperText :text="String(weatherData.temp) + '°C'" :trigger="tabSwitchKey" /></span>
                  </div>
                  <div v-if="weatherData.wind != null" class="loc-wx-item">
                    <span class="loc-wx-key">
                      <Wind :size="11" class="wx-icon" />
                      Wind
                    </span>
                    <span class="loc-wx-val"><HyperText :text="String(weatherData.wind) + ' km/h'" :trigger="tabSwitchKey" /></span>
                  </div>
                  <div v-if="weatherData.humidity != null" class="loc-wx-item">
                    <span class="loc-wx-key">
                      <Droplets :size="11" class="wx-icon" />
                      Humidity
                    </span>
                    <span class="loc-wx-val"><HyperText :text="String(weatherData.humidity) + '%'" :trigger="tabSwitchKey" /></span>
                  </div>
                </div>

                <!-- pavement condition -->
                <div v-if="pavementCondition" class="loc-pavement" :class="`loc-pavement--${pavementCondition.level}`">
                  <span class="loc-pavement-dot"></span>
                  <span class="loc-pavement-label">Pavement: <HyperText :text="pavementCondition.label" :trigger="tabSwitchKey" /></span>
                </div>
              </div>

            </div>

            <!-- metrics column -->
            <div class="metrics-col">
              <!-- battery -->
              <div v-spotlight class="card metric-card">
                <div class="card-head">
                  <div class="card-head-left">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="10" x="2" y="7" rx="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>
                    <span class="card-title">Battery</span>
                  </div>
                </div>
                <div class="metric-body metric-body--circular">
                  <CircularProgress :value="batteryPercentage" :size="120" :strokeWidth="9" :primaryColor="batteryTextColor" secondaryColor="rgba(255,255,255,0.07)">
                    <div class="cp-center-content">
                      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" :stroke="batteryTextColor" stroke-width="1.8"><rect width="16" height="10" x="2" y="7" rx="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>
                      <span class="cp-val" :style="{ color: batteryTextColor }">{{ batteryPercentage }}%</span>
                    </div>
                  </CircularProgress>
                </div>
              </div>

              <!-- heart rate -->
              <div v-spotlight class="card metric-card">
                <div class="card-head">
                  <div class="card-head-left">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                    <span class="card-title">Heart Rate</span>
                  </div>
                </div>
                <div class="metric-body metric-body--circular">
                  <CircularProgress :value="heartRateProgress" :size="120" :strokeWidth="9" :primaryColor="heartRateArcColor" secondaryColor="rgba(255,255,255,0.07)">
                    <div class="cp-center-content">
                      <div class="heart-wrap cp-heart">
                        <div class="heart-glow" :style="{ backgroundColor: currentHeartColor }"></div>
                        <img :src="currentHeartImage" class="heart-img" alt="heart" />
                      </div>
                      <span class="cp-val" :style="{ color: heartRateArcColor }">{{ status.heart_rate || '—' }}<span v-if="status.heart_rate" class="cp-unit"> bpm</span></span>
                    </div>
                  </CircularProgress>
                </div>
              </div>
            </div>

            <!-- profile card -->
            <div v-spotlight class="card card-profile">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                  <span class="card-title">Profile</span>
                </div>
              </div>
              <div class="profile-avatar-row">
                <div class="profile-avatar">
                  <img v-if="profilePicUrl" :src="profilePicUrl" class="profile-avatar-img" alt="avatar" @error="(e) => e.target.style.display='none'" />
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                </div>
                <div>
                  <div class="profile-name">{{ userInfo.name || authStore.user?.name || '—' }}</div>
                  <span class="profile-type-badge">{{ userInfo.type || authStore.user?.type || '—' }}</span>
                </div>
              </div>
              <div class="profile-grid">
                <div class="profile-item"><span class="pkey">Email</span><span class="pval"><HyperText :text="userInfo.email || authStore.user?.email || '—'" :trigger="tabSwitchKey" /></span></div>
                <div class="profile-item"><span class="pkey">Age</span><span class="pval"><HyperText :text="userAge != null ? userAge + ' yrs' : '—'" :trigger="tabSwitchKey" /></span></div>
                <div class="profile-item"><span class="pkey">Born</span><span class="pval"><HyperText :text="userInfo.birth_date ? new Date(userInfo.birth_date).toLocaleDateString() : '—'" :trigger="tabSwitchKey" /></span></div>
                <div class="profile-item"><span class="pkey">Member since</span><span class="pval"><HyperText :text="userInfo.created_at ? new Date(userInfo.created_at).toLocaleDateString() : '—'" :trigger="tabSwitchKey" /></span></div>
              </div>
            </div>

            <!-- events card -->
            <div v-spotlight class="card card-events">
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
                      <td class="ev-name"><HyperText :text="event.name" :trigger="tabSwitchKey" /></td>
                      <td>
                        <span
                          :class="['type-badge', isAlertEvent(event) ? 'type-badge--alert' : 'type-badge--ok']"
                          :style="isAlertEvent(event) ? { backgroundColor: currentAlertColor, transition: 'background-color 90ms linear' } : {}"
                        ><HyperText :text="event.type" :trigger="tabSwitchKey" /></span>
                      </td>
                      <td class="ev-desc"><HyperText :text="event.description || ''" :trigger="tabSwitchKey" /></td>
                      <td class="ev-time"><HyperText :text="new Date(event.created_at).toLocaleString()" :trigger="tabSwitchKey" /></td>
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
              <div class="gf-map-toolbar">
                <span class="gf-map-title">
                  <Layers :size="14" />
                  Safety Zone Map
                </span>
                <div class="map-layer-toggle">
                  <button
                    v-for="m in [{ id:'dark', label:'Dark' }, { id:'map', label:'Map' }]"
                    :key="m.id"
                    :class="['mlt-btn', { 'mlt-btn--active': mapTileMode === m.id }]"
                    @click="switchTileLayer(m.id)"
                    type="button"
                  >{{ m.label }}</button>
                </div>
              </div>
              <div id="map" class="full-map gf-leaflet-map"></div>
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

                <!-- ── idle state: no zone selected, not placing ── -->
                <div v-if="!geofenceMarker && !addZoneMode" class="gf-idle-state">
                  <p class="gf-idle-hint">Select a saved zone from the list below, or place a new one.</p>
                  <button class="btn btn-primary gf-place-btn" @click="enterAddZoneMode" type="button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
                    Place New Zone
                  </button>
                </div>

                <!-- ── add-mode: waiting for map click ── -->
                <div v-if="addZoneMode" class="gf-add-mode-banner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  Click anywhere on the map to place the zone marker.
                  <button class="gf-cancel-add" @click="addZoneMode = false" type="button">Cancel</button>
                </div>

                <!-- ── zone type picker (visible when placing or editing) ── -->
                <template v-if="geofenceMarker || addZoneMode">
                  <div class="field">
                    <label class="field-label">Zone Type</label>
                    <div class="zone-preset-grid">
                      <button
                        v-for="preset in ZONE_PRESETS"
                        :key="preset.id"
                        :class="['zone-preset-btn', { 'zone-preset-btn--active': selectedZoneType === preset.id }]"
                        :style="selectedZoneType === preset.id ? { '--pcolor': ZONE_COLORS[preset.id] } : {}"
                        @click="selectedZoneType = preset.id"
                        type="button"
                      >
                        <component :is="ZONE_ICON_COMPONENT[preset.id]" :size="14" />
                        <span>{{ preset.label }}</span>
                      </button>
                    </div>
                  </div>
                </template>

                <!-- ── name + radius + buttons (visible when marker is placed) ── -->
                <template v-if="geofenceMarker">
                  <div class="field">
                    <label class="field-label">
                      Zone Name
                      <span v-if="selectedZoneType !== 'other'" class="field-optional">(or type a custom name)</span>
                    </label>
                    <input
                      v-if="selectedZoneType === 'other'"
                      v-model.trim="customZoneName"
                      @input="geofenceName = customZoneName || 'Zone'"
                      type="text" maxlength="60" class="field-input" placeholder="e.g. My place"
                    />
                    <input
                      v-else
                      v-model.trim="geofenceName"
                      type="text" maxlength="60" class="field-input"
                      :placeholder="ZONE_PRESETS.find(p => p.id === selectedZoneType)?.label || 'Zone'"
                    />
                  </div>
                  <div class="field">
                    <div class="field-label-row">
                      <label class="field-label">Radius</label>
                      <span class="field-accent">{{ geofenceRadius }}m</span>
                    </div>
                    <input type="range" min="25" max="1000" step="25" v-model="geofenceRadius" @input="updateRadius" class="slider" />
                    <div class="slider-ticks"><span>25m</span><span>500m</span><span>1km</span></div>
                  </div>

                  <!-- timed zone toggle -->
                  <div class="field">
                    <label class="timed-toggle-row">
                      <div class="timed-toggle-track" :class="{ 'timed-toggle-track--on': isTimedFence }" @click="isTimedFence = !isTimedFence">
                        <div class="timed-toggle-thumb"></div>
                      </div>
                      <span class="field-label" style="margin-bottom:0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px;margin-right:4px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Timed Zone
                      </span>
                    </label>
                    <p class="field-hint">Schedule this zone to activate and deactivate automatically.</p>
                  </div>

                  <!-- timed zone fields (visible when timed is on) -->
                  <template v-if="isTimedFence">
                    <div class="field">
                      <label class="field-label">Zone Title (for calendar)</label>
                      <input v-model.trim="fenceTimedTitle" type="text" maxlength="80" class="field-input" placeholder="e.g. Doctor's Appointment Zone" />
                    </div>
                    <div class="field">
                      <label class="field-label">Activates At</label>
                      <input v-model="fenceStartAt" type="datetime-local" class="field-input" :min="minDateTimeLocal()" />
                    </div>
                    <div class="field">
                      <label class="field-label">Deactivates At</label>
                      <input v-model="fenceEndAt" type="datetime-local" class="field-input" :min="fenceStartAt || minDateTimeLocal()" />
                    </div>
                  </template>

                  <div class="gf-btns">
                    <button @click="saveGeofence" class="btn btn-primary" :disabled="geofenceSaving || geofenceDeleting">
                      {{ geofenceSaving ? 'Saving…' : geofence?.id ? 'Update Zone' : 'Save Zone' }}
                    </button>
                    <button @click="enterAddZoneMode" class="btn btn-ghost" :disabled="geofenceSaving || geofenceDeleting">+ New</button>
                    <button @click="deleteSelectedGeofence()" class="btn btn-danger" :disabled="!geofence?.id || geofenceSaving || geofenceDeleting">
                      {{ geofenceDeleting ? 'Removing…' : 'Delete' }}
                    </button>
                  </div>
                </template>

                <div v-if="geofenceSaveMessage" :class="['gf-msg', geofenceSaveMessageType === 'success' ? 'gf-msg--ok' : 'gf-msg--err']">
                  {{ geofenceSaveMessage }}
                </div>
              </div>

              <div class="gf-divider"></div>

              <div v-if="geofences.length" class="gf-zones">
                <div class="gf-zones-header">
                  <p class="gf-zones-title">Saved Zones</p>
                  <button
                    class="gf-remove-all"
                    :disabled="geofenceDeleting || geofenceSaving"
                    @click="showConfirm('Remove All Zones', 'This will permanently delete all ' + geofences.length + ' saved zones.', 'This cannot be undone.', deleteAllGeofences)"
                    type="button"
                  >Remove All</button>
                </div>
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

        <!-- - - - - events tab - - - - -->
        <div v-show="activeTab === 'events'" class="tab-pane tab-pane--events">
          <div class="ev-page">

            <!-- stat cards -->
            <div class="ev-stats-row">
              <div class="ev-stat-card" style="--i:0">
                <div class="ev-stat-icon" style="background:rgba(255,255,255,0.06)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </div>
                <span class="ev-stat-num"><HyperText :text="String(eventStats.total)" :trigger="tabSwitchKey" /></span>
                <span class="ev-stat-label">Total Events</span>
              </div>
              <div class="ev-stat-card ev-stat-card--alert" style="--i:1">
                <div class="ev-stat-icon" style="background:rgba(239,68,68,0.12)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                </div>
                <span class="ev-stat-num" style="color:#ef4444"><HyperText :text="String(eventStats.sos)" :trigger="tabSwitchKey" /></span>
                <span class="ev-stat-label">SOS</span>
              </div>
              <div class="ev-stat-card" style="--i:2">
                <div class="ev-stat-icon" style="background:rgba(249,115,22,0.12)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <span class="ev-stat-num" style="color:#f97316"><HyperText :text="String(eventStats.fall)" :trigger="tabSwitchKey" /></span>
                <span class="ev-stat-label">Falls</span>
              </div>
              <div class="ev-stat-card" style="--i:3">
                <div class="ev-stat-icon" style="background:rgba(245,158,11,0.12)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect width="16" height="10" x="2" y="7" rx="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>
                </div>
                <span class="ev-stat-num" style="color:#f59e0b"><HyperText :text="String(eventStats.battery)" :trigger="tabSwitchKey" /></span>
                <span class="ev-stat-label">Battery</span>
              </div>
              <div class="ev-stat-card" style="--i:4">
                <div class="ev-stat-icon" style="background:rgba(79,143,247,0.12)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f8ff7" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
                </div>
                <span class="ev-stat-num" style="color:#4f8ff7"><HyperText :text="String(eventStats.geofenceEvts)" :trigger="tabSwitchKey" /></span>
                <span class="ev-stat-label">Geofence</span>
              </div>
            </div>

            <div class="ev-main-row">

              <!-- bar chart -->
              <div v-spotlight class="card ev-chart-card" v-if="eventStats.breakdown.length">
                <div class="card-head">
                  <div class="card-head-left">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    <span class="card-title">Event Breakdown</span>
                  </div>
                </div>
                <div class="ev-chart">
                  <div v-for="bar in eventStats.breakdown" :key="bar.label" class="ev-bar-row">
                    <span class="ev-bar-label">{{ bar.label }}</span>
                    <div class="ev-bar-track">
                      <div
                        class="ev-bar-fill"
                        :style="{ width: (bar.count / eventStats.maxCount * 100) + '%', background: bar.color }"
                      ></div>
                    </div>
                    <span class="ev-bar-count">{{ bar.count }}</span>
                  </div>
                </div>
              </div>

              <!-- no-data placeholder -->
              <div v-spotlight class="card ev-chart-card ev-no-data" v-else>
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
                <p>No events recorded yet</p>
              </div>

              <!-- recent alerts -->
              <div v-spotlight class="card ev-alerts-card">
                <div class="card-head">
                  <div class="card-head-left">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    <span class="card-title">Critical Alerts</span>
                  </div>
                  <span v-if="eventStats.sos + eventStats.fall > 0" class="count-badge count-badge--alert">{{ eventStats.sos + eventStats.fall }}</span>
                </div>
                <div v-if="events.filter(e => isAlertEvent(e)).length === 0" class="events-empty">
                  <p style="font-size:12px;color:var(--dim)">No critical alerts</p>
                </div>
                <div v-else class="ev-alerts-list">
                  <div v-for="e in events.filter(ev => isAlertEvent(ev)).slice(0, 8)" :key="e.id" class="ev-alert-row">
                    <div class="ev-alert-dot"></div>
                    <div class="ev-alert-info">
                      <span class="ev-alert-name">{{ e.name }}</span>
                      <span class="ev-alert-time">{{ new Date(e.created_at).toLocaleString() }}</span>
                    </div>
                    <span class="type-badge type-badge--alert" :style="{ backgroundColor: currentAlertColor, transition: 'background-color 90ms linear' }">{{ e.type }}</span>
                  </div>
                </div>
              </div>

            </div>

            <!-- full events table -->
            <div v-spotlight class="card ev-table-card">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect width="6" height="4" x="9" y="3" rx="1"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>
                  <span class="card-title">All Events</span>
                </div>
                <span v-if="events.length" class="count-badge">{{ events.length }}</span>
              </div>
              <div v-if="!events.length" class="events-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".25"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
                <p>No events yet</p>
              </div>
              <div v-else class="events-table-wrap">
                <table class="events-table">
                  <thead><tr><th>Event</th><th>Type</th><th>Description</th><th>Time</th></tr></thead>
                  <tbody>
                    <tr v-for="event in events" :key="event.id">
                      <td class="ev-name"><HyperText :text="event.name" :trigger="tabSwitchKey" /></td>
                      <td>
                        <span
                          :class="['type-badge', isAlertEvent(event) ? 'type-badge--alert' : 'type-badge--ok']"
                          :style="isAlertEvent(event) ? { backgroundColor: currentAlertColor, transition: 'background-color 90ms linear' } : {}"
                        ><HyperText :text="event.type" :trigger="tabSwitchKey" /></span>
                      </td>
                      <td class="ev-desc"><HyperText :text="event.description || ''" :trigger="tabSwitchKey" /></td>
                      <td class="ev-time"><HyperText :text="new Date(event.created_at).toLocaleString()" :trigger="tabSwitchKey" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        <!-- - - - - calendar tab - - - - -->
        <div v-show="activeTab === 'calendar'" class="tab-pane tab-pane--calendar">
          <div class="cal-page">

            <div class="cal-layout">
              <!-- calendar main -->
              <div class="cal-main">
                <SpringCalendar
                  :sys-events="events"
                  :timed-fences="calendarTimedFences"
                  :appointments="calendarAppointments"
                  @add-appointment="openApptModal"
                  @delete-appointment="deleteAppt"
                  @delete-timed-fence="deleteTimedFenceFromCalendar"
                />
              </div>

              <!-- side panel: upcoming events -->
              <div class="cal-side">
                <div class="cal-side-head">
                  <h3 class="cal-side-title">Upcoming</h3>
                </div>
                <div class="cal-upcoming">
                  <!-- timed fences -->
                  <div v-if="calendarTimedFences.length" class="cal-upcoming-section">
                    <p class="cal-upcoming-label">Scheduled Zones</p>
                    <div v-for="tf in calendarTimedFences" :key="tf.id" class="cal-upcoming-item cal-upcoming-item--gf">
                      <div class="cal-upcoming-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                      <div class="cal-upcoming-body">
                        <p class="cal-upcoming-title">{{ tf.title }}</p>
                        <p class="cal-upcoming-sub">
                          {{ new Date(tf.startAt).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) }}
                          {{ new Date(tf.startAt).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',hour12:true}) }}
                          &#x2192; {{ new Date(tf.endAt).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',hour12:true}) }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- appointments -->
                  <div v-if="calendarAppointments.length" class="cal-upcoming-section">
                    <p class="cal-upcoming-label">Appointments</p>
                    <div v-for="a in calendarAppointments.slice().sort((x,y)=>new Date(x.startAt)-new Date(y.startAt))" :key="a.id" class="cal-upcoming-item cal-upcoming-item--appt">
                      <div class="cal-upcoming-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <div class="cal-upcoming-body">
                        <p class="cal-upcoming-title">{{ a.title }}</p>
                        <p v-if="a.location" class="cal-upcoming-sub">{{ a.location }}</p>
                        <p class="cal-upcoming-sub">
                          {{ new Date(a.startAt).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) }}
                          &#xB7; {{ new Date(a.startAt).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',hour12:true}) }}
                        </p>
                      </div>
                      <button class="cal-item-del" @click="deleteAppt(a.id)" type="button" title="Remove">&#x2715;</button>
                    </div>
                  </div>

                  <div v-if="!calendarTimedFences.length && !calendarAppointments.length" class="cal-upcoming-empty">
                    <p>No upcoming events scheduled.</p>
                    <p style="font-size:11px;opacity:0.5;margin-top:4px">Add appointments using the calendar, or create a timed zone in the Safety Zones tab.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- - - - - settings tab - - - - -->
        <div v-show="activeTab === 'settings'" class="tab-pane">
          <div class="settings-grid">

            <!-- account card -->
            <div v-spotlight class="card">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                  <span class="card-title">Account</span>
                </div>
                <button v-if="!editMode" class="btn-icon-sm" @click="openEditMode" title="Edit profile">
                  <Edit2 :size="14" />
                </button>
              </div>

              <!-- profile picture row -->
              <div class="profile-pic-row">
                <div class="profile-pic-avatar">
                  <img v-if="profilePicUrl" :src="profilePicUrl" class="profile-pic-img" alt="avatar" @error="(e) => e.target.style.display='none'" />
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".5"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                </div>
                <div class="profile-pic-info">
                  <span class="profile-pic-name">{{ userInfo.name || authStore.user?.name || 'User' }}</span>
                  <span class="profile-pic-role">{{ userInfo.type || authStore.user?.type || '—' }}</span>
                </div>
              </div>

              <!-- view mode -->
              <div v-if="!editMode" class="settings-rows">
                <div class="srow"><span class="skey">Name</span><span class="sval"><HyperText :text="userInfo.name || authStore.user?.name || '—'" :trigger="tabSwitchKey" /></span></div>
                <div class="srow"><span class="skey">Email</span><span class="sval"><HyperText :text="userInfo.email || authStore.user?.email || '—'" :trigger="tabSwitchKey" /></span></div>
                <div class="srow"><span class="skey">Role</span><span class="sval"><HyperText :text="userInfo.type || authStore.user?.type || '—'" :trigger="tabSwitchKey" /></span></div>
                <div class="srow"><span class="skey">Age</span><span class="sval"><HyperText :text="userAge != null ? userAge + ' years old' : '—'" :trigger="tabSwitchKey" /></span></div>
                <div class="srow"><span class="skey">Birth Date</span><span class="sval"><HyperText :text="userInfo.birth_date ? new Date(userInfo.birth_date).toLocaleDateString() : '—'" :trigger="tabSwitchKey" /></span></div>
                <div class="srow">
                  <span class="skey">Home Location</span>
                  <span class="sval">
                    <HyperText v-if="homeGeoLabel" :text="homeGeoLabel" :trigger="tabSwitchKey" />
                    <span v-if="userInfo.home_lat" class="sval-coords">&nbsp;(<HyperText :text="userInfo.home_lat.toFixed(4) + ', ' + userInfo.home_long.toFixed(4)" :trigger="tabSwitchKey" />)</span>
                    <span v-if="!userInfo.home_lat && !homeGeoLabel">—</span>
                  </span>
                </div>
              </div>

              <!-- edit mode -->
              <div v-else class="edit-form">
                <div class="field">
                  <label class="field-label">Profile Picture</label>
                  <div class="avatar-upload-row">
                    <div class="avatar-upload-preview">
                      <img v-if="profilePicInput" :src="profilePicInput" class="avatar-preview-lg" alt="preview" @error="(e) => e.target.style.display='none'" />
                      <svg v-else xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".4"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                    </div>
                    <div class="avatar-upload-controls">
                      <input ref="avatarFileInputRef" type="file" accept="image/*" style="display:none" @change="handleAvatarFileUpload" />
                      <button type="button" class="btn btn-ghost btn-xs" @click="avatarFileInputRef.click()">Upload Image</button>
                      <span class="field-or">or paste URL</span>
                      <input v-model="profilePicInput" type="url" class="field-input field-input--sm" placeholder="https://example.com/avatar.png" />
                    </div>
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">Name</label>
                  <input v-model="profileForm.name" type="text" class="field-input" placeholder="Your name" />
                </div>
                <div class="field">
                  <label class="field-label">Email</label>
                  <input v-model="profileForm.email" type="email" class="field-input" placeholder="your@email.com" />
                </div>
                <div class="field">
                  <label class="field-label">Birth Date</label>
                  <input v-model="profileForm.birth_date" type="date" class="field-input field-input--date" />
                </div>
                <div class="field">
                  <label class="field-label">New Password <span class="field-optional">(leave blank to keep current)</span></label>
                  <input v-model="profileForm.newPassword" type="password" class="field-input" placeholder="New password" autocomplete="new-password" />
                </div>
                <div class="field">
                  <label class="field-label">Confirm Password</label>
                  <input v-model="profileForm.confirmPassword" type="password" class="field-input" placeholder="Confirm new password" autocomplete="new-password" />
                </div>
                <div class="edit-form-btns">
                  <button class="btn btn-ghost" @click="cancelEditMode">Cancel</button>
                  <button class="btn btn-primary" @click="requestSaveProfile">
                    <Save :size="13" style="margin-right:5px" />Save Changes
                  </button>
                </div>
              </div>
            </div>

            <!-- custom marker card -->
            <div v-spotlight class="card">
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
            <div v-spotlight class="card">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="20" x="5" y="2" rx="3"/><path d="M12 18h.01"/></svg>
                  <span class="card-title">Device Status</span>
                </div>
                <span class="live-pill-sm"><span class="live-dot"></span>Live</span>
              </div>
              <div class="settings-rows">
                <div class="srow"><span class="skey">Battery</span><span class="sval" :style="{ color: batteryTextColor }"><HyperText :text="batteryPercentage + '%'" :trigger="tabSwitchKey" /></span></div>
                <div class="srow"><span class="skey">Heart Rate</span><span class="sval" :style="{ color: currentHeartTextColor }"><HyperText :text="status.heart_rate ? status.heart_rate + ' bpm' : 'No data'" :trigger="tabSwitchKey" /></span></div>
                <div class="srow"><span class="skey">Location</span><span class="sval"><HyperText :text="nearestPlaceLabel || 'No data'" :trigger="tabSwitchKey" /></span></div>
                <div class="srow"><span class="skey">Coordinates</span><span class="sval"><HyperText :text="status.latitude ? status.latitude.toFixed(5) + ', ' + status.longitude.toFixed(5) : '—'" :trigger="tabSwitchKey" /></span></div>
                <div class="srow"><span class="skey">Last Update</span><span class="sval"><HyperText :text="status.created_at ? new Date(status.created_at).toLocaleTimeString() : '—'" :trigger="tabSwitchKey" /></span></div>
                <div class="srow"><span class="skey">Safety Zones</span><span class="sval"><HyperText :text="geofences.length + ' configured'" :trigger="tabSwitchKey" /></span></div>
              </div>
            </div>

            <!-- about card -->
            <div v-spotlight class="card">
              <div class="card-head">
                <div class="card-head-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  <span class="card-title">About SenseWay</span>
                </div>
              </div>
              <div class="about-body">
                <img src="https://i.gyazo.com/465fb186323ea1edccb73b28fb4b8bd4.png" class="about-logo" alt="SenseWay logo" />
                <p class="about-desc">SenseWay™ is a smart health monitoring platform for cane users and their caregivers. Real-time GPS tracking, heart rate monitoring, and geofencing to keep your loved ones safe.</p>
                <div class="about-tags">
                  <span class="about-tag">GPS Tracking</span>
                  <span class="about-tag">Heart Rate</span>
                  <span class="about-tag">Geofencing</span>
                  <span class="about-tag">Live Alerts</span>
                </div>
                <p class="about-copy">SenseWay™ © 2026 · Non-Profit Organization</p>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>

    <!-- appointment creation modal -->
    <Transition name="modal-fade">
      <div v-if="showApptModal" class="modal-backdrop" @click.self="showApptModal = false">
        <div class="modal-box modal-box--appt">
          <div class="modal-head">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f8ff7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <h3 class="modal-title">New Appointment</h3>
          </div>

          <div class="appt-form">
            <div class="field">
              <label class="field-label">Title <span style="color:#ef4444">*</span></label>
              <input v-model="apptForm.title" type="text" maxlength="100" class="field-input" placeholder="e.g. Doctor Checkup" />
            </div>
            <div class="field">
              <label class="field-label">Location</label>
              <input v-model="apptForm.location" type="text" maxlength="120" class="field-input" placeholder="e.g. Ottawa General Hospital" />
            </div>
            <div class="field">
              <label class="field-label">Notes</label>
              <input v-model="apptForm.description" type="text" maxlength="200" class="field-input" placeholder="Optional notes" />
            </div>
            <div class="field-row">
              <div class="field" style="flex:1">
                <label class="field-label">Start Time <span style="color:#ef4444">*</span></label>
                <input v-model="apptForm.startAt" type="datetime-local" class="field-input" />
              </div>
              <div class="field" style="flex:1">
                <label class="field-label">End Time</label>
                <input v-model="apptForm.endAt" type="datetime-local" class="field-input" :min="apptForm.startAt" />
              </div>
            </div>
            <div class="field">
              <label class="field-label">Link Safety Zone <span class="field-optional">(optional)</span></label>
              <select v-model="apptForm.fenceId" class="field-input field-select">
                <option :value="null">— None —</option>
                <option v-for="gf in geofences" :key="gf.id" :value="gf.id">{{ gf.name }}</option>
              </select>
            </div>
          </div>

          <div class="modal-foot">
            <button class="btn btn-ghost" @click="showApptModal = false" type="button">Cancel</button>
            <button class="btn btn-primary" @click="saveAppt" type="button" :disabled="!apptForm.title.trim() || !apptForm.startAt">Save Event</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── design tokens ── */
:root {
  --bg:       #07070f;
  --surf:     #0b0b1a;
  --surf2:    #101022;
  --surf3:    #15152a;
  --border:   rgba(255,255,255,0.06);
  --border2:  rgba(255,255,255,0.11);
  --text:     #f0f0ff;
  --muted:    rgba(180,180,210,0.55);
  --dim:      #b8b8d0;
  --accent:   #4f8ff7;
  --accent2:  #a855f7;
  --success:  #22c55e;
  --danger:   #ef4444;
  --warning:  #f59e0b;
  --r:        28px;
  --r-sm:     20px;
  --r-xs:     14px;
  --shadow-sm: 0 2px 12px rgba(0,0,0,0.35);
  --shadow:    0 8px 32px rgba(0,0,0,0.45);
  --shadow-lg: 0 20px 60px rgba(0,0,0,0.55);
  --glow:      0 0 24px rgba(79,143,247,0.12);
}

/* ── shell ── */
.app-shell {
  display: flex;
  flex-direction: row;
  min-height: 100vh;
  background: var(--bg);
  background-image: radial-gradient(ellipse 120% 80% at 60% -20%, rgba(79,143,247,0.045) 0%, transparent 60%),
                    radial-gradient(ellipse 60% 50% at 0% 80%, rgba(168,85,247,0.03) 0%, transparent 55%);
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
  background: rgba(5,5,14,0.72);
  backdrop-filter: blur(40px) saturate(1.4);
  -webkit-backdrop-filter: blur(40px) saturate(1.4);
  border-right: 1px solid rgba(255,255,255,0.07);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  z-index: 30;
  box-shadow: 2px 0 20px rgba(0,0,0,0.3);
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
  border-radius: 18px;
  border: none;
  background: transparent;
  color: #c8c8d8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, transform 0.18s, box-shadow 0.18s;
  padding: 0;
  position: relative;
}

.nav-btn:hover {
  background: rgba(79,143,247,0.1);
  color: #ffffff;
  transform: translateY(-2px) scale(1.06);
  box-shadow: 0 4px 16px rgba(79,143,247,0.18);
}

.nav-btn:active {
  transform: translateY(0) scale(0.97);
}

.nav-btn--active {
  background: rgba(79,143,247,0.14);
  color: #4f8ff7;
  box-shadow: 0 0 0 1px rgba(79,143,247,0.22);
}

.nav-btn--active::after {
  content: '';
  position: absolute;
  right: 0;
  top: 20%;
  height: 60%;
  width: 3px;
  background: linear-gradient(180deg, #4f8ff7, #a855f7);
  border-radius: 3px 0 0 3px;
}

.nav-btn--active:hover {
  box-shadow: 0 4px 18px rgba(79,143,247,0.28), 0 0 0 1px rgba(79,143,247,0.28);
}

.nav-btn--logout {
  color: #f87171;
}

.nav-btn--logout:hover {
  background: rgba(239,68,68,0.16);
  color: #fca5a5;
  transform: translateY(-2px) scale(1.06);
  box-shadow: 0 4px 16px rgba(239,68,68,0.2);
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
  background: rgba(7,7,16,0.72);
  backdrop-filter: blur(40px) saturate(1.5);
  -webkit-backdrop-filter: blur(40px) saturate(1.5);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  box-shadow: 0 1px 0 rgba(255,255,255,0.03), 0 4px 20px rgba(0,0,0,0.25);
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
  font-weight: 800;
  background: linear-gradient(90deg, #f0f0ff, rgba(180,180,220,0.8));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  letter-spacing: 0.01em;
}

.topbar-center {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 20px;
  min-width: 0;
  overflow: hidden;
}

.topbar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 20px;
  border-left: 1px solid var(--border2);
}

/* unified pill style */
.tb-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 700;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  backdrop-filter: blur(8px);
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.2s, border-color 0.2s;
  color: var(--text);
}
.tb-pill:hover {
  background: rgba(255,255,255,0.09);
  border-color: rgba(255,255,255,0.15);
}

.tb-pill--live {
  background: rgba(239,68,68,0.12);
  border-color: rgba(239,68,68,0.28);
  color: #f87171;
  font-size: 10px;
  letter-spacing: 0.1em;
}

.tb-pill--loc {
  background: rgba(79,143,247,0.1);
  border-color: rgba(79,143,247,0.22);
  max-width: 240px;
  overflow: hidden;
}

.tb-pill-icon { opacity: 0.65; flex-shrink: 0; }

.tb-pill-val { line-height: 1; }

.tb-pill-unit {
  font-size: 10px;
  font-weight: 500;
  opacity: 0.65;
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
  padding: 2px 5px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.06em;
  overflow: hidden;
  display: flex;
  align-items: center;
}
.flag-img {
  width: 22px;
  height: 14px;
  object-fit: cover;
  border-radius: 3px;
  display: block;
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
  animation: tab-enter 0.28s cubic-bezier(0.22,1,0.36,1) both;
}

@keyframes tab-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── card base ── */
.card {
  background: rgba(10,10,26,0.44);
  backdrop-filter: blur(36px) saturate(1.6);
  -webkit-backdrop-filter: blur(36px) saturate(1.6);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: var(--r);
  padding: 20px;
  position: relative;
  overflow: hidden;
  --sx: 50%;
  --sy: 50%;
  --so: 0;
  transition: border-color 0.3s, box-shadow 0.3s;
  box-shadow: 0 4px 28px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.07) inset, 0 0 0 1px rgba(255,255,255,0.03) inset;
}

/* spotlight hover */
.card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(360px circle at var(--sx) var(--sy), rgba(79,143,247,0.07), transparent 65%);
  opacity: var(--so);
  transition: opacity 0.35s;
  pointer-events: none;
  border-radius: inherit;
  z-index: 0;
}

/* always-on top shimmer — subtle by default, brighter on hover */
.card::after {
  content: '';
  position: absolute;
  top: 0; left: 8%; right: 8%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(79,143,247,0.28), rgba(168,85,247,0.2), transparent);
  border-radius: 1px;
  opacity: 0.35;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 2;
}

.card:hover::after { opacity: 1; }

.card > * { position: relative; z-index: 1; }
.card:hover {
  border-color: rgba(79,143,247,0.22);
  box-shadow: 0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(79,143,247,0.08), 0 1px 0 rgba(255,255,255,0.08) inset;
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

/* ── dashboard hero ── */
.dash-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 28px;
  margin-bottom: 20px;
  background: rgba(10,10,22,0.7);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 24px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.05) inset;
}

.dash-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 120% at 0% 50%, rgba(79,143,247,0.07) 0%, transparent 60%),
              radial-gradient(ellipse 60% 100% at 100% 50%, rgba(168,85,247,0.05) 0%, transparent 55%);
  pointer-events: none;
}

.dash-hero-left { position: relative; z-index: 1; }

.dash-hero-greet {
  font-size: 13px;
  font-weight: 500;
  color: rgba(180,180,210,0.65);
  margin-bottom: 6px;
  letter-spacing: 0.01em;
}

.dash-hero-name {
  font-weight: 700;
}

.dash-hero-tagline {
  font-size: clamp(20px, 2.2vw, 28px);
  font-weight: 800;
  color: var(--text);
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.dash-hero-right {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 18px;
  padding: 14px 20px;
  position: relative;
  z-index: 1;
}

.dh-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0 18px;
}

.dh-stat-val {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--text);
}

.dh-stat-unit {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.6;
}

.dh-stat-key {
  font-size: 10px;
  font-weight: 600;
  color: rgba(180,180,210,0.5);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  white-space: nowrap;
}

.dh-divider {
  width: 1px;
  height: 36px;
  background: rgba(255,255,255,0.08);
  flex-shrink: 0;
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
  height: 260px;
  width: 100%;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 2px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06);
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
.gmaps-btn {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  color: #e2e2f0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  white-space: nowrap;
}
.gmaps-btn:hover { background: rgba(255,255,255,0.13); transform: translateY(-1px); }
.gmaps-icon { width: 13px; height: 13px; border-radius: 3px; }

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
  padding: 2px 5px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.06em;
  overflow: hidden;
  display: flex;
  align-items: center;
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
  gap: 8px;
  margin-top: 12px;
}

.loc-detail-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--r-xs);
  transition: background 0.2s, border-color 0.2s;
}

.loc-detail-item:hover {
  background: rgba(255,255,255,0.07);
  border-color: rgba(79,143,247,0.18);
}

.loc-detail-key {
  font-size: 9px;
  font-weight: 700;
  color: #c8c8d8;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  display: flex;
  align-items: center;
  gap: 3px;
}

.loc-dk-icon {
  opacity: 0.6;
  flex-shrink: 0;
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
/* ── geofence status strip ── */
.gf-status-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  border: 1px solid;
  transition: background 0.3s, border-color 0.3s;
}
.gf-status-strip--in {
  background: rgba(34,197,94,0.08);
  border-color: rgba(34,197,94,0.25);
}
.gf-status-strip--out {
  background: rgba(239,68,68,0.07);
  border-color: rgba(239,68,68,0.2);
}
.gf-status-icon {
  flex-shrink: 0;
  opacity: 0.7;
}
.gf-status-strip--in .gf-status-icon { color: #22c55e; }
.gf-status-strip--out .gf-status-icon { color: #ef4444; }
.gf-status-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.gf-status-label {
  font-size: 12px;
  font-weight: 700;
}
.gf-status-strip--in .gf-status-label { color: #86efac; }
.gf-status-strip--out .gf-status-label { color: #fca5a5; }
.gf-status-sub {
  font-size: 10px;
  color: var(--dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gf-status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.gf-status-dot--in  { background: #22c55e; animation: pulse-green 2s ease-in-out infinite; }
.gf-status-dot--out { background: #ef4444; }
@keyframes pulse-green {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
  50%       { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
}

.loc-weather-strip {
  margin-top: 12px;
  border-radius: var(--r-sm);
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.loc-weather-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
}

.loc-wx-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  background: transparent;
  border-right: 1px solid rgba(255,255,255,0.06);
  transition: background 0.2s;
}

.loc-wx-item:last-child { border-right: none; }
.loc-wx-item:hover { background: rgba(255,255,255,0.04); }

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
  padding: 9px 12px;
  background: rgba(255,255,255,0.02);
  border-top: 1px solid rgba(255,255,255,0.06);
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

.metric-body--circular {
  justify-content: center;
  padding: 4px 0 2px;
}

.cp-center-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.cp-val {
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}

.cp-unit {
  font-size: 10px;
  font-weight: 500;
  opacity: 0.7;
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

/* ── heart animation ── */
.heart-wrap {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}

.cp-heart {
  width: 36px;
  height: 36px;
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
  overflow: hidden;
}

.profile-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
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
  gap: 8px;
}

.profile-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--r-xs);
  transition: background 0.2s;
}

.profile-item:hover {
  background: rgba(255,255,255,0.07);
  border-color: rgba(79,143,247,0.15);
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
/* ── events page ── */
.tab-pane--events { overflow-y: auto; }
.ev-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  max-width: 1100px;
  margin: 0 auto;
}
.ev-stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.ev-stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 16px;
  background: rgba(10,10,26,0.44);
  backdrop-filter: blur(36px) saturate(1.6);
  -webkit-backdrop-filter: blur(36px) saturate(1.6);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: var(--r);
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  box-shadow: 0 4px 28px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.06) inset;
}
.ev-stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 36px rgba(0,0,0,0.4), 0 0 0 1px rgba(79,143,247,0.1);
  border-color: rgba(79,143,247,0.18);
}
.ev-stat-card--alert:hover { border-color: rgba(239,68,68,0.25); }
.ev-stat-card { animation: stat-enter 0.4s cubic-bezier(0.22,1,0.36,1) both; animation-delay: calc(var(--i, 0) * 60ms); }
@keyframes stat-enter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ev-stat-icon {
  width: 38px; height: 38px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 8px;
  flex-shrink: 0;
}
.ev-stat-num {
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  line-height: 1;
  letter-spacing: -0.02em;
}
.ev-stat-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--dim);
}
.ev-main-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.ev-chart-card, .ev-alerts-card, .ev-table-card {
  padding: 16px;
}
.ev-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}
.ev-bar-row {
  display: grid;
  grid-template-columns: 72px 1fr 32px;
  align-items: center;
  gap: 10px;
}
.ev-bar-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--dim);
  text-align: right;
}
.ev-bar-track {
  height: 10px;
  background: rgba(255,255,255,0.06);
  border-radius: 100px;
  overflow: hidden;
}
.ev-bar-fill {
  height: 100%;
  border-radius: 100px;
  transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
}
.ev-bar-count {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-align: left;
}
.ev-no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 140px;
  color: var(--dim);
  font-size: 12px;
}
.ev-alerts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  max-height: 220px;
  overflow-y: auto;
}
.ev-alert-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(239,68,68,0.06);
  border: 1px solid rgba(239,68,68,0.12);
  border-radius: 16px;
}
.ev-alert-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
  animation: pulse-dot 1.5s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.75); }
}
.ev-alert-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}
.ev-alert-name {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ev-alert-time {
  font-size: 10px;
  color: var(--dim);
}
.count-badge--alert { background: rgba(239,68,68,0.15); color: #fca5a5; border-color: rgba(239,68,68,0.2); }
.ev-table-card { margin-top: 0; }

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
  border-collapse: separate;
  border-spacing: 0 4px;
  font-size: 12px;
}

.events-table thead th {
  padding: 6px 12px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--dim);
  border-bottom: none;
}

.events-table tbody tr {
  background: rgba(255,255,255,0.03);
  border-radius: var(--r-xs);
  transition: background 0.15s;
}

.events-table tbody tr:hover {
  background: rgba(79,143,247,0.07);
}

.events-table tbody tr:last-child {
  border-bottom: none;
}

.events-table td {
  padding: 9px 12px;
  color: var(--text);
  vertical-align: middle;
}

.events-table td:first-child { border-radius: var(--r-xs) 0 0 var(--r-xs); }
.events-table td:last-child  { border-radius: 0 var(--r-xs) var(--r-xs) 0; }

.ev-name {
  font-weight: 600;
  white-space: nowrap;
  color: var(--text);
}

.ev-desc {
  color: #c8c8d8;
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
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.full-map {
  flex: 1;
  min-height: 0;
  width: 100%;
  border-radius: 0 0 var(--r) var(--r);
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
  padding: 10px 13px;
  border-radius: var(--r-sm);
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  font-family: inherit;
  color-scheme: dark;
}

.field-input:focus {
  border-color: rgba(79,143,247,0.55);
  background: rgba(79,143,247,0.04);
  box-shadow: 0 0 0 3px rgba(79,143,247,0.12);
}

.field-input::placeholder {
  color: rgba(180,180,210,0.35);
}

.field-select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a0a0b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 34px;
}
.field-select option {
  background: #0d0d1f;
  color: #f0f0ff;
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

.gf-idle-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 0 8px;
  text-align: center;
}
.gf-idle-hint {
  font-size: 12px;
  color: var(--dim);
  margin: 0;
  line-height: 1.5;
}
.gf-place-btn {
  width: 100%;
  padding: 10px 16px;
  font-size: 13px;
}
.gf-add-mode-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(79,143,247,0.12);
  border: 1px solid rgba(79,143,247,0.3);
  border-radius: var(--r-sm);
  font-size: 12px;
  color: #93c5fd;
  animation: pulse-border 2s ease-in-out infinite;
}
@keyframes pulse-border {
  0%, 100% { border-color: rgba(79,143,247,0.3); }
  50%       { border-color: rgba(79,143,247,0.7); }
}
.gf-cancel-add {
  margin-left: auto;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  color: var(--text);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.gf-cancel-add:hover { background: rgba(255,255,255,0.12); }

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
  transition: all 0.2s;
  white-space: nowrap;
  color: var(--text);
  position: relative;
  overflow: hidden;
}

.btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #4f8ff7 0%, #6366f1 100%);
  color: #fff;
  flex: 1;
  box-shadow: 0 3px 12px rgba(79,143,247,0.28);
}

.btn-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent);
  transform: translateX(-100%);
  transition: transform 0.5s ease;
}

.btn-primary:not(:disabled):hover::after { transform: translateX(100%); }

.btn-primary:not(:disabled):hover {
  background: linear-gradient(135deg, #6aa3ff 0%, #7577ff 100%);
  box-shadow: 0 5px 20px rgba(79,143,247,0.42);
  transform: translateY(-1px);
}

.btn-primary:not(:disabled):active { transform: translateY(0); }

.btn-ghost {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text);
  backdrop-filter: blur(8px);
}

.btn-ghost:not(:disabled):hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.16);
}

.btn-danger {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.22);
  color: #f87171;
}

.btn-danger:not(:disabled):hover {
  background: rgba(239,68,68,0.18);
  box-shadow: 0 4px 14px rgba(239,68,68,0.18);
  transform: translateY(-1px);
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

.gf-zones-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.gf-zones-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--dim);
  margin: 0;
}
.gf-remove-all {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px;
  color: #fca5a5;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 9px;
  cursor: pointer;
  transition: background 0.15s;
}
.gf-remove-all:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
.gf-remove-all:disabled { opacity: 0.4; cursor: not-allowed; }

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
  gap: 6px;
}

.srow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--r-xs);
  transition: background 0.2s;
}

.srow:hover {
  background: rgba(255,255,255,0.07);
}

.srow:last-child {
  border-bottom: 1px solid rgba(255,255,255,0.07);
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
  border-radius: 16px;
  border: 1px solid var(--border2);
  background: rgba(255,255,255,0.04);
  padding: 4px;
}

.marker-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 16px;
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
  color: #c8c8d8;
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

/* ── topography canvas ── */
.topo-canvas {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: #080810;
}

/* make app-shell sit above canvas */
.app-shell {
  position: relative;
  z-index: 1;
}

/* ── loading overlay ── */
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(8, 8, 16, 0.92);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
  animation: loading-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes loading-in {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

.loading-logo-wrap {
  position: relative;
  width: 110px;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-logo-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid transparent;
  background: conic-gradient(from 0deg, #4f8ff7, #a855f7, #10b981, #4f8ff7) border-box;
  -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: destination-out;
  mask-composite: exclude;
  animation: ring-spin 3s linear infinite;
}

@keyframes ring-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.loading-logo {
  width: 90px;
  height: 90px;
  object-fit: contain;
  border-radius: 50%;
  animation: logo-pulse 2s ease-in-out infinite;
  filter: drop-shadow(0 0 16px rgba(79, 143, 247, 0.4));
}

@keyframes logo-pulse {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 12px rgba(79,143,247,0.35)); }
  50%       { transform: scale(1.05); filter: drop-shadow(0 0 28px rgba(79,143,247,0.65)); }
}

.loading-title {
  font-size: 48px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
  background: linear-gradient(90deg, #4f8ff7, #a855f7, #10b981, #4f8ff7);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-flow 4s ease infinite;
}

@keyframes gradient-flow {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.loading-tagline {
  font-size: 13px;
  color: rgba(79,143,247,0.8);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  margin: -10px 0 0;
}

.loading-sub {
  font-size: 14px;
  color: rgba(200, 200, 216, 0.7);
  margin: 0;
  min-height: 20px;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.02em;
}

.loading-cursor {
  color: #4f8ff7;
  animation: cursor-blink 0.75s step-end infinite;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

.loading-bar-track {
  width: 240px;
  height: 2px;
  background: rgba(255,255,255,0.08);
  border-radius: 100px;
  overflow: hidden;
}

.loading-bar-fill {
  height: 100%;
  border-radius: 100px;
  background: linear-gradient(90deg, #4f8ff7, #a855f7);
  transition: width 0.1s linear;
  box-shadow: 0 0 8px rgba(79,143,247,0.6);
}

/* ── loading fade-out transition ── */
.loading-fade-leave-active {
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.loading-fade-leave-to {
  opacity: 0;
  transform: scale(1.03);
}

/* ── weather icon alignment ── */
.loc-wx-key {
  display: flex;
  align-items: center;
  gap: 4px;
}

.wx-icon {
  opacity: 0.7;
  flex-shrink: 0;
}

/* ── card entrance animations ── */
@keyframes card-enter {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

.dash-grid > .card-map    { animation: card-enter 0.45s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
.dash-grid > .metrics-col { animation: card-enter 0.45s cubic-bezier(0.22,1,0.36,1) 0.12s both; }
.dash-grid > .card-profile { animation: card-enter 0.45s cubic-bezier(0.22,1,0.36,1) 0.19s both; }
.dash-grid > .card-events  { animation: card-enter 0.45s cubic-bezier(0.22,1,0.36,1) 0.26s both; }

.settings-grid > .card:nth-child(1) { animation: card-enter 0.45s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
.settings-grid > .card:nth-child(2) { animation: card-enter 0.45s cubic-bezier(0.22,1,0.36,1) 0.12s both; }
.settings-grid > .card:nth-child(3) { animation: card-enter 0.45s cubic-bezier(0.22,1,0.36,1) 0.19s both; }
.settings-grid > .card:nth-child(4) { animation: card-enter 0.45s cubic-bezier(0.22,1,0.36,1) 0.26s both; }

/* ── avatar dropdown (topbar) ── */
.avatar-wrap {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 5px 8px;
  border-radius: 14px;
  transition: background 0.18s;
  user-select: none;
}
.avatar-wrap:hover {
  background: rgba(255,255,255,0.06);
}

.tb-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(79,143,247,0.15);
  border: 1.5px solid rgba(79,143,247,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  transition: border-color 0.18s, box-shadow 0.18s;
}
.tb-avatar--active {
  border-color: #4f8ff7;
  box-shadow: 0 0 0 3px rgba(79,143,247,0.18);
}
.tb-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tb-chevron {
  color: var(--dim);
  transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), color 0.18s;
  flex-shrink: 0;
}
.tb-chevron--open {
  transform: rotate(180deg);
  color: #4f8ff7;
}

.avatar-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 240px;
  background: #0e0e1a;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 18px;
  padding: 8px;
  z-index: 100;
  box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
  backdrop-filter: blur(12px);
}

.avd-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 10px 12px;
}

.avd-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(79,143,247,0.15);
  border: 1.5px solid rgba(79,143,247,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.avd-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avd-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.avd-name {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.avd-email {
  font-size: 11px;
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avd-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 4px 0;
}

.avd-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 14px;
  border: none;
  background: none;
  color: #c8c8d8;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
}
.avd-item:hover {
  background: rgba(255,255,255,0.07);
  color: #fff;
}
.avd-item--danger { color: #f87171; }
.avd-item--danger:hover {
  background: rgba(239,68,68,0.12);
  color: #fca5a5;
}

/* dropdown enter/leave */
.dropdown-enter-active {
  transition: opacity 0.18s ease, transform 0.2s cubic-bezier(0.22,1,0.36,1);
}
.dropdown-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}

/* ── notification toasts ── */
.notif-stack {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.notif-toast {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 13px 16px;
  border-radius: 18px;
  border: 1px solid;
  min-width: 290px;
  max-width: 370px;
  pointer-events: all;
  backdrop-filter: blur(20px);
  box-shadow: 0 16px 50px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05) inset;
}
.notif-toast--success {
  background: rgba(16,185,129,0.1);
  border-color: rgba(16,185,129,0.25);
}
.notif-toast--error {
  background: rgba(239,68,68,0.1);
  border-color: rgba(239,68,68,0.25);
}

.notif-icon {
  flex-shrink: 0;
  margin-top: 1px;
}
.notif-toast--success .notif-icon { color: #34d399; }
.notif-toast--error   .notif-icon { color: #f87171; }

.notif-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.notif-title {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}
.notif-msg {
  font-size: 12px;
  color: rgba(200,200,216,0.8);
  line-height: 1.4;
}

.notif-close {
  background: none;
  border: none;
  color: rgba(200,200,216,0.5);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: color 0.15s;
}
.notif-close:hover { color: #fff; }

/* toast transitions */
.notif-enter-active { transition: all 0.28s cubic-bezier(0.22,1,0.36,1); }
.notif-leave-active { transition: all 0.2s ease; }
.notif-enter-from  { opacity: 0; transform: translateX(30px); }
.notif-leave-to    { opacity: 0; transform: translateX(30px); }

/* ── confirm modal ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9997;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-box {
  background: rgba(9,9,22,0.97);
  backdrop-filter: blur(32px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 28px;
  padding: 30px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 40px 100px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.06) inset;
}

.modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.modal-icon { color: #f59e0b; flex-shrink: 0; }
.modal-title {
  font-size: 16px;
  font-weight: 800;
  color: #fff;
  margin: 0;
}

.modal-body {
  font-size: 13px;
  color: #c8c8d8;
  line-height: 1.6;
  margin: 0 0 12px;
}

.modal-warning {
  font-size: 12px;
  color: #fbbf24;
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.2);
  border-radius: 14px;
  padding: 10px 14px;
  margin: 0 0 22px;
  line-height: 1.5;
}

.modal-foot {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.modal-fade-enter-active { transition: all 0.22s cubic-bezier(0.22,1,0.36,1); }
.modal-fade-leave-active { transition: all 0.16s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-box { transform: scale(0.94); }

/* ── account edit form ── */
.btn-icon-sm {
  width: 30px;
  height: 30px;
  border-radius: 12px;
  border: 1px solid var(--border2);
  background: rgba(255,255,255,0.05);
  color: var(--dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.btn-icon-sm:hover {
  background: rgba(79,143,247,0.12);
  color: #4f8ff7;
  border-color: rgba(79,143,247,0.25);
}

.profile-pic-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 0 14px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
}
.profile-pic-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(79,143,247,0.12);
  border: 2px solid rgba(79,143,247,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.profile-pic-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.profile-pic-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.profile-pic-name {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}
.profile-pic-role {
  font-size: 11px;
  color: var(--dim);
  text-transform: capitalize;
}

.sval-coords {
  font-size: 11px;
  color: var(--dim);
  font-weight: 400;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 10px;
}

.field-optional {
  font-size: 11px;
  color: var(--dim);
  font-weight: 400;
}

.avatar-upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar-upload-preview {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--bg3);
  border: 1px solid var(--border2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.avatar-preview-lg {
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: 50%;
}
.avatar-upload-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-or {
  font-size: 11px;
  color: var(--muted);
}
.btn-xs {
  padding: 4px 10px;
  font-size: 11px;
  height: auto;
}
.field-input--sm {
  height: 30px;
  font-size: 12px;
}

.field-input--date {
  color-scheme: dark;
}

.edit-form-btns {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}
.edit-form-btns .btn-ghost { flex: 1; }
.edit-form-btns .btn-primary { flex: 2; }

/* ── nearest building row ── */
.loc-detail-item--building .loc-detail-val {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  white-space: normal;
}

.loc-building-name {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}

.loc-building-type {
  font-size: 10px;
  color: #4f8ff7;
  font-weight: 500;
  background: rgba(79,143,247,0.1);
  border: 1px solid rgba(79,143,247,0.2);
  border-radius: 6px;
  padding: 1px 6px;
  white-space: nowrap;
}

/* ── zone preset picker ── */
.zone-preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}

.zone-preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 9px 6px;
  border-radius: 12px;
  border: 1px solid var(--border2);
  background: rgba(255,255,255,0.03);
  color: var(--dim);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
  font-family: inherit;
  text-align: center;
}

.zone-preset-btn:hover {
  background: rgba(255,255,255,0.07);
  color: #fff;
  transform: translateY(-1px);
}

.zone-preset-btn--active {
  background: color-mix(in srgb, var(--pcolor, #4f8ff7) 18%, transparent);
  border-color: color-mix(in srgb, var(--pcolor, #4f8ff7) 50%, transparent);
  color: var(--pcolor, #4f8ff7);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--pcolor, #4f8ff7) 25%, transparent);
}

/* ── map toolbar (layer toggle) ── */
.gf-map-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--surf);
  border-bottom: 1px solid var(--border);
  border-radius: var(--r) var(--r) 0 0;
  flex-shrink: 0;
}

.gf-map-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #c8c8d8;
}

.map-layer-toggle {
  display: flex;
  gap: 4px;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  border: 1px solid var(--border);
  padding: 3px;
}

.mlt-btn {
  padding: 4px 11px;
  border-radius: 6px;
  border: none;
  background: none;
  color: #c8c8d8;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
}

.mlt-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }

.mlt-btn--active {
  background: #4f8ff7;
  color: #fff;
}

/* Leaflet dark theme overrides */
.gf-leaflet-map :deep(.leaflet-control-zoom a) {
  background: #0e0e18;
  color: #c8c8d8;
  border-color: rgba(255,255,255,0.12);
}
.gf-leaflet-map :deep(.leaflet-control-zoom a:hover) {
  background: #1a1a2e;
  color: #fff;
}
.gf-leaflet-map :deep(.leaflet-control-zoom) {
  border: 1px solid rgba(255,255,255,0.12) !important;
  border-radius: 8px !important;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
}
.gf-leaflet-map :deep(.leaflet-control-attribution) {
  background: rgba(8,8,16,0.7);
  color: rgba(200,200,216,0.4);
  font-size: 9px;
}

/* visible focus ring for keyboard navigation */
:focus-visible {
  outline: 2px solid #4f8ff7;
  outline-offset: 2px;
}
.nav-btn:focus-visible,
.btn:focus-visible,
.hp-btn:focus-visible,
.notif-close:focus-visible,
.avd-item:focus-visible {
  outline: 2px solid #4f8ff7;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(79,143,247,0.2);
}

/* ── signal bars pill ─────────────────────────────────────── */
.tb-pill--signal {
  --pill-accent: #22c55e;
  gap: 5px;
}
.tb-pill--signal-off {
  --pill-accent: #ef4444;
  opacity: 0.7;
}
.signal-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}
.signal-bar {
  width: 3px;
  border-radius: 1px;
  background: rgba(255,255,255,0.15);
  transition: background 0.4s, height 0.4s;
}
.signal-bar:nth-child(1) { height: 4px; }
.signal-bar:nth-child(2) { height: 7px; }
.signal-bar:nth-child(3) { height: 11px; }
.signal-bar--on { background: var(--pill-accent, #22c55e); }
.signal-label { font-size: 10px; font-weight: 700; }

/* ── heartbeat icon in topbar ─────────────────────────────── */
@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  14%       { transform: scale(1.3); }
  28%       { transform: scale(1); }
  42%       { transform: scale(1.2); }
  70%       { transform: scale(1); }
}
.icon-heartbeat {
  animation: heartbeat 1.4s ease-in-out infinite;
  transform-origin: center;
}

/* ── battery pill pulse ring when critically low ─────────── */
.tb-pill--battery-warn {
  box-shadow: 0 0 0 0 rgba(239,68,68,0.5);
  animation: battery-pill-ring 2s ease-out infinite;
}
@keyframes battery-pill-ring {
  0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); }
  70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}

/* ── bell wiggle when alert events exist ─────────────────── */
@keyframes bell-ring {
  0%   { transform: rotate(0deg); }
  10%  { transform: rotate(18deg); }
  20%  { transform: rotate(-16deg); }
  30%  { transform: rotate(14deg); }
  40%  { transform: rotate(-10deg); }
  50%  { transform: rotate(6deg); }
  60%  { transform: rotate(-4deg); }
  70%  { transform: rotate(2deg); }
  80%  { transform: rotate(0deg); }
  100% { transform: rotate(0deg); }
}
.icon-bell-ring {
  animation: bell-ring 2.5s ease-in-out infinite;
  transform-origin: top center;
}

/* ── red dot badge on events nav button ──────────────────── */
.nav-alert-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 0 1.5px rgba(8,8,20,0.9);
  animation: dot-pulse 2s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%       { transform: scale(1.4); opacity: 0.7; }
}

/* respect reduced-motion preference */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* ── timed zone toggle ──────────────────────────────────── */
.timed-toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}
.timed-toggle-track {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s;
  cursor: pointer;
}
.timed-toggle-track--on { background: #4f8ff7; border-color: #4f8ff7; }
.timed-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.timed-toggle-track--on .timed-toggle-thumb { transform: translateX(16px); }
.field-hint {
  font-size: 11px;
  color: rgba(200,200,216,0.45);
  margin-top: 4px;
}

/* ── calendar tab ────────────────────────────────────────── */
.tab-pane--calendar { height: 100%; }
.cal-page {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.cal-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
  flex: 1;
  min-height: 0;
}
.cal-main {
  overflow-y: auto;
  padding-right: 4px;
}
.cal-side {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 18px;
  padding: 16px;
  overflow-y: auto;
  backdrop-filter: blur(10px);
}
.cal-side-head { margin-bottom: 14px; }
.cal-side-title { font-size: 14px; font-weight: 700; color: #fff; }
.cal-upcoming { display: flex; flex-direction: column; gap: 12px; }
.cal-upcoming-section { display: flex; flex-direction: column; gap: 6px; }
.cal-upcoming-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(200,200,216,0.45);
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.cal-upcoming-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  transition: background 0.15s;
}
.cal-upcoming-item:hover { background: rgba(255,255,255,0.07); }
.cal-upcoming-item--gf  { border-left: 2px solid #4f8ff7; }
.cal-upcoming-item--appt{ border-left: 2px solid #a855f7; }
.cal-upcoming-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #c8c8d8;
}
.cal-upcoming-item--gf   .cal-upcoming-icon { background: rgba(79,143,247,0.12); color: #4f8ff7; }
.cal-upcoming-item--appt .cal-upcoming-icon { background: rgba(168,85,247,0.12); color: #c084fc; }
.cal-upcoming-body { flex: 1; min-width: 0; }
.cal-upcoming-title { font-size: 12px; font-weight: 600; color: #e0e0f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cal-upcoming-sub   { font-size: 10px; color: rgba(200,200,216,0.5); margin-top: 2px; }
.cal-item-del {
  background: none;
  border: none;
  color: rgba(200,200,216,0.25);
  cursor: pointer;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s;
}
.cal-item-del:hover { color: #f87171; }
.cal-upcoming-empty {
  font-size: 12px;
  color: rgba(200,200,216,0.4);
  text-align: center;
  padding: 20px 8px;
}

/* appointment modal additions */
.modal-box--appt { max-width: 520px; }
.appt-form { display: flex; flex-direction: column; gap: 10px; margin: 16px 0; }
.field-row { display: flex; gap: 12px; }

@media (max-width: 900px) {
  .cal-layout { grid-template-columns: 1fr; }
  .cal-side { display: none; }
}
</style>
