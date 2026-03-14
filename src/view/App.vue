<script setup>
import { useDark } from '@vueuse/core'
import { RouterView, useRouter } from 'vue-router'
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  listGeofences,
  createGeofence,
  updateGeofence as updateGeofenceApi,
  deleteGeofence as deleteGeofenceApi,
} from '@/services/geofenceApi'
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

// Use the authenticated user's ID
const id = computed(() => authStore.user?.user_id || '')

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

// Geofence state variables
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

// Watch geofence radius to clamp values
watch(geofenceRadius, (newRadius) => {
  if (newRadius < 50) {
    geofenceRadius.value = 50
  } else if (newRadius > 5000) {
    geofenceRadius.value = 5000
  }
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

    // Validate coordinates
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      console.warn('Invalid coordinates received:', { lat, lon })
      return
    }

    if (lat === 0 && lon === 0) {
      console.warn('Coordinates are (0, 0) - user may not have location data')
      return
    }

    initializeOrUpdateMap(lat, lon)
    fetchNearestPlace(lat, lon)

    console.log('Fetched Status:', status.value)
  } catch (error) {
    console.error('Failed to fetch status:', error.message)
  }
}

function initializeOrUpdateMap(lat, lon) {
  const mapElement = document.getElementById('map')
  if (!mapElement) {
    console.error('Map element with id "map" not found in DOM')
    return
  }

  if (map.value) {
    // Update existing map
    map.value.setView([lat, lon], 17)
    if (marker.value) {
      marker.value.setLatLng([lat, lon])
    } else {
      marker.value = L.marker([lat, lon], { icon: myIcon }).addTo(map.value)
    }
  } else {
    // Initialize new map
    try {
      map.value = L.map('map').setView([lat, lon], 17)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: `
     <span style="color:#0078a8;">
        SenseWay © 2025
     </span>`,
      }).addTo(map.value)

      marker.value = L.marker([lat, lon], { icon: myIcon }).addTo(map.value)
      console.log('Map initialized successfully')
    } catch (error) {
      console.error('Failed to initialize map:', error)
    }
  }

  // Add geofence click handler
  if (map.value) {
    map.value.off('click', handleMapClick)
    map.value.on('click', handleMapClick)
    renderGeofencesOnMap()
  }
}

function normalizeGeofenceName(name) {
  const trimmed = (name || '').trim()
  return trimmed || 'Geofence'
}

function clearGeofenceDraftLayers() {
  if (map.value && geofenceMarker.value) {
    map.value.removeLayer(geofenceMarker.value)
  }
  if (map.value && geofenceCircle.value) {
    map.value.removeLayer(geofenceCircle.value)
  }
  geofenceMarker.value = null
  geofenceCircle.value = null
}

function clearAllGeofenceLayers() {
  geofenceLayers.forEach((layer) => {
    if (map.value && layer) {
      map.value.removeLayer(layer)
    }
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
  const normalized = {
    ...saved,
    radius: Number(saved.radius),
  }

  const idx = geofences.value.findIndex((item) => item.id === normalized.id)
  if (idx >= 0) {
    geofences.value[idx] = normalized
  } else {
    geofences.value.unshift(normalized)
  }
}

function removeGeofenceFromState(fenceId) {
  geofences.value = geofences.value.filter((item) => item.id !== fenceId)
}

function buildGeofencePopupHTML(fence) {
  const safeName = (fence.name || 'Geofence').replace(/[<>]/g, '')
  const radiusValue = Number(fence.radius) || 0
  return `
    <div style="min-width: 210px; display: grid; gap: 8px;">
      <div style="font-weight: 700; color: #111827;">${safeName}</div>
      <div style="font-size: 12px; color: #4b5563;">Radius: ${radiusValue}m</div>
      <div style="display: flex; gap: 8px;">
        <button id="geofence-edit-${fence.id}" style="padding: 6px 10px; border-radius: 6px; border: none; background: #0ea5e9; color: #ffffff; cursor: pointer;">Edit</button>
        <button id="geofence-delete-${fence.id}" style="padding: 6px 10px; border-radius: 6px; border: none; background: #ef4444; color: #ffffff; cursor: pointer;">Delete</button>
      </div>
    </div>
  `
}

function applyGeofenceDraft(latlng) {
  if (!map.value) return

  if (!geofenceMarker.value) {
    geofenceMarker.value = L.marker(latlng, { draggable: true }).addTo(map.value)
    geofenceMarker.value.on('drag', (event) => {
      updateGeofenceCircle(event.target.getLatLng())
    })
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
      color: '#0ea5e9',
      fillOpacity: 0.2
    }).addTo(map.value)
  }
}

