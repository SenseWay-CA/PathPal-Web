<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  text:       { type: String, default: '' },
  duration:   { type: Number, default: 650 },
  colorCycle: { type: Boolean, default: false },
  trigger:    { type: Number, default: 0 },   // increment externally to re-scramble
})

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&?!'

const displayed = ref(props.text || '')
let raf = null
let startTime = null

function scramble(target) {
  if (raf) { cancelAnimationFrame(raf); raf = null }
  if (!target) { displayed.value = ''; return }
  startTime = null
  const len = target.length

  function frame(ts) {
    if (!startTime) startTime = ts
    const progress = Math.min((ts - startTime) / props.duration, 1)
    const revealed = Math.floor(progress * len)
    let out = ''
    for (let i = 0; i < len; i++) {
      if (i < revealed) {
        out += target[i]
      } else {
        const ch = target[i]
        // keep spaces and punctuation intact so layout stays stable
        if (' ,.-°/%+()'.includes(ch)) {
          out += ch
        } else {
          out += CHARS[Math.floor(Math.random() * CHARS.length)]
        }
      }
    }
    displayed.value = out
    if (progress < 1) {
      raf = requestAnimationFrame(frame)
    } else {
      displayed.value = target
      raf = null
    }
  }

  raf = requestAnimationFrame(frame)
}

onMounted(() => scramble(props.text))
onUnmounted(() => { if (raf) cancelAnimationFrame(raf) })

watch(() => props.text, (next) => {
  if (next !== displayed.value) scramble(next)
})

// re-scramble on external trigger (e.g. tab switch)
watch(() => props.trigger, () => scramble(props.text))
</script>

<template>
  <span :class="['ht', { 'ht--cycle': colorCycle }]">{{ displayed }}</span>
</template>

<style scoped>
.ht {
  display: inline;
  font-variant-numeric: tabular-nums;
}

.ht--cycle {
  background: linear-gradient(90deg, #4f8ff7 0%, #a855f7 30%, #22d3ee 60%, #4f8ff7 100%);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ht-cycle 4s linear infinite;
}

@keyframes ht-cycle {
  0%   { background-position: 0%   50%; }
  100% { background-position: 300% 50%; }
}
</style>
