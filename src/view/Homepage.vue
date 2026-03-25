<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const containerRef = ref(null)
let camera, scene, renderer, controls, elderlyMan

const router = useRouter()
const goToAuth = () => router.push({ name: 'login' })
const goToRegister = () => router.push({ name: 'register' })

// ── typing animation ──
const LINES = [
  'Surrender your',
  'steps.',
  'Obey the',
  'algorithm.',
  'We know where',
  "you're going.",
]
const displayedLines = ref([])    // array of fully-typed strings shown so far
const currentTyping = ref('')     // the line currently being typed
let typingTimer = null

function runTypingLoop() {
  let lineIdx = 0
  displayedLines.value = []
  currentTyping.value = ''

  function typeLine() {
    const target = LINES[lineIdx]
    let charIdx = 0
    function typeChar() {
      if (charIdx <= target.length) {
        currentTyping.value = target.slice(0, charIdx)
        charIdx++
        typingTimer = setTimeout(typeChar, 60)
      } else {
        // line done — commit it, move on
        displayedLines.value = [...displayedLines.value, target]
        currentTyping.value = ''
        lineIdx++
        if (lineIdx < LINES.length) {
          typingTimer = setTimeout(typeLine, 220)
        } else {
          // all lines shown — pause then reset
          typingTimer = setTimeout(() => {
            displayedLines.value = []
            currentTyping.value = ''
            lineIdx = 0
            typingTimer = setTimeout(typeLine, 600)
          }, 3200)
        }
      }
    }
    typeChar()
  }
  typeLine()
}

const initThree = () => {
  if (!containerRef.value) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xa0c8ec)
  scene.fog = new THREE.Fog(0xa0c8ec, 120, 300)

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(30, 25, 40)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)

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

  const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.9 })
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a })
  const redMaterial = new THREE.MeshStandardMaterial({ color: 0xdd1100, roughness: 0.4 })
  const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x6bbd6b, roughness: 1 })
  const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x4c4c4c, roughness: 0.6, metalness: 0.8 })
  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.6 })
  const lightOnMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const lightOffMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 })
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 })

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

  const crosswalkLength = 12, stripeWidth = 2.5, stripeSpacing = 1.5, numStripes = 7
  const totalStripesWidth = numStripes * stripeWidth + (numStripes - 1) * stripeSpacing
  const startOffset = -totalStripesWidth / 2 + stripeWidth / 2
  const roadEdge = roadWidth / 2
  for (let i = 0; i < numStripes; i++) {
    const off = startOffset + i * (stripeWidth + stripeSpacing)
    const topGeo = new THREE.BoxGeometry(stripeWidth, 0.1, crosswalkLength)
    const ts = new THREE.Mesh(topGeo, whiteMaterial)
    ts.position.set(off, 0.1, -roadEdge - crosswalkLength / 2); ts.receiveShadow = true; scene.add(ts)
    const bs = new THREE.Mesh(topGeo, whiteMaterial)
    bs.position.set(off, 0.1, roadEdge + crosswalkLength / 2); bs.receiveShadow = true; scene.add(bs)
    const lGeo = new THREE.BoxGeometry(crosswalkLength, 0.1, stripeWidth)
    const ls = new THREE.Mesh(lGeo, whiteMaterial)
    ls.position.set(-roadEdge - crosswalkLength / 2, 0.1, off); ls.receiveShadow = true; scene.add(ls)
    const rs = new THREE.Mesh(lGeo, whiteMaterial)
    rs.position.set(roadEdge + crosswalkLength / 2, 0.1, off); rs.receiveShadow = true; scene.add(rs)
  }

  const createDetailedBuilding = (x, z, width, depth, height) => {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), whiteMaterial)
    body.castShadow = true; body.receiveShadow = true; g.add(body)
    const door = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.2), doorMaterial)
    door.position.set(0, -height / 2 + 2.5, depth / 2 + 0.1); g.add(door)
    const numFloors = Math.floor((height - 7) / 4)
    const numWindows = Math.floor((width - 6) / 4)
    for (let i = 0; i < numFloors; i++) {
      for (let j = 0; j < numWindows; j++) {
        const wp = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 0.2), windowMaterial)
        wp.position.set((j - (numWindows - 1) / 2) * 4, -height / 2 + 8 + i * 4, depth / 2 + 0.1)
        g.add(wp)
      }
    }
    g.position.set(x, height / 2, z); scene.add(g)
  }
  const bo = roadWidth / 2 + 20
  createDetailedBuilding(bo, bo, 25, 25, 80)
  createDetailedBuilding(-bo, -bo, 30, 25, 100)
  createDetailedBuilding(bo, -bo, 28, 20, 70)
  createDetailedBuilding(-bo, bo, 22, 22, 90)

  const createCar = (x, z, rotationY) => {
    const cg = new THREE.Group()
    const cb = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2, 8), whiteMaterial)
    cb.position.y = 2; cb.castShadow = true; cg.add(cb)
    const cc = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 5), whiteMaterial)
    cc.position.set(0, 3.8, -0.5); cc.castShadow = true; cg.add(cc)
    const wGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 32)
    ;[{ x: -2.25, z: 2.5 }, { x: 2.25, z: 2.5 }, { x: -2.25, z: -2.5 }, { x: 2.25, z: -2.5 }].forEach((p) => {
      const w = new THREE.Mesh(wGeo, tireMaterial)
      w.position.set(p.x, 0.8, p.z); w.rotation.z = Math.PI / 2; w.castShadow = true; cg.add(w)
    })
    cg.position.set(x, 0, z); cg.rotation.y = rotationY; scene.add(cg)
  }
  createCar(6, 25, 0); createCar(-6, -25, Math.PI)

  const createTrafficLight = (x, z, rotY) => {
    const pg = new THREE.Group()
    const ph = 18, mal = 16
    const vp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, ph, 16), metalMaterial)
    vp.castShadow = true; pg.add(vp)
    const ma = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, mal, 16), metalMaterial)
    ma.castShadow = true; ma.position.set(mal / 2, ph / 2 - 1, 0); ma.rotation.z = Math.PI / 2; pg.add(ma)
    const createLightBox = (posX) => {
      const lb = new THREE.Group()
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 1), metalMaterial)
      box.castShadow = true
      const bp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.8), metalMaterial)
      bp.position.z = -0.55; box.add(bp)
      for (let i = 0; i < 3; i++) {
        const yp = 0.7 - i * 0.7
        const vis = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16, 1, true, 0, Math.PI), metalMaterial)
        vis.position.set(0, yp, 0.9); vis.rotation.x = Math.PI / 2; box.add(vis)
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.3), i === 0 ? lightOnMaterial : lightOffMaterial)
        light.position.y = yp; box.add(light)
      }
      lb.position.set(posX, ph / 2 - 3, 0); return lb
    }
    pg.add(createLightBox(5)); pg.add(createLightBox(12))
    pg.position.set(x, ph / 2, z); pg.rotation.y = rotY; scene.add(pg)
  }
  const lp = roadWidth / 2 + 4
  createTrafficLight(lp, lp, -Math.PI / 2)
  createTrafficLight(-lp, lp, Math.PI)
  createTrafficLight(lp, -lp, 0)
  createTrafficLight(-lp, -lp, Math.PI / 2)

  elderlyMan = new THREE.Group()
  const mm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 2.8, 32), mm)
  torso.position.y = 3; torso.castShadow = true; elderlyMan.add(torso)
  const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 2.5, 16), mm)
  leg1.position.set(-0.4, 0.5, 0); leg1.castShadow = true; elderlyMan.add(leg1)
  const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 2.5, 16), mm)
  leg2.position.set(0.4, 0.5, 0); leg2.castShadow = true; elderlyMan.add(leg2)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 32), mm)
  head.position.y = 4.8; head.castShadow = true; elderlyMan.add(head)
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 2.5, 16), mm)
  armR.castShadow = true; armR.position.set(1.4, 2.9, 0.2); armR.rotation.z = Math.PI / 5; elderlyMan.add(armR)
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 2.5, 16), mm)
  armL.castShadow = true; armL.position.set(-1.0, 2.8, 0.1); armL.rotation.z = -Math.PI / 12; elderlyMan.add(armL)

  const cane = new THREE.Group()
  const sh = 4.5, hr = 0.6, tr = 0.12
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(tr, tr, sh, 16), redMaterial)
  shaft.castShadow = true; shaft.position.y = sh / 2; cane.add(shaft)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, sh, 0), new THREE.Vector3(0, sh + hr * 0.8, 0),
    new THREE.Vector3(hr * 0.6, sh + hr * 1.2, 0), new THREE.Vector3(hr, sh + hr * 0.8, 0),
    new THREE.Vector3(hr, sh, 0),
  ])
  const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, tr, 8, false), redMaterial)
  handle.castShadow = true; cane.add(handle)
  cane.position.set(2.0, -2.1, 0.5); cane.rotation.z = -Math.PI / 12; cane.rotation.y = -Math.PI / 8
  elderlyMan.add(cane)
  elderlyMan.position.set(roadWidth / 2 + 2, 0, roadWidth / 2 + 2)
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
  runTypingLoop()
})

