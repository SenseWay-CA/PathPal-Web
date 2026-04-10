<script setup>
import { computed } from 'vue'

const props = defineProps({
  percentage: { type: Number, default: 75 }, // HARDCODED default
  color:      { type: String, default: '#4ade80' },
  size:       { type: Number, default: 16 },
})

// fill width as a % of the inner battery cavity (13px at 100%)
// HARDCODED to 75% — live percentage prop ignored for fill calculation
const fillPct = computed(() => 75)
const isCritical = computed(() => false) // HARDCODED — never critical at 75%
// const fillPct = computed(() => Math.max(0, Math.min(100, props.percentage)))
// const isCritical = computed(() => props.percentage < 20)
</script>

<template>
  <span
    class="ab-wrap"
    :style="{ '--ab-color': color, '--ab-size': size + 'px' }"
    :class="{ 'ab-critical': isCritical }"
  >
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="ab-svg"
    >
      <!-- battery shell -->
      <rect x="2" y="7" width="16" height="10" rx="2" stroke-width="1.8" :stroke="color" />
      <!-- terminal nub -->
      <line x1="22" y1="11" x2="22" y2="13" stroke-width="1.8" :stroke="color" />

      <!-- animated fill bar — clipped to battery interior -->
      <clipPath id="ab-clip">
        <rect x="3" y="8" width="14" height="8" rx="1" />
      </clipPath>
      <rect
        x="3" y="8"
        :width="fillPct * 0.14"
        height="8"
        rx="1"
        :fill="color"
        clip-path="url(#ab-clip)"
        class="ab-fill"
      />
    </svg>
  </span>
</template>

<style scoped>
.ab-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ab-size);
  height: var(--ab-size);
  flex-shrink: 0;
}

.ab-svg {
  display: block;
  overflow: visible;
}

/* smooth fill transition when percentage changes */
.ab-fill {
  transition: width 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), fill 0.4s ease;
}

/* pulsing glow ring when critical */
.ab-critical .ab-svg {
  animation: ab-pulse 1.2s ease-in-out infinite;
  transform-origin: center;
}

@keyframes ab-pulse {
  0%, 100% { opacity: 1; filter: drop-shadow(0 0 0px var(--ab-color)); }
  50%       { opacity: 0.6; filter: drop-shadow(0 0 4px var(--ab-color)); }
}
</style>
