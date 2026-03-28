<script setup>
import { computed } from 'vue'

const props = defineProps({
  value:          { type: Number, default: 0 },         // 0–100
  size:           { type: Number, default: 128 },
  strokeWidth:    { type: Number, default: 10 },
  primaryColor:   { type: String, default: '#4f8ff7' },
  secondaryColor: { type: String, default: 'rgba(255,255,255,0.07)' },
  glowColor:      { type: String, default: '' },
})

const cx  = computed(() => props.size / 2)
const cy  = computed(() => props.size / 2)
const r   = computed(() => cx.value - props.strokeWidth / 2 - 3)
const circ = computed(() => 2 * Math.PI * r.value)
const off  = computed(() => circ.value * (1 - Math.min(Math.max(props.value, 0), 100) / 100))
const rot  = computed(() => `rotate(-90 ${cx.value} ${cy.value})`)
const glow = computed(() => props.glowColor || props.primaryColor)
</script>

<template>
  <div class="cp-root" :style="{ width: size + 'px', height: size + 'px' }">
    <svg
      :width="size" :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      class="cp-svg"
    >
      <defs>
        <filter :id="`glow-${$.uid}`" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- track -->
      <circle
        :cx="cx" :cy="cy" :r="r"
        fill="none"
        :stroke="secondaryColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
      />

      <!-- progress arc -->
      <circle
        :cx="cx" :cy="cy" :r="r"
        fill="none"
        :stroke="primaryColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        :stroke-dasharray="circ"
        :stroke-dashoffset="off"
        :transform="rot"
        class="cp-arc"
        :filter="`url(#glow-${$.uid})`"
      />
    </svg>

    <!-- center slot -->
    <div class="cp-center">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.cp-root {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cp-svg {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.cp-center {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.cp-arc {
  transition: stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1),
              stroke 0.5s ease;
}
</style>