onUnmounted(() => {
  if (typingTimer) clearTimeout(typingTimer)
})
</script>

<template>
  <div ref="containerRef" class="relative w-full h-screen overflow-hidden bg-black">
    <div class="absolute inset-0 bg-black opacity-50 z-10 pointer-events-none"></div>

    <div class="absolute inset-0 z-20 flex flex-col pointer-events-none">
      <!-- topbar -->
      <div class="w-full flex justify-between items-center p-6 pointer-events-auto">
        <div class="flex items-center gap-3">
          <img src="https://i.gyazo.com/465fb186323ea1edccb73b28fb4b8bd4.png" class="h-9 w-9 rounded-full" style="filter:drop-shadow(0 0 8px rgba(79,143,247,0.6))" alt="SenseWay" />
          <div class="text-white text-2xl font-extrabold tracking-tight">SenseWay</div>
        </div>
        <div class="space-x-3">
          <button @click="goToAuth" class="px-6 py-2 bg-white text-black rounded-full font-semibold hover:bg-gray-200 transition-colors">Login</button>
          <button @click="goToRegister" class="px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors">Sign up</button>
        </div>
      </div>

      <!-- hero text — bottom-left, with typing animation -->
      <div class="flex-grow flex items-end justify-start p-12">
        <div class="hero-block">
          <div
            v-for="(line, i) in displayedLines"
            :key="'done-' + i"
            class="hero-line hero-line--done"
          >{{ line }}</div>
          <div v-if="currentTyping || displayedLines.length < 6" class="hero-line hero-line--typing">
            {{ currentTyping }}<span class="hero-cursor">|</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hero-line {
  font-size: clamp(32px, 4vw, 52px);
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: #ffffff;
  text-shadow: 0 2px 20px rgba(0,0,0,0.5);
  min-height: 1.2em;
}

.hero-line--done {
  animation: line-in 0.25s cubic-bezier(0.22,1,0.36,1) both;
}

@keyframes line-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.hero-cursor {
  color: #4f8ff7;
  animation: cursor-blink 0.75s step-end infinite;
  margin-left: 1px;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
</style>
