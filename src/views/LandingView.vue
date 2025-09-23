<script setup>
import { ref, onMounted } from 'vue'
import * as THREE from 'three'

const canvas = ref(null)

onMounted(() => {
  const scene = new THREE.Scene()

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(3, 0, 0)
  scene.add(mesh)

  const axesHelper = new THREE.AxesHelper(5)
  scene.add(axesHelper)

  const sizes = {
    width: 800,
    height: 600,
  }

  const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height)
  camera.position.set(1, 1, 5)
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
