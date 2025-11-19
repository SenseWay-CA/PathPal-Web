<script setup>
import { useDark } from '@vueuse/core'
import { ref, watch, onMounted, onUnmounted } from 'vue'


const url = "https://api.senseway.ca";

const isDark = useDark()

import { BatteryCharging } from 'lucide-vue-next';

import { Card, CardContent } from "@/components/ui/card"



const id = ref("c1987b12-3ffe-432a-ac13-4b06264409ed")
const mapUrl = ref("https://maps.google.com/maps?width=100%25&height=600&hl=en&q=$45.419592302696536,-75.67853992158024+(SenseWay)&t=&z=15&ie=UTF8&iwloc=B&output=embed")

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


async function getUserInfo(newID) {
  try {
    const response = await fetch(`${url}/user?user_id=${newID}`);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    userInfo.value = await response.json();
    mapUrl.value = `https://maps.google.com/maps?width=100%25&height=600&hl=en&q=${status.value.latitude},${status.value.longitude}+(SenseWay)&t=&z=15&ie=UTF8&iwloc=B&output=embed`


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
    dataInterval = setInterval(() => { getEvents(newID); getStatus(newID); }, 5000);
  }
}, { immediate: true });

onUnmounted(() => {
  if (dataInterval) clearInterval(dataInterval);
});

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
            SenseWay
          </span>
          <span class="text-xs text-neutral-400">
            Monitoring {{ userInfo.name }}'s Cane
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

      <div id="h-right" class="w-full md:flex-1 border border-neutral-700/60 rounded-2xl px-5 py-3.5
               flex items-center justify-end gap-3 shadow-sm bg-neutral-900/60
               min-h-[3.5rem] md:min-h-[4rem]">
        <div class="h-9 w-9 rounded-full border border-neutral-600 flex items-center justify-center
                 bg-neutral-800/80">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-neutral-200" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.8">
            <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
            <path d="M4 20a8 8 0 0 1 16 0" />
          </svg>
        </div>

        <span class="text-lg leading-none">🇨🇦</span>

        <div class="flex flex-col items-end leading-tight">
          <span class="text-xs text-neutral-400">Welcome back,</span>
          <span class="text-base font-semibold text-neutral-100">
            {{ userInfo.name }}
          </span>
        </div>
      </div>
    </div>
  </header>



  <main class="p-4 flex flex-col gap-4 w-full">
    <!-- Blue Header Bar -->
    <div class="h-2 bg-blue-600 rounded-full mb-2" />

    <!-- Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-7xl mx-auto w-full">
      <!-- Left Panel - Google Maps -->
      <div class="border-2 border-border rounded-3xl bg-card p-8 min-h-[500px] flex flex-col">
        <h2 class="text-lg font-medium text-green-500 mb-4">Live Cane Location</h2>
        <iframe width="100%" height="100%" frameborder="0" scrolling="no" class="rounded-2xl flex-1" :src="mapUrl" />
      </div>

      <!-- Right Side -->
      <div class=" flex flex-col gap-4">
        <!-- Top 4 Cards -->
        <div class="grid grid-cols-4 gap-4">
          <div
            class=" col-span-2 border-2 border-border rounded-3xl bg-card p-6 aspect-square flex items-center justify-center">
            <span class="font-medium text-center text-card-foreground">Battery: {{ status.battery }}%</span>
          </div>
          <div
            class=" col-span-2 border-2 border-border rounded-3xl bg-card p-6 aspect-square flex items-center justify-center">
            <span class="font-medium text-center text-card-foreground">Heart Rate: {{ status.heart_rate || 'N/A'
              }}</span>
          </div>
        </div>

        <!-- Events Panel -->
        <div class="border-2 border-border rounded-3xl bg-card p-8 flex-1 min-h-[400px]">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-medium text-green-500">Events</h2>
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
                    <span
                      class="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
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
  </main>

  <footer class="fixed -bottom-4 left-1/2 -translate-x-1/2
               w-[90%] max-w-2xl
               text-center text-sm
               border border-neutral-700/60
               rounded-2xl
               px-5 py-3.5
               bg-neutral-900/60
               backdrop-blur
               text-neutral-400
               shadow-sm">
    <p>All rights reserved © 2025</p>
  </footer>
</template>


<style scoped></style>
