<script setup>
const props = defineProps({
  imageUrl: { type: String, default: '' },
  size:      { type: Number, default: 36 },
  intensity: { type: Number, default: 10 },
})

const uid = Math.random().toString(36).slice(2, 8)
const fid = `liq-${uid}`
</script>

<template>
  <span class="liq-wrap" :style="{ width: size + 'px', height: size + 'px' }">
    <svg width="0" height="0" style="position:absolute;pointer-events:none;overflow:visible">
      <defs>
        <filter :id="fid" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="turbulence" baseFrequency="0.018" numOctaves="3" seed="4" result="turb">
            <animate attributeName="baseFrequency" values="0.018;0.028;0.018" dur="7s" repeatCount="indefinite" />
            <animate attributeName="seed" values="4;9;4" dur="14s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="turb" :scale="intensity"
            xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
    <img :src="imageUrl" class="liq-img" :style="{ filter: `url(#${fid})` }" alt="logo" />
  </span>
</template>

<style scoped>
.liq-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}
.liq-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
