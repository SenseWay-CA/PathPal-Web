<script setup>
import { useDark } from '@vueuse/core'
import { RouterView } from 'vue-router'
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'



const url = "https://api.senseway.ca";

const isDark = useDark()

import { BatteryCharging } from 'lucide-vue-next';
import { Card, CardContent } from "@/components/ui/card"



const id = ref("c1987b12-3ffe-432a-ac13-4b06264409ed")

const map = ref(null);
const marker = ref(null);
const myIcon = L.icon({
  iconUrl: 'https://i.gyazo.com/2c2f86cbde1c24b59b380f1da714df48.png',
  iconSize: [38, 38],
  iconAnchor: [12, 15],
  popupAnchor: [-3, -76],
  shadowUrl: null,
  shadowSize: [68, 95],
  shadowAnchor: [22, 94]
});

const events = ref([])

const status = ref({
  id: 0,
  user_id: "",
  longitude: 0,
  latitude: 0,
  battery: 0,
  heart_rate: null,
  created_at: ""
})


const userInfo = ref({
  user_id: "",
  email: "",
  name: "",
  type: "",
  birth_date: "",
  home_long: 0,
  home_lat: 0,
  created_at: "",
  password: ""
})

const nearestPlace = ref({
  name: "",
  city: "",
  country: "",
  postcode: ""
})

const nearestPlaceLabel = computed(() => {
  const { name, city, country, postcode } = nearestPlace.value
  if (!name && !city && !country && !postcode) return ""

  // Build "Name, City, Country, POSTAL"
  return [name, city, country, postcode].filter(Boolean).join(", ")
})

async function fetchNearestPlace(lat, lon) {
  if (lat == null || lon == null) return

  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
    )

    if (!resp.ok) return

    const data = await resp.json()
    const address = data.address || {}

    nearestPlace.value = {
      name:
        data.name ||
        address.building ||
        address.amenity ||
        address.shop ||
        "",
      city:
        address.city ||
        address.town ||
        address.village ||
        address.suburb ||
        "",
      country: address.country || "",
      postcode: address.postcode || ""
    }
  } catch (e) {
    console.error("Failed to fetch nearest place:", e)
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

  const type = (event.type || "").toString().toLowerCase()
  const name = (event.name || "").toString().toLowerCase()

  return type.includes("fall") || type.includes("sos") ||
    name.includes("fall") || name.includes("sos")
}


// avatar sizing with help of java
const avatarOffsetX = ref(-19)
const avatarOffsetY = ref(1.0)
const avatarScale = ref(1.07)


const batteryImage = computed(() => {
  const p = batteryPercentage.value
  // Lol next level coding - Battery Image Vals (Sail)
  if (p >= 90) return "https://i.gyazo.com/d8f07b4c5caf5893defeee42c04484f6.png"
  if (p >= 80) return "https://i.gyazo.com/640c65fca45a2c0eb65e9eafec43f636.png"
  if (p >= 70) return "https://i.gyazo.com/1879fc61702ee3e90d1e10d620ccb366.png"
  if (p >= 60) return "https://i.gyazo.com/911be89cf04aaa67fe96815c8c66e8e2.png"
  if (p >= 50) return "https://i.gyazo.com/ff743192cab5d12bf688fc99a665c5ec.png"
  if (p >= 40) return "https://i.gyazo.com/f21adce8288ccb2c90e2aeba63e4fbea.png"
  if (p >= 30) return "https://i.gyazo.com/3477adab0848a4bc3bb8376963160303.png"
  if (p >= 20) return "https://i.gyazo.com/3ed3d7e883949741fe58b6c4e59e4a5c.png"
  if (p >= 10) return "https://i.gyazo.com/cb03b04add5f0b325df799f8b3e76cbf.png"
  return "https://i.gyazo.com/fbab5c2c7805c1756e5d1afd1cdbdd59.png"
})

const batteryTextColor = computed(() => {
  const p = batteryPercentage.value

  // text colors lol
  if (p > 51) return "rgba(54, 167, 81, 1)"
  if (p >= 10) return "rgba(249, 186, 4, 1)"
  return "rgba(229, 62, 55, 1)"
})

const heartImages = [
  "https://i.gyazo.com/7c390eaaf22543c97e2fec0524e27afa.png",
  "https://i.gyazo.com/ce05866c1ded35069062c8fe4bec1a0a.png",
]

