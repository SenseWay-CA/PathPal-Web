<script setup>
import { useRouter } from 'vue-router'
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { Sun, CloudSun, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Cloud, Thermometer, Wind, Droplets, MapPin, Building2, Navigation2, Hash, Mountain, Globe, Home, LayoutDashboard, Target, Settings, LogOut, User, Mail, Camera, Bell, CheckCircle, AlertTriangle, X, ChevronDown, Edit2, Save, Briefcase, GraduationCap, Hospital, Pill, Leaf, ShoppingCart, Dumbbell, Layers } from 'lucide-vue-next'

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

// ── visual enhancement state ──
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

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    zone presets

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

function buildZoneDivIcon(zoneType) {
  const color  = ZONE_COLORS[zoneType] || ZONE_COLORS.other
  const paths  = ZONE_SVG[zoneType]   || ZONE_SVG.other
  const pinHtml =
    `<div style="width:40px;height:40px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:${color};border:2.5px solid rgba(255,255,255,0.9);box-shadow:0 6px 20px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">`
    + `<svg style="transform:rotate(45deg)" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="19" height="19">${paths}</svg>`
    + `</div>`
  return L.divIcon({
    html: pinHtml,
    className: '',
    iconSize:   [40, 40],
    iconAnchor: [20, 40],
    popupAnchor:[0, -44],
  })
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    map tile layer toggle

const mapTileMode = ref('dark')
let geoTileLayer = null

const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    opts: { subdomains: 'abcd', maxZoom: 19, attribution: '© SenseWay 2026' },
  },
  map: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    opts: { subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap · © CARTO' },
  },
  terrain: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    opts: { maxZoom: 18, attribution: '© Esri, DeLorme, USGS' },
  },
}

