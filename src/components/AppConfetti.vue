<script setup>
import { ref } from 'vue'
import confetti from 'canvas-confetti'

const canvasRef = ref(null)
let myConfetti = null

function getConfetti() {
  if (!myConfetti && canvasRef.value) {
    myConfetti = confetti.create(canvasRef.value, { resize: true, useWorker: false })
  }
  return myConfetti
}

// App-brand colors: blue, purple, cyan, green
const COLORS = ['#4f8ff7', '#a855f7', '#22d3ee', '#22c55e', '#818cf8', '#c084fc', '#38bdf8']

function fire(opts = {}) {
  const fn = getConfetti()
  if (!fn) return
  // burst from top-center
  fn({
    particleCount: 120,
    spread: 70,
    origin: { x: 0.5, y: 0.05 },
    colors: COLORS,
    startVelocity: 38,
    ticks: 220,
    gravity: 0.9,
    scalar: 1.1,
    ...opts,
  })
  // side bursts
  setTimeout(() => fn({
    particleCount: 50,
    spread: 55,
    origin: { x: 0.15, y: 0.1 },
    angle: 60,
    colors: COLORS,
    startVelocity: 30,
    ticks: 180,
  }), 80)
  setTimeout(() => fn({
    particleCount: 50,
    spread: 55,
    origin: { x: 0.85, y: 0.1 },
    angle: 120,
    colors: COLORS,
    startVelocity: 30,
    ticks: 180,
  }), 80)
}

defineExpose({ fire })
</script>

<template>
  <canvas ref="canvasRef" class="confetti-canvas" />
</template>

<style scoped>
.confetti-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}
</style>