// colors lol - edit only
const heartColors = [
  "rgb(255,150,144)", "rgb(255,142,136)", "rgb(255,134,128)", "rgb(255,127,120)",
  "rgb(255,119,112)", "rgb(255,111,104)", "rgb(255,103,95)", "rgb(255,96,87)",
  "rgb(255,88,79)", "rgb(255,80,71)", "rgb(255,72,63)", "rgb(255,65,55)",
  "rgb(255,57,46)", "rgb(255,49,38)", "rgb(255,41,30)", "rgb(255,34,22)",
  "rgb(255,26,14)", "rgb(255,18,6)", "rgb(252,12,0)", "rgb(244,12,0)",
  "rgb(236,11,0)", "rgb(228,11,0)", "rgb(220,11,0)", "rgb(212,10,0)",
  "rgb(204,10,0)", "rgb(195,9,0)", "rgb(187,9,0)", "rgb(179,9,0)"
]
const heartColorsGreen = [
  "rgb(178,213,178)", "rgb(147,196,147)", "rgb(173,210,173)", "rgb(141,193,141)",
  "rgb(168,208,168)", "rgb(136,190,136)", "rgb(162,205,162)", "rgb(131,188,131)",
  "rgb(157,202,157)", "rgb(125,185,125)", "rgb(152,199,152)", "rgb(120,182,120)",
  "rgb(115,179,115)", "rgb(86,159,86)", "rgb(110,176,110)", "rgb(83,153,83)",
  "rgb(104,173,104)", "rgb(80,148,80)", "rgb(99,170,99)", "rgb(78,143,78)",
  "rgb(94,167,94)", "rgb(75,138,75)", "rgb(89,164,89)", "rgb(72,132,72)",
  "rgb(69,127,69)", "rgb(66,122,66)", "rgb(63,116,63)", "rgb(60,111,60)",
  "rgb(57,106,57)", "rgb(55,100,55)"
];


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
    currentHeartImageIndex.value =
      (currentHeartImageIndex.value + 1) % heartImages.length
  }, 300)

  heartColorInterval = setInterval(() => {
    const colors = activeHeartColors.value
    const len = colors.length || 1

    currentHeartColorIndex.value =
      (currentHeartColorIndex.value + 1) % len

    currentHeartTextColorIndex.value =
      (currentHeartTextColorIndex.value - 1 + len) % len
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
    alertColorIndex.value =
      (alertColorIndex.value + 1) % alertColors.length
  }, 80)
})

onUnmounted(() => {
  clearInterval(alertColorInterval)
})






async function getUserInfo(newID) {
  try {
    const response = await fetch(`${url}/user?user_id=${newID}`);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    userInfo.value = await response.json();



    console.log(userInfo.value);



  } catch (error) {
    console.error(error.message);
  }
}

async function getEvents(currentId) {
  if (!currentId) return;
  try {
    const response = await fetch(`${url}/events?user_id=${currentId}&quantity=10`);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    events.value = await response.json();

    events.value.forEach(element => {
      if (element.type == "Low_Battery") {
        element.type = "Battery"
      }
    });
    console.log('Fetched Events:', events.value);
  } catch (error) {
    console.error('Failed to fetch events:', error.message);
  }
}

async function getStatus(currentId) {
  if (!currentId) return;

  try {
    const response = await fetch(`${url}/status?user_id=${currentId}`);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    status.value = await response.json();
    const lat = status.value.latitude;
    const lon = status.value.longitude;

    if (map.value) {
      map.value.setView([lat, lon]);
      if (marker.value) {
        marker.value.setLatLng([lat, lon]);
      } else {
        marker.value = L.marker([lat, lon], { icon: myIcon }).addTo(map.value);
      }
    } else {
      map.value = L.map('map').setView([lat, lon], 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          `
     <span style="color:#0078a8;">
        SenseWay © 2025
     </span>`
      }).addTo(map.value);

      marker.value = L.marker([lat, lon], { icon: myIcon }).addTo(map.value);
    }


    fetchNearestPlace(lat, lon);

    console.log('Fetched Status:', status.value);
  } catch (error) {
    console.error('Failed to fetch status:', error.message);
  }
}


let dataInterval = null;

watch(id, (newID) => {
  if (newID) {
    getUserInfo(newID);
    getEvents(newID);
    getStatus(newID);


    if (dataInterval) clearInterval(dataInterval);
    dataInterval = setInterval(() => { getEvents(newID); getStatus(newID); }, 3000);
  }
}, { immediate: true });

onUnmounted(() => {
  if (dataInterval) clearInterval(dataInterval);
});



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//
//                                           C O N C E P T :  S E N S E W A Y
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

</script>

