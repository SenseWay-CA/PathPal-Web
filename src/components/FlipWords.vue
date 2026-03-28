<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  words:    { type: Array,  required: true },
  duration: { type: Number, default: 2600 },
  color:    { type: String, default: '' },     // optional accent colour
})

const idx   = ref(0)
const phase = ref('idle')   // idle | exit | enter

let timer = null

function tick() {
  phase.value = 'exit'
  setTimeout(() => {
    idx.value = (idx.value + 1) % props.words.length
    phase.value = 'enter'
    setTimeout(() => { phase.value = 'idle' }, 500)
  }, 340)
}

onMounted(()  => { timer = setInterval(tick, props.duration) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <span class="fw" :style="color ? `--fw-color:${color}` : ''">
    <span :class="['fw-w', `fw-w--${phase}`]">{{ words[idx] }}</span>
  </span>
</template>

<style scoped>
.fw {
  display: inline-block;
  perspective: 500px;
  --fw-color: #4f8ff7;
}

.fw-w {
  display: inline-block;
  transform-style: preserve-3d;
  color: var(--fw-color);
  font-style: italic;
}

/* idle = just landed, hold position */
.fw-w--idle {
  animation: fw-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* exit = flipping away */
.fw-w--exit {
  animation: fw-out 0.34s cubic-bezier(0.55, 0, 1, 0.45) both;
}

/* enter = invisible frame between exit and idle */
.fw-w--enter { opacity: 0; }

@keyframes fw-in {
  from {
    transform: rotateX(-72deg) translateY(-10px);
    opacity: 0;
    filter: blur(4px);
  }
  to {
    transform: rotateX(0deg) translateY(0);
    opacity: 1;
    filter: blur(0);
  }
}

@keyframes fw-out {
  from {
    transform: rotateX(0deg) translateY(0);
    opacity: 1;
    filter: blur(0);
  }
  to {
    transform: rotateX(72deg) translateY(10px);
    opacity: 0;
    filter: blur(4px);
  }
}
</style>