function switchTileLayer(mode) {
  if (!map.value) return
  // remove old tile layer
  if (geoTileLayer) {
    map.value.removeLayer(geoTileLayer)
    geoTileLayer = null
  }
  const { url, opts } = TILE_LAYERS[mode] || TILE_LAYERS.dark
  geoTileLayer = L.tileLayer(url, opts)
  // insert tile layer at the bottom so markers stay on top
  geoTileLayer.addTo(map.value)
  geoTileLayer.bringToBack()
  mapTileMode.value = mode
  // force Leaflet to re-request tiles after layer swap
  map.value.invalidateSize()
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

async function fetchNearestPlace(lat, lon) {
  if (lat == null || lon == null) return
  // throttle geocoding to once per 10 seconds
  if (Date.now() - lastGeocodeFetch < 10000) return
  lastGeocodeFetch = Date.now()
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
  const uid = (newID || '').trim()
  if (!uid) return
  try {
    const response = await fetch(`${url}/user?user_id=${uid}`, { credentials: 'include' })
    if (!response.ok) throw new Error(`status: ${response.status}`)
    const data = await response.json()
    userInfo.value = data
    // trigger home geo label fetch on first load
    if (data.home_lat) fetchHomeGeoLabel(data.home_lat, data.home_long)
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
    // Don't reset zoom/pan — user may be zoomed in; just move the marker
    if (marker.value) marker.value.setLatLng([lat, lon])
    else marker.value = L.marker([lat, lon], { icon: buildIcon(customMarkerUrl.value) }).addTo(map.value)
  } else {
    try {
      map.value = L.map('map').setView([lat, lon], 17)
      const { url, opts } = TILE_LAYERS[mapTileMode.value] || TILE_LAYERS.dark
      geoTileLayer = L.tileLayer(url, opts).addTo(map.value)
      geoTileLayer.bringToBack()
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
    mapMini.value.setView([lat, lon], 15, { animate: false })
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
        zoomAnimation: false,
      }).setView([lat, lon], 15, { animate: false })
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

// track saved-fence icon markers separately
const geofenceIconLayers = new Map()

function renderGeofencesOnMap() {
  if (!map.value) return
  const knownIds = new Set(geofences.value.map((item) => item.id))
  geofenceLayers.forEach((layer, layerId) => {
    if (!knownIds.has(layerId)) {
      if (map.value) map.value.removeLayer(layer)
      geofenceLayers.delete(layerId)
    }
  })
  geofenceIconLayers.forEach((m, layerId) => {
    if (!knownIds.has(layerId)) {
      if (map.value) map.value.removeLayer(m)
      geofenceIconLayers.delete(layerId)
    }
  })
  geofences.value.forEach((fence) => {
    if (!fence?.id) return
    const prev = geofenceLayers.get(fence.id)
    if (prev && map.value) map.value.removeLayer(prev)
    const prevIcon = geofenceIconLayers.get(fence.id)
    if (prevIcon && map.value) map.value.removeLayer(prevIcon)
    const isSelected = selectedGeofenceId.value === fence.id
    const zoneType = detectZoneType(fence.name)
    const zoneColor = ZONE_COLORS[zoneType] || ZONE_COLORS.other
    const layer = L.circle([fence.latitude, fence.longitude], {
      radius: Number(fence.radius),
      color: isSelected ? '#f97316' : zoneColor,
      fillColor: isSelected ? '#fb923c' : zoneColor,
      fillOpacity: 0.15,
      weight: isSelected ? 3 : 2,
    }).addTo(map.value)
    // center icon marker
    const iconMarker = L.marker([fence.latitude, fence.longitude], {
      icon: buildZoneDivIcon(zoneType),
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
  })
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

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                                    geofence: crud

async function fetchGeofences() {
  const userId = (id.value || '').trim()
  if (!userId) return
  console.log('[fetchGeofences] user id:', userId)
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
  const payload = {
    user_id: id.value,
    name: finalName,
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
  if (map.value) { try { map.value.stop(); map.value.remove() } catch(_) {} map.value = null }
  if (mapMini.value) { try { mapMini.value.stop(); mapMini.value.remove() } catch(_) {} mapMini.value = null }
  marker.value = null
  miniMarker.value = null
  geofence.value = null
  geofences.value = []
  geoTileLayer = null
  if (topoAnimFrame) cancelAnimationFrame(topoAnimFrame)
})

// ── topography canvas + loading screen ──
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

  // progress bar fills over 5.8 s
  const t0 = Date.now()
  const prog = setInterval(() => {
    const elapsed = Date.now() - t0
    loadingProgress.value = Math.min((elapsed / 5800) * 100, 100)
    if (loadingProgress.value >= 100) clearInterval(prog)
  }, 40)

  // hide loading screen after 6 s
  setTimeout(() => { isLoading.value = false }, 6000)
})

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                    N O T I F I C A T I O N S  +  C O N F I R M
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                    A V A T A R  D R O P D O W N
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const showAvatarMenu = ref(false)

function toggleAvatarMenu() {
  showAvatarMenu.value = !showAvatarMenu.value
}

function closeAvatarMenu() {
  showAvatarMenu.value = false
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                    P R O F I L E  P I C T U R E
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const profilePicUrl = ref(localStorage.getItem('sw_profile_pic') || '')

function saveProfilePic(url) {
  profilePicUrl.value = url
  localStorage.setItem('sw_profile_pic', url)
  addNotification('success', 'Profile picture updated', 'Your new avatar has been saved.')
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                    A C C O U N T  E D I T I N G
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const editMode = ref(false)
const profilePicInput = ref('')

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
    authStore.updateCachedUser({ name: updated.name, email: updated.email })
    if (profilePicInput.value !== profilePicUrl.value) {
      saveProfilePic(profilePicInput.value)
    }
    editMode.value = false
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

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                    H O M E  L O C A T I O N  G E O C O D I N G
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                           C O N C E P T :  S E N S E W A Y
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
</script>

<template>
  <!-- Topography canvas background -->
  <canvas ref="topoCanvasRef" class="topo-canvas"></canvas>

  <!-- ==================== notification toasts ==================== -->
  <Teleport to="body">
    <div class="notif-stack">
      <TransitionGroup name="notif">
        <div
          v-for="n in notifications"
          :key="n.id"
          :class="['notif-toast', `notif-toast--${n.type}`]"
        >
          <CheckCircle v-if="n.type === 'success'" :size="16" class="notif-icon" />
          <AlertTriangle v-else :size="16" class="notif-icon" />
          <div class="notif-body">
            <span class="notif-title">{{ n.title }}</span>
            <span v-if="n.message" class="notif-msg">{{ n.message }}</span>
          </div>
          <button class="notif-close" @click="dismissNotif(n.id)"><X :size="13" /></button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>

  <!-- ==================== confirm dialog ==================== -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="confirmDialog.show" class="modal-backdrop" @click.self="confirmCancel">
        <div class="modal-box">
          <div class="modal-head">
            <AlertTriangle :size="20" class="modal-icon" />
            <h3 class="modal-title">{{ confirmDialog.title }}</h3>
          </div>
          <p class="modal-body">{{ confirmDialog.message }}</p>
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
                  <span class="loc-detail-key"><Building2 :size="10" class="loc-dk-icon" /> Neighbourhood</span>
                  <span class="loc-detail-val">{{ nearestPlace.neighbourhood }}</span>
                </div>
                <!-- road -->
                <div v-if="nearestPlace.road" class="loc-detail-item">
                  <span class="loc-detail-key"><Navigation2 :size="10" class="loc-dk-icon" /> Street</span>
                  <span class="loc-detail-val">{{ nearestPlace.road }}</span>
                </div>
                <!-- postcode -->
                <div v-if="nearestPlace.postcode" class="loc-detail-item">
                  <span class="loc-detail-key"><Hash :size="10" class="loc-dk-icon" /> Postal Code</span>
                  <span class="loc-detail-val">{{ nearestPlace.postcode }}</span>
                </div>
                <!-- state -->
                <div v-if="nearestPlace.state" class="loc-detail-item">
                  <span class="loc-detail-key"><Globe :size="10" class="loc-dk-icon" /> Province / State</span>
                  <span class="loc-detail-val">{{ nearestPlace.state }}</span>
                </div>
                <!-- elevation -->
                <div v-if="weatherData.elevation != null" class="loc-detail-item">
                  <span class="loc-detail-key"><Mountain :size="10" class="loc-dk-icon" /> Elevation</span>
                  <span class="loc-detail-val">{{ weatherData.elevation }} m</span>
                </div>
                <!-- nearest building / place -->
                <div v-if="nearestPlace.name" class="loc-detail-item loc-detail-item--building">
                  <span class="loc-detail-key"><Building2 :size="10" class="loc-dk-icon" /> Nearest Place</span>
                  <span class="loc-detail-val loc-building-val">
                    <span class="loc-building-name">{{ nearestPlace.name }}</span>
                    <span v-if="nearestPlace.buildingType" class="loc-building-type">{{ nearestPlace.buildingType }}</span>
                  </span>
                </div>
                <!-- coordinates -->
                <div class="loc-detail-item">
                  <span class="loc-detail-key"><MapPin :size="10" class="loc-dk-icon" /> Coordinates</span>
                  <span class="loc-detail-val">{{ status.latitude?.toFixed(5) }}, {{ status.longitude?.toFixed(5) }}</span>
                </div>
              </div>

              <!-- weather strip -->
              <div v-if="weatherLabel" class="loc-weather-strip">
                <div class="loc-weather-row">
                  <div class="loc-wx-item">
                    <span class="loc-wx-key">
                      <component :is="WeatherIconComponent" :size="11" class="wx-icon" />
                      Weather
                    </span>
                    <span class="loc-wx-val">{{ weatherLabel }}</span>
                  </div>
                  <div v-if="weatherData.temp != null" class="loc-wx-item">
                    <span class="loc-wx-key">
                      <Thermometer :size="11" class="wx-icon" />
                      Temperature
                    </span>
                    <span class="loc-wx-val">{{ weatherData.temp }}°C</span>
                  </div>
                  <div v-if="weatherData.wind != null" class="loc-wx-item">
                    <span class="loc-wx-key">
                      <Wind :size="11" class="wx-icon" />
                      Wind
                    </span>
                    <span class="loc-wx-val">{{ weatherData.wind }} km/h</span>
                  </div>
                  <div v-if="weatherData.humidity != null" class="loc-wx-item">
                    <span class="loc-wx-key">
                      <Droplets :size="11" class="wx-icon" />
                      Humidity
                    </span>
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
              <div class="gf-map-toolbar">
                <span class="gf-map-title">
                  <Layers :size="14" />
                  Safety Zone Map
                </span>
                <div class="map-layer-toggle">
                  <button
                    v-for="m in [{ id:'dark', label:'Dark' }, { id:'map', label:'Map' }, { id:'terrain', label:'Terrain' }]"
                    :key="m.id"
                    :class="['mlt-btn', { 'mlt-btn--active': mapTileMode === m.id }]"
                    @click="switchTileLayer(m.id)"
                    type="button"
                  >{{ m.label }}</button>
                </div>
              </div>
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
                <!-- zone type preset picker -->
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
                <!-- custom name when "other" or for override -->
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
                <div class="srow"><span class="skey">Name</span><span class="sval">{{ userInfo.name || authStore.user?.name || '—' }}</span></div>
                <div class="srow"><span class="skey">Email</span><span class="sval">{{ userInfo.email || authStore.user?.email || '—' }}</span></div>
                <div class="srow"><span class="skey">Role</span><span class="sval">{{ userInfo.type || authStore.user?.type || '—' }}</span></div>
                <div class="srow"><span class="skey">Age</span><span class="sval">{{ userAge != null ? userAge + ' years old' : '—' }}</span></div>
                <div class="srow"><span class="skey">Birth Date</span><span class="sval">{{ userInfo.birth_date ? new Date(userInfo.birth_date).toLocaleDateString() : '—' }}</span></div>
                <div class="srow">
                  <span class="skey">Home Location</span>
                  <span class="sval">
                    <span v-if="homeGeoLabel">{{ homeGeoLabel }}</span>
                    <span v-if="userInfo.home_lat" class="sval-coords">&nbsp;({{ userInfo.home_lat.toFixed(4) }}, {{ userInfo.home_long.toFixed(4) }})</span>
                    <span v-if="!userInfo.home_lat && !homeGeoLabel">—</span>
                  </span>
                </div>
              </div>

              <!-- edit mode -->
              <div v-else class="edit-form">
                <div class="field">
                  <label class="field-label">Avatar URL</label>
                  <div class="input-with-preview">
                    <input v-model="profilePicInput" type="url" class="field-input" placeholder="https://example.com/avatar.png" />
                    <img v-if="profilePicInput" :src="profilePicInput" class="avatar-preview-sm" alt="" @error="(e) => e.target.style.display='none'" />
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
  </div>
</template>

<style scoped>
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
  background: rgba(79,143,247,0.16);
  color: #4f8ff7;
  box-shadow: 0 0 0 1px rgba(79,143,247,0.3);
}

.nav-btn--active:hover {
  box-shadow: 0 4px 18px rgba(79,143,247,0.3), 0 0 0 1px rgba(79,143,247,0.3);
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
  border-radius: 12px;
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
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid;
  min-width: 280px;
  max-width: 360px;
  pointer-events: all;
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.4);
}
.notif-toast--success {
  background: rgba(16,185,129,0.12);
  border-color: rgba(16,185,129,0.3);
}
.notif-toast--error {
  background: rgba(239,68,68,0.12);
  border-color: rgba(239,68,68,0.3);
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
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-box {
  background: #0e0e1a;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 22px;
  padding: 28px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
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
  border-radius: 10px;
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
  border-radius: 10px;
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

.input-with-preview {
  display: flex;
  align-items: center;
  gap: 10px;
}
.input-with-preview .field-input {
  flex: 1;
}
.avatar-preview-sm {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border2);
  flex-shrink: 0;
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
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.gf-map-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(8,8,16,0.82);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.1);
  font-size: 12px;
  font-weight: 600;
  color: #c8c8d8;
  pointer-events: auto;
}

.map-layer-toggle {
  display: flex;
  gap: 4px;
  background: rgba(8,8,16,0.82);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.1);
  padding: 4px;
  pointer-events: auto;
}

.mlt-btn {
  padding: 5px 11px;
  border-radius: 7px;
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

/* ensure map panel is position:relative so toolbar can use absolute positioning */
.gf-map-panel {
  position: relative;
}
</style>