function updateRadius() {
  if (geofenceCircle.value) {
    geofenceCircle.value.setRadius(geofenceRadius.value)
  }
}

function renderGeofencesOnMap() {
  if (!map.value) return

  const knownIds = new Set(geofences.value.map((item) => item.id))
  geofenceLayers.forEach((layer, layerId) => {
    if (!knownIds.has(layerId) && map.value) {
      map.value.removeLayer(layer)
      geofenceLayers.delete(layerId)
    }
  })

  geofences.value.forEach((fence) => {
    if (!fence?.id) return

    const previousLayer = geofenceLayers.get(fence.id)
    if (previousLayer && map.value) {
      map.value.removeLayer(previousLayer)
    }

    const isSelected = selectedGeofenceId.value === fence.id
    const layer = L.circle([fence.latitude, fence.longitude], {
      radius: Number(fence.radius),
      color: isSelected ? '#f97316' : '#16a34a',
      fillColor: isSelected ? '#fb923c' : '#4ade80',
      fillOpacity: 0.18,
      weight: isSelected ? 3 : 2,
    }).addTo(map.value)

    layer.bindPopup(buildGeofencePopupHTML(fence))
    layer.on('click', () => {
      selectExistingGeofence(fence.id, false)
    })
    layer.on('popupopen', () => {
      const editButton = document.getElementById(`geofence-edit-${fence.id}`)
      if (editButton) {
        editButton.onclick = () => {
          selectExistingGeofence(fence.id, true)
        }
      }

      const deleteButton = document.getElementById(`geofence-delete-${fence.id}`)
      if (deleteButton) {
        deleteButton.onclick = () => {
          deleteSelectedGeofence(fence.id)
        }
      }
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

  if (closePopup) {
    geofenceLayers.get(selected.id)?.closePopup()
  }
}

async function fetchGeofences() {
  if (!id.value) return

  geofenceLoading.value = true
  try {
    const result = await listGeofences(id.value)
    geofences.value = Array.isArray(result)
      ? result.map((item) => ({
          ...item,
          radius: Number(item.radius),
        }))
      : []
    renderGeofencesOnMap()
  } catch (error) {
    const details = error?.response?.data?.error || error?.message || 'Unable to load geofences.'
    geofenceSaveMessage.value = `Failed to load geofences: ${details}`
    geofenceSaveMessageType.value = 'error'
  } finally {
    geofenceLoading.value = false
  }
}

async function saveGeofence() {
  if (geofenceSaving.value) return

  geofenceSaveMessage.value = ''
  geofenceSaveMessageType.value = ''

  if (!geofenceMarker.value) {
    geofenceSaveMessage.value = 'Please place a geofence marker on the map first.'
    geofenceSaveMessageType.value = 'error'
    return
  }

  if (!id.value) {
    geofenceSaveMessage.value = 'Missing user ID. Please log in again and retry.'
    geofenceSaveMessageType.value = 'error'
    return
  }

  const radius = Number(geofenceRadius.value)
  if (Number.isNaN(radius) || radius <= 0) {
    geofenceSaveMessage.value = 'Radius must be greater than 0 meters.'
    geofenceSaveMessageType.value = 'error'
    return
  }

  const markerLatLng = geofenceMarker.value.getLatLng?.()
  if (!markerLatLng) {
    geofenceSaveMessage.value = 'Invalid marker location. Please place the marker again.'
    geofenceSaveMessageType.value = 'error'
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

    if (!result || !result.id) {
      throw new Error('Server did not return a persisted geofence record.')
    }

    // Always refresh local reactive state with the newest saved data.
    geofence.value = {
      ...result,
      radius: Number(result.radius),
    }
    selectedGeofenceId.value = result.id
    geofenceName.value = geofence.value.name || 'Geofence'

    upsertGeofenceInState(geofence.value)
    renderGeofencesOnMap()

    geofenceSaveMessage.value = geofenceId ? 'Geofence updated successfully.' : 'Geofence created successfully.'
    geofenceSaveMessageType.value = 'success'
    console.log('Geofence saved:', geofence.value)
  } catch (error) {
    if (error?.code === 'ERR_NETWORK' || error instanceof TypeError) {
      geofenceSaveMessage.value = 'Network error while saving geofence. Please check your connection and try again.'
    } else {
      const details = error?.response?.data?.error || error?.message || 'Unknown error'
      geofenceSaveMessage.value = `Failed to save geofence: ${details}`
    }
    geofenceSaveMessageType.value = 'error'
    console.error('Failed to save geofence:', error)
  } finally {
    geofenceSaving.value = false
  }
}

async function deleteSelectedGeofence(fenceId = geofence.value?.id) {
  if (!fenceId || geofenceDeleting.value || geofenceSaving.value) return

  if (!id.value) {
    geofenceSaveMessage.value = 'Missing user ID. Please log in again and retry.'
    geofenceSaveMessageType.value = 'error'
    return
  }

  geofenceDeleting.value = true
  geofenceSaveMessage.value = ''
  geofenceSaveMessageType.value = ''

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

    geofenceSaveMessage.value = 'Geofence deleted successfully.'
    geofenceSaveMessageType.value = 'success'
  } catch (error) {
    if (error?.code === 'ERR_NETWORK' || error instanceof TypeError) {
      geofenceSaveMessage.value = 'Network error while deleting geofence. Please check your connection and try again.'
    } else {
      const details = error?.response?.data?.error || error?.message || 'Unknown error'
      geofenceSaveMessage.value = `Failed to delete geofence: ${details}`
    }
    geofenceSaveMessageType.value = 'error'
  } finally {
    geofenceDeleting.value = false
  }
}

let dataInterval = null

// Check authentication on mount
onMounted(async () => {
  if (!authStore.isAuthenticated) {
    // If not authenticated, redirect to login
    router.push({ name: 'login' })
    return
  }

  // Initial data load after DOM is ready
  const userId = id.value
  if (userId) {
    getUserInfo(userId)
    getEvents(userId)
    getStatus(userId)
    //fetchGeofences()

    if (dataInterval) clearInterval(dataInterval)
    dataInterval = setInterval(() => {
      getEvents(userId)
      getStatus(userId)
      //fetchGeofences()
    }, 3000)
  }
})

watch(
  id,
  (newID) => {
    if (newID) {
      // Destroy old map and clean up
      if (map.value) {
        map.value.remove()
        map.value = null
        marker.value = null
      }

      clearGeofenceDraftLayers()
      clearAllGeofenceLayers()
      geofence.value = null
      geofences.value = []

      getUserInfo(newID)
      getEvents(newID)
      getStatus(newID)
      //fetchGeofences()

      if (dataInterval) clearInterval(dataInterval)
      dataInterval = setInterval(() => {
        getEvents(newID)
        getStatus(newID)
        //fetchGeofences()
      }, 3000)
    }
  },
  { immediate: false }, // Changed from immediate: true
)

onUnmounted(() => {
  if (dataInterval) clearInterval(dataInterval)
  // Clean up map
  clearGeofenceDraftLayers()
  clearAllGeofenceLayers()
  if (map.value) {
    map.value.remove()
    map.value = null
  }
  marker.value = null
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
          <span class="brand-name">SenseWay<sup class="brand-tm">TM</sup> Dashboard</span>
          <span class="brand-sub">Your Personal Health Monitor</span>
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
          <div class="meta-item">
            <span class="meta-label">Email</span>
            <span class="meta-value meta-email">{{ authStore.user?.email || userInfo.email || '--' }}</span>
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
              <span class="meta-value premium-text">Active</span>
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
            <span class="greeting-name">{{ authStore.user?.name || userInfo.name || 'User' }}</span>
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

    <!-- Welcome Card -->
    <section class="welcome-card">
      <div class="welcome-content">
        <h1 class="welcome-title">Welcome to Your Dashboard</h1>
        <p class="welcome-subtitle">Monitor your health metrics and location in real-time</p>
      </div>
      <div class="welcome-stats">
        <div class="stat-box">
          <span class="stat-label">User ID</span>
          <span class="stat-value code-text">{{ id || 'Loading...' }}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Status</span>
          <span class="stat-value active-badge">Active</span>
        </div>
      </div>
    </section>

    <div class="dashboard-grid">
      <!-- ======== LEFT: Map ======== -->
      <section class="panel panel-map">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Your Current Location</h2>
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
        
        <!-- Geofence Controls -->
        <div class="geofence-controls">
          <h3 class="geofence-title">Geofence Settings</h3>
          <div class="geofence-name-control">
            <label class="geofence-label">Name</label>
            <input
              v-model.trim="geofenceName"
              type="text"
              maxlength="60"
              class="geofence-name-input"
              placeholder="Home perimeter"
            />
          </div>
          <div class="geofence-radius-control">
            <label class="geofence-label">Radius (meters)</label>
            <input
              type="range"
              min="50"
              max="5000"
              step="50"
              v-model="geofenceRadius"
              @input="updateRadius"
              class="geofence-slider"
            />
            <span class="geofence-radius-value">{{ geofenceRadius }} m</span>
          </div>
          <p class="geofence-helper-text">Click anywhere on the map to place or move the draft marker.</p>
          <div class="geofence-action-row">
            <button
              @click="saveGeofence"
              class="geofence-save-btn"
              :disabled="!geofenceMarker || geofenceSaving || geofenceDeleting"
            >
              {{ geofenceSaving ? 'Saving...' : geofence?.id ? 'Update Geofence' : 'Save Geofence' }}
            </button>
            <button
              @click="deleteSelectedGeofence()"
              class="geofence-delete-btn"
              :disabled="!geofence?.id || geofenceSaving || geofenceDeleting"
            >
              {{ geofenceDeleting ? 'Deleting...' : 'Delete Geofence' }}
            </button>
          </div>
          <p v-if="geofenceLoading" class="geofence-loading-text">Loading geofences...</p>
          <div v-if="geofences.length" class="geofence-list-wrap">
            <p class="geofence-list-title">Saved geofences</p>
            <div class="geofence-list">
              <button
                v-for="item in geofences"
                :key="item.id"
                class="geofence-list-item"
                :class="{ 'geofence-list-item--active': item.id === selectedGeofenceId }"
                @click="selectExistingGeofence(item.id)"
              >
                <span class="geofence-list-item-name">{{ item.name || 'Geofence' }}</span>
                <span class="geofence-list-item-meta">{{ Math.round(Number(item.radius) || 0) }} m</span>
              </button>
            </div>
          </div>
          <p
            v-if="geofenceSaveMessage"
            :class="[
              'geofence-message',
              geofenceSaveMessageType === 'success' ? 'geofence-message--success' : 'geofence-message--error',
            ]"
          >
            {{ geofenceSaveMessage }}
          </p>
        </div>
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
  justify-content: space-between;
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
  flex: 0 1 auto;
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
  flex: 1 1 auto;
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
   WELCOME CARD
   ======================================================== */
.welcome-card {
  background: linear-gradient(135deg, var(--sw-surface) 0%, rgba(59, 130, 246, 0.05) 100%);
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-radius);
  padding: 28px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
}

.welcome-content {
  flex: 1;
}

.welcome-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--sw-text);
  margin: 0 0 8px 0;
}

.welcome-subtitle {
  font-size: 14px;
  color: var(--sw-text-secondary);
  margin: 0;
}

.welcome-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.stat-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  background: var(--sw-bg);
  border: 1px solid var(--sw-border-strong);
  border-radius: var(--sw-radius-sm);
}

.stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--sw-text-muted);
  font-weight: 600;
}

.stat-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--sw-text);
}

.code-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  color: var(--sw-accent);
  word-break: break-all;
}

.active-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background: rgba(34, 197, 94, 0.15);
  border-radius: 100px;
  color: #86efac;
  font-size: 12px;
  font-weight: 600;
}

.active-badge::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse-dot 1.4s ease-in-out infinite;
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

  .welcome-card {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }

  .welcome-stats {
    justify-content: center;
  }

  .meta-email {
    white-space: normal;
    word-break: break-all;
    max-width: 150px;
    font-size: 11px;
  }
}

/* ========================================================
   GEOFENCE CONTROLS
   ======================================================== */
.geofence-controls {
  padding: 20px;
  border-top: 1px solid var(--sw-border);
  background: var(--sw-surface);
  border-radius: 0 0 var(--sw-radius-sm) var(--sw-radius-sm);
}

.geofence-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--sw-text);
  margin: 0 0 16px 0;
}

.geofence-name-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.geofence-name-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-radius-xs);
  background: var(--sw-card);
  color: var(--sw-text);
  font-size: 14px;
}

.geofence-name-input:focus {
  outline: 2px solid rgba(14, 165, 233, 0.35);
  border-color: #0ea5e9;
}

