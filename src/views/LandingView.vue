<script setup>
import { ref, onMounted } from 'vue'
import * as THREE from 'three'

const canvas = ref(null)

onMounted(() => {
  const scene = new THREE.Scene()

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  const sizes = {
    width: 800,
    height: 600,
  }

  const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height)
  camera.position.z = 3
  scene.add(camera)

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
  })
  renderer.setSize(sizes.width, sizes.height)

  renderer.render(scene, camera)
})
</script>

<template>
  <canvas ref="canvas" class="webgl"></canvas>
</template>

<style scoped></style>
