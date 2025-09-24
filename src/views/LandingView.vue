<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

const containerRef = ref(null)
let camera
let scene
let renderer
let controls
let elderlyMan

const initThree = () => {
  if (!containerRef.value) return

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xa0c8ec) // Clear blue sky color
  scene.fog = new THREE.Fog(0xa0c8ec, 120, 300)

  // Camera
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(30, 25, 40)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
  directionalLight.position.set(-60, 70, 40)
  directionalLight.castShadow = true
  directionalLight.shadow.camera.top = 100
  directionalLight.shadow.camera.bottom = -100
  directionalLight.shadow.camera.left = -100
  directionalLight.shadow.camera.right = 100
  directionalLight.shadow.mapSize.width = 4096
  directionalLight.shadow.mapSize.height = 4096
  scene.add(directionalLight)

  // Materials
  const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.9 })
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a })
  const redMaterial = new THREE.MeshStandardMaterial({ color: 0xdd1100, roughness: 0.4 })
  const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x6bbd6b, roughness: 1 })
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x4c4c4c,
    roughness: 0.6,
    metalness: 0.8,
  })
  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.6 })
  const lightOnMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const lightOffMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 })
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 })

  // Environment
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), grassMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const roadWidth = 32

  const roadGeo = new THREE.BoxGeometry(roadWidth, 0.1, 300)
  const mainRoad = new THREE.Mesh(roadGeo, roadMaterial)
  mainRoad.position.y = 0.05
  mainRoad.receiveShadow = true
  scene.add(mainRoad)
  const crossRoad = new THREE.Mesh(new THREE.BoxGeometry(300, 0.1, roadWidth), roadMaterial)
  crossRoad.position.y = 0.05
  crossRoad.receiveShadow = true
  scene.add(crossRoad)

  const crosswalkLength = 12
  const stripeWidth = 2.5
  const stripeSpacing = 1.5
  const numStripes = 7
  const totalStripesWidth = numStripes * stripeWidth + (numStripes - 1) * stripeSpacing
  const startOffset = -totalStripesWidth / 2 + stripeWidth / 2
  const roadEdge = roadWidth / 2

  for (let i = 0; i < numStripes; i++) {
    const currentStripeOffset = startOffset + i * (stripeWidth + stripeSpacing)
    const topStripeGeo = new THREE.BoxGeometry(stripeWidth, 0.1, crosswalkLength)
    const topStripe = new THREE.Mesh(topStripeGeo, whiteMaterial)
    topStripe.position.set(currentStripeOffset, 0.1, -roadEdge - crosswalkLength / 2)
    topStripe.receiveShadow = true
    scene.add(topStripe)
    const bottomStripe = new THREE.Mesh(topStripeGeo, whiteMaterial)
    bottomStripe.position.set(currentStripeOffset, 0.1, roadEdge + crosswalkLength / 2)
    bottomStripe.receiveShadow = true
    scene.add(bottomStripe)
    const leftStripeGeo = new THREE.BoxGeometry(crosswalkLength, 0.1, stripeWidth)
    const leftStripe = new THREE.Mesh(leftStripeGeo, whiteMaterial)
    leftStripe.position.set(-roadEdge - crosswalkLength / 2, 0.1, currentStripeOffset)
    leftStripe.receiveShadow = true
    scene.add(leftStripe)
    const rightStripe = new THREE.Mesh(leftStripeGeo, whiteMaterial)
    rightStripe.position.set(roadEdge + crosswalkLength / 2, 0.1, currentStripeOffset)
    rightStripe.receiveShadow = true
    scene.add(rightStripe)
  }
  const boundaryLineGeoTB = new THREE.BoxGeometry(totalStripesWidth, 0.1, 0.5)
  const boundaryLineGeoLR = new THREE.BoxGeometry(0.5, 0.1, totalStripesWidth)
  const createBoundaryLine = (x, z, geo) => {
    const line = new THREE.Mesh(geo, whiteMaterial)
    line.position.set(x, 0.1, z)
    line.receiveShadow = true
    scene.add(line)
  }
  createBoundaryLine(0, -roadEdge, boundaryLineGeoTB)
  createBoundaryLine(0, -roadEdge - crosswalkLength, boundaryLineGeoTB)
  createBoundaryLine(0, roadEdge, boundaryLineGeoTB)
  createBoundaryLine(0, roadEdge + crosswalkLength, boundaryLineGeoTB)
  createBoundaryLine(-roadEdge, 0, boundaryLineGeoLR)
  createBoundaryLine(-roadEdge - crosswalkLength, 0, boundaryLineGeoLR)
  createBoundaryLine(roadEdge, 0, boundaryLineGeoLR)
  createBoundaryLine(roadEdge + crosswalkLength, 0, boundaryLineGeoLR)

  const createDetailedBuilding = (x, z, width, depth, height) => {
    const buildingGroup = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), whiteMaterial)
    body.castShadow = true
    body.receiveShadow = true
    buildingGroup.add(body)
    const door = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.2), doorMaterial)
    door.position.set(0, -height / 2 + 2.5, depth / 2 + 0.1)
    buildingGroup.add(door)
    const numFloors = Math.floor((height - 7) / 4)
    const numWindows = Math.floor((width - 6) / 4)
    for (let i = 0; i < numFloors; i++) {
      for (let j = 0; j < numWindows; j++) {
        const windowPane = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 0.2), windowMaterial)
        const posX = (j - (numWindows - 1) / 2) * 4
        const posY = -height / 2 + 8 + i * 4
        windowPane.position.set(posX, posY, depth / 2 + 0.1)
        buildingGroup.add(windowPane)
      }
    }
    buildingGroup.position.set(x, height / 2, z)
    scene.add(buildingGroup)
  }
  const buildingOffset = roadWidth / 2 + 20
  createDetailedBuilding(buildingOffset, buildingOffset, 25, 25, 80)
  createDetailedBuilding(-buildingOffset, -buildingOffset, 30, 25, 100)
  createDetailedBuilding(buildingOffset, -buildingOffset, 28, 20, 70)
  createDetailedBuilding(-buildingOffset, buildingOffset, 22, 22, 90)

  const createCar = (x, z, rotationY) => {
    const carGroup = new THREE.Group()
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2, 8), whiteMaterial)
    carBody.position.y = 2
    carBody.castShadow = true
    carGroup.add(carBody)
    const carCabin = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 5), whiteMaterial)
    carCabin.position.set(0, 3.8, -0.5)
    carCabin.castShadow = true
    carGroup.add(carCabin)
    const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 32)
    const wheelPositions = [
      { x: -2.25, z: 2.5 },
      { x: 2.25, z: 2.5 },
      { x: -2.25, z: -2.5 },
      { x: 2.25, z: -2.5 },
    ]
    wheelPositions.forEach((pos) => {
      const wheel = new THREE.Mesh(wheelGeo, tireMaterial)
      wheel.position.set(pos.x, 0.8, pos.z)
      wheel.rotation.z = Math.PI / 2
      wheel.castShadow = true
      carGroup.add(wheel)
    })
    carGroup.position.set(x, 0, z)
    carGroup.rotation.y = rotationY
    scene.add(carGroup)
  }
  createCar(6, 25, 0)
  createCar(-6, -25, Math.PI)

  const createTrafficLight = (x, z, rotY) => {
    const poleGroup = new THREE.Group()
    const poleHeight = 18
    const mastArmLength = 16
    const verticalPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, poleHeight, 16),
      metalMaterial,
    )
    verticalPole.castShadow = true
    poleGroup.add(verticalPole)
    const mastArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, mastArmLength, 16),
      metalMaterial,
    )
    mastArm.castShadow = true
    mastArm.position.set(mastArmLength / 2, poleHeight / 2 - 1, 0)
    mastArm.rotation.z = Math.PI / 2
    poleGroup.add(mastArm)
    const createLightBox = (posX) => {
      const lightBox = new THREE.Group()
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 1), metalMaterial)
      box.castShadow = true
      const backPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.8), metalMaterial)
      backPlate.position.z = -0.55
      box.add(backPlate)
      for (let i = 0; i < 3; i++) {
        const yPos = 0.7 - i * 0.7
        const visor = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16, 1, true, 0, Math.PI),
          metalMaterial,
        )
        visor.position.set(0, yPos, 0.9)
        visor.rotation.x = Math.PI / 2
        box.add(visor)
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.3),
          i === 0 ? lightOnMaterial : lightOffMaterial,
        )
        light.position.y = yPos
        box.add(light)
      }
      lightBox.position.set(posX, poleHeight / 2 - 3, 0)
      return lightBox
    }
    poleGroup.add(createLightBox(5))
    poleGroup.add(createLightBox(12))
    poleGroup.position.set(x, poleHeight / 2, z)
    poleGroup.rotation.y = rotY
    scene.add(poleGroup)
  }
  const lightPos = roadWidth / 2 + 4
  createTrafficLight(lightPos, lightPos, -Math.PI / 2)
  createTrafficLight(-lightPos, lightPos, Math.PI)
  createTrafficLight(lightPos, -lightPos, 0)
  createTrafficLight(-lightPos, -lightPos, Math.PI / 2)

  elderlyMan = new THREE.Group()
  const manMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 2.8, 32), manMaterial)
  torso.position.y = 3
  torso.castShadow = true
  elderlyMan.add(torso)
  const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 2.5, 16), manMaterial)
  leg1.position.set(-0.4, 0.5, 0)
  leg1.castShadow = true
  elderlyMan.add(leg1)
  const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 2.5, 16), manMaterial)
  leg2.position.set(0.4, 0.5, 0)
  leg2.castShadow = true
  elderlyMan.add(leg2)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 32), manMaterial)
  head.position.y = 4.8
  head.castShadow = true
  elderlyMan.add(head)
  const armRight = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 2.5, 16), manMaterial)
  armRight.castShadow = true
  armRight.position.set(1.4, 2.9, 0.2)
  armRight.rotation.z = Math.PI / 5
  elderlyMan.add(armRight)
  const armLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 2.5, 16), manMaterial)
  armLeft.castShadow = true
  armLeft.position.set(-1.0, 2.8, 0.1)
  armLeft.rotation.z = -Math.PI / 12
  elderlyMan.add(armLeft)

  const cane = new THREE.Group()
  const shaftHeight = 4.5
  const handleRadius = 0.6
  const tubeRadius = 0.12
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(tubeRadius, tubeRadius, shaftHeight, 16),
    redMaterial,
  )
  shaft.castShadow = true
  shaft.position.y = shaftHeight / 2
  cane.add(shaft)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, shaftHeight, 0),
    new THREE.Vector3(0, shaftHeight + handleRadius * 0.8, 0),
    new THREE.Vector3(handleRadius * 0.6, shaftHeight + handleRadius * 1.2, 0),
    new THREE.Vector3(handleRadius, shaftHeight + handleRadius * 0.8, 0),
    new THREE.Vector3(handleRadius, shaftHeight, 0),
  ])
  const handleGeometry = new THREE.TubeGeometry(curve, 20, tubeRadius, 8, false)
  const handle = new THREE.Mesh(handleGeometry, redMaterial)
  handle.castShadow = true
  cane.add(handle)
  cane.position.set(2.0, -2.1, 0.5)
  cane.rotation.z = -Math.PI / 12
  cane.rotation.y = -Math.PI / 8
  elderlyMan.add(cane)

  elderlyMan.position.set(roadWidth / 2 + 2, 0, roadWidth / 2 + 2) // Position on grass
  elderlyMan.rotation.y = (-3 * Math.PI) / 4
  scene.add(elderlyMan)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.minDistance = 20
  controls.maxDistance = 100
  controls.maxPolarAngle = Math.PI / 2.2
  controls.enablePan = false
  controls.target.set(elderlyMan.position.x, elderlyMan.position.y + 2, elderlyMan.position.z)

  const animate = () => {
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onWindowResize)
  onUnmounted(() => window.removeEventListener('resize', onWindowResize))
  animate()
}

onMounted(() => {
  initThree()
})
</script>

<template>
  <div ref="containerRef" class="relative w-full h-screen overflow-hidden bg-black">
    <div class="absolute inset-0 bg-black opacity-50 z-10 pointer-events-none"></div>
    <div class="absolute inset-0 z-20 flex flex-col pointer-events-none">
      <div class="w-full flex justify-between items-center p-6 pointer-events-auto">
        <div class="text-white text-3xl font-bold">SenseWay</div>
        <div class="space-x-4">
          <RouterLink to="/auth">
            <button
              class="px-6 py-2 bg-white text-black rounded-full font-semibold hover:bg-gray-200 transition-colors"
            >
              Login
            </button>
          </RouterLink>
          <RouterLink to="/auth">
            <button
              class="px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
            >
              Signup
            </button>
          </RouterLink>
        </div>
      </div>
      <div class="flex-grow flex items-end justify-start p-12">
        <div class="text-white text-5xl font-extrabold max-w-2xl leading-tight">
          Surrender your steps.<br />
          Obey the algorithm.<br />
          We know where you're going.
        </div>
      </div>
    </div>
  </div>
</template>