.geofence-radius-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.geofence-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--sw-text-secondary);
}

.geofence-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #f8b4b4;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.geofence-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  border: 2px solid var(--sw-surface);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.geofence-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sw-accent);
  cursor: pointer;
  border: 2px solid var(--sw-surface);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.geofence-radius-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--sw-accent);
  text-align: center;
}

.geofence-helper-text {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--sw-text-muted);
}

.geofence-action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.geofence-save-btn {
  width: 100%;
  padding: 12px 16px;
  background: var(--sw-accent);
  color: white;
  border: none;
  border-radius: var(--sw-radius-xs);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.geofence-save-btn:hover:not(:disabled) {
  background: var(--sw-accent-dim);
}

.geofence-save-btn:disabled {
  background: var(--sw-border);
  color: var(--sw-text-muted);
  cursor: not-allowed;
}

.geofence-delete-btn {
  width: 100%;
  padding: 12px 16px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: var(--sw-radius-xs);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.geofence-delete-btn:hover:not(:disabled) {
  background: #b91c1c;
}

.geofence-delete-btn:disabled {
  background: var(--sw-border);
  color: var(--sw-text-muted);
  cursor: not-allowed;
}

.geofence-loading-text {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--sw-text-muted);
}

.geofence-list-wrap {
  margin-top: 14px;
}

.geofence-list-title {
  margin: 0 0 8px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sw-text-muted);
}

.geofence-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 180px;
  overflow: auto;
}

.geofence-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-radius-xs);
  background: var(--sw-card);
  color: var(--sw-text);
  padding: 10px 12px;
  cursor: pointer;
}

.geofence-list-item--active {
  border-color: #f97316;
  box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.35);
}

.geofence-list-item-name {
  font-size: 13px;
  font-weight: 600;
}

.geofence-list-item-meta {
  font-size: 12px;
  color: var(--sw-text-muted);
}

.geofence-message {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: var(--sw-radius-xs);
  border: 1px solid transparent;
  font-size: 13px;
  line-height: 1.35;
}

.geofence-message--success {
  color: #86efac;
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.35);
}

.geofence-message--error {
  color: #fda4af;
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.35);
}
</style>