<template>
  <header class="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
    <div class="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row items-stretch md:items-stretch gap-4">
      <div id="h-left" class="w-full md:flex-1 border border-neutral-700/60 rounded-2xl px-5 py-3.5
               flex items-center justify-start gap-3 shadow-sm bg-neutral-900/60
               min-h-[3.5rem] md:min-h-[4rem]">
        <img src="https://i.gyazo.com/5ebc3dc6c713fc1ae66bcc5d4704a0bd.png" class="h-10 w-auto object-contain" />

        <div class="text-neutral-400 font-bold tracking-wide text-xl">
          |
        </div>

        <div class="flex flex-col leading-tight">
          <span class="text-neutral-200 font-bold tracking-wide text-lg">
            SenseWay™ DEMO
          </span>
          <span class="text-xs text-neutral-400">
            Currently monitoring {{ userInfo.name }}'s Cane
          </span>
        </div>
      </div>

      <div id="h-middle" class="w-full md:flex-1 border border-neutral-700/60 rounded-2xl px-5 py-3.5
               flex items-center gap-3 shadow-sm bg-neutral-900/60
               min-h-[3.5rem] md:min-h-[4rem]">
        <label class="text-sm text-neutral-300 whitespace-nowrap">
          Cane User ID
        </label>

        <input v-model="id" type="text" placeholder="Enter your cane user ID..." class="flex-1 bg-neutral-900/80 border border-neutral-600 rounded-xl
                 px-3 py-1.5 text-sm text-neutral-100
                 placeholder:text-neutral-500
                 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400" />

        <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full
                 bg-red-600 text-[0.65rem] font-semibold uppercase
                 tracking-wide text-white">
          LIVE
        </span>
      </div>

      <div id="h-right" class="w-full md:flex-1 border border-neutral-700/60 rounded-2xl px-4 py-2
         flex items-center justify-between gap-6 shadow-sm bg-neutral-900/60">

        <!-- Left: Age + Premium -->
        <div class="flex items-center gap-6 text-xs">
          <div class="flex flex-col leading-tight">
            <span class="text-[11px] text-neutral-400">Age</span>
            <span class="text-sm font-semibold text-neutral-100">
              {{ userAge ?? '—' }}
            </span>
          </div>

          <div class="h-7 w-px bg-neutral-800"></div>

          <div class="flex items-center gap-2">
            <img src="https://i.gyazo.com/d40ab0225c23f165f4ac8422315ebbb6.png" alt="Premium" class="h-5 w-auto" />
            <div class="flex flex-col leading-tight">
              <span class="text-[11px] text-neutral-400">Status</span>
              <span class="text-xs font-semibold text-amber-300">
                Premium Member
              </span>
            </div>
          </div>
        </div>

        <!-- Right: Avatar + Two-line welcome (movable & scalable) -->
        <div class="flex items-center gap-3" :style="{
          transform: `translate(${avatarOffsetX}px, ${avatarOffsetY}px) scale(${avatarScale})`,
          transformOrigin: 'center right'
        }">
          <div class="h-8 w-8 rounded-full border border-neutral-600 flex items-center justify-center
           bg-neutral-800/80">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-neutral-200" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.8">
              <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
              <path d="M4 20a8 8 0 0 1 16 0" />
            </svg>
          </div>

          <div class="flex flex-col leading-tight">
            <span class="text-[10px] text-neutral-400">
              Welcome Back,
            </span>

            <span class="text-sm font-semibold text-neutral-100">
              {{ userInfo.name || 'John Doe' }}
            </span>
          </div>
        </div>
      </div>


    </div>
  </header>



  <main class="p-4 flex flex-col gap-4 w-full">
    <!-- Blue Header Bar -->
    <div class="h-2 bg-blue-600 rounded-full mb-2" />

    <!-- Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-7xl mx-auto w-full">
      <!-- Left Panel - Leaflet Maps -->
      <div class="border-2 border-border rounded-3xl bg-card p-8 min-h-[500px] flex flex-col">
        <h2 class="text-lg font-medium text-neutral-100 mb-1">Live Cane Location</h2>

        <!-- Nearest Place Display -->
        <p v-if="nearestPlaceLabel" class="text-xs text-neutral-400 mb-3">
          Nearest: {{ nearestPlaceLabel }}
        </p>

        <!-- Map -->
        <div id="map" class="rounded-2xl w-full h-[420px] overflow-hidden"></div>
      </div>


      <!-- Right Side -->
      <div class=" flex flex-col gap-4">
        <!-- Top 4 Cards -->
        <div class="grid grid-cols-4 gap-4">

          <div class="col-span-2 border-2 border-border rounded-3xl bg-card
           aspect-square relative overflow-hidden flex items-center justify-center">
            <img :src="batteryImage" alt="Battery"
              class="absolute inset-0 w-full h-full object-contain opacity-95 pointer-events-none" />

            <div class="absolute z-10 font-semibold
         drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" :style="{
          top: '7%',
          left: '49.2%',
          transform: 'translateX(-50%)',
          fontSize: '55px',
          color: batteryTextColor
        }">
              {{ batteryPercentage }}%
            </div>
          </div>

          <!-- Heart rate card -->
          <div class="col-span-2 border-2 border-border rounded-3xl bg-card
         aspect-square relative overflow-hidden flex items-center justify-center">
            <div class="absolute rounded-full blur-3xl opacity-75" :style="{
              width: '80%',
              height: '80%',
              backgroundColor: currentHeartColor
            }"></div>

            <img :src="currentHeartImage" alt="Heart"
              class="relative z-10 w-[70%] h-[70%] object-contain pointer-events-none" />

            <div class="absolute z-20 font-semibold text-center
           drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]" :style="{
            top: '27%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '40px',
            color: currentHeartTextColor
          }">
              {{ status.heart_rate || 'N/A' }}<span v-if="status.heart_rate"> bpm</span>
            </div>
          </div>


        </div>


        <!-- Events Panel -->
        <div class="border-2 border-border rounded-3xl bg-card p-8 flex-1 min-h-[400px]">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-medium text-neutral-100">Events Feed</h2>
            <span v-if="events.length" class="text-xs text-neutral-400">
              Showing {{ events.length }} recent events
            </span>
          </div>

          <div v-if="!events.length" class="space-y-6">
            <p class="text-sm text-neutral-400">
              No recent events for this user.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div class="text-xs uppercase tracking-wide text-neutral-500">Name</div>
                <div class="text-neutral-100">
                  {{ userInfo.name || '—' }}
                </div>
              </div>

              <div>
                <div class="text-xs uppercase tracking-wide text-neutral-500">Email</div>
                <div class="text-neutral-100">
                  {{ userInfo.email || '—' }}
                </div>
              </div>

              <div>
                <div class="text-xs uppercase tracking-wide text-neutral-500">Type</div>
                <div class="text-neutral-100">
                  {{ userInfo.type || '—' }}
                </div>
              </div>

              <div>
                <div class="text-xs uppercase tracking-wide text-neutral-500">Birth date</div>
                <div class="text-neutral-100">
                  {{ userInfo.birth_date || '—' }}
                </div>
              </div>
            </div>
          </div>

          <div v-else class="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/40">
            <table class="w-full text-sm">
              <thead class="bg-neutral-900/80">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                    Event
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                    Type
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                    Description
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                    Time
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="event in events" :key="event.id"
                  class="border-t border-neutral-800 hover:bg-neutral-900/60 transition-colors">
                  <td class="px-4 py-3 font-medium text-neutral-100">
                    {{ event.name }}
                  </td>

                  <td class="px-4 py-3">
                    <span :class="[
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium transition-colors',
                      isAlertEvent(event)
                        ? 'border border-red-500/70 text-red-100'
                        : 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    ]" :style="isAlertEvent(event)
                      ? {
                        backgroundColor: currentAlertColor,
                        transition: 'background-color 90ms linear'
                      }
                      : {}
                      ">
                      {{ event.type }}
                    </span>
                  </td>

                  <td class="px-4 py-3 text-neutral-200">
                    {{ event.description }}
                  </td>

                  <td class="px-4 py-3 text-neutral-400 text-xs whitespace-nowrap">
                    {{ new Date(event.created_at).toLocaleString() }}
                  </td>
                </tr>
              </tbody>

            </table>
          </div>
        </div>

      </div>
    </div>
    <main class="p-4 flex flex-col gap-4 w-full">
      <!-- Blue Header Bar -->
      <div class="h-2 bg-blue-600 rounded-full mb-2" />

    </main>
  </main>

  <footer class="fixed -bottom-4 left-1/2 -translate-x-1/2
               w-[80%] max-w-7xl
               text-center text-sm
               border border-neutral-700/60
               rounded-2xl
               px-4 py-3.5
               bg-neutral-900/60
               backdrop-blur
               text-neutral-300
               shadow-sm">
    <p>SenseWay © 2025 All Rights Reserved | Non Profit Organization</p>
  </footer>
</template>


<style scoped>
#map {
  height: 100%;
}
</style>
