<script setup>
import { useDark, useToggle } from '@vueuse/core'
import { RouterView } from 'vue-router'

const isDark = useDark()
</script>

<template>
  <RouterView />
</template>

<style scoped></style>
