<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const containerRef = ref(null)
let camera, scene, renderer, controls, elderlyMan, clock
let trafficLightBulbs = [] // { red, yellow, green } per light set
let caneSensorMesh = null  // pulsing LED tip

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

  clock = new THREE.Clock()

  scene = new THREE.Scene()
  // dusk sky — deep blue-purple twilight
  scene.background = new THREE.Color(0x7ab3d4)
  scene.fog = new THREE.FogExp2(0x7ab3d4, 0.0025)

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(28, 18, 36)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.5
  containerRef.value.appendChild(renderer.domElement)

  // ── lighting: dusk ──
  const ambient = new THREE.AmbientLight(0xfff0dd, 2.8)
  scene.add(ambient)
  // sun from above-west — warm golden
  const sun = new THREE.DirectionalLight(0xffd070, 2.4)
  sun.position.set(-60, 90, 30)
  sun.castShadow = true
  sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120
  sun.shadow.camera.left = -120; sun.shadow.camera.right = 120
  sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048
  scene.add(sun)
  // fill from opposite side — sky blue
  const fill = new THREE.DirectionalLight(0x88bbdd, 1.2)
  fill.position.set(60, 40, -40)
  scene.add(fill)

  // ── materials ──
  const concreteMat  = new THREE.MeshStandardMaterial({ color: 0xd4cfc8, roughness: 0.95 })
  const roadMat      = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.9 })
  const stripeMat    = new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.8 })
  const grassMat     = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 1 })
  const metalMat     = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.9 })
  const tireMat      = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7 })
  const coatMat      = new THREE.MeshStandardMaterial({ color: 0x2c3e6b, roughness: 0.8 })
  const pantsMat     = new THREE.MeshStandardMaterial({ color: 0x1e1e2a, roughness: 0.9 })
  const skinMat      = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.8 })
  const hairMat      = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9 })
  const caneMat      = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.5 })
  const greenLightMat  = new THREE.MeshBasicMaterial({ color: 0x00ee44 })
  const buildingMats = [
    new THREE.MeshStandardMaterial({ color: 0x8b9db5, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0xa09070, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x6b8899, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x7a8a70, roughness: 0.9 }),
  ]
  const windowLitMat  = new THREE.MeshBasicMaterial({ color: 0xffdd88 })
  const windowDarkMat = new THREE.MeshStandardMaterial({ color: 0x1a2233, roughness: 0.8 })

  // ── ground + roads ──
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), grassMat)
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground)

  const roadWidth = 32
  const re = roadWidth / 2
  const mainRoad = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.12, 400), roadMat)
  mainRoad.position.y = 0.06; mainRoad.receiveShadow = true; scene.add(mainRoad)
  const crossRoad = new THREE.Mesh(new THREE.BoxGeometry(400, 0.12, roadWidth), roadMat)
  crossRoad.position.y = 0.06; crossRoad.receiveShadow = true; scene.add(crossRoad)

  // sidewalk pads at corners
  const swMat = new THREE.MeshStandardMaterial({ color: 0xb0a898, roughness: 0.95 })
  const swSize = 14
  const swOff = roadWidth / 2 + swSize / 2
  ;[[swOff,swOff],[swOff,-swOff],[-swOff,swOff],[-swOff,-swOff]].forEach(([sx,sz]) => {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(swSize, 0.18, swSize), swMat)
    sw.position.set(sx, 0.09, sz); sw.receiveShadow = true; scene.add(sw)
  })

  // centre-line dashes — skip the intersection zone
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xffee44, roughness: 0.8 })
  const intHalf = re + 5  // skip dashes whose centre falls inside ±(re+5)
  for (let i = -180; i < 180; i += 12) {
    if (Math.abs(i) > intHalf) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 6), dashMat)
      d.position.set(0, 0.065, i); scene.add(d)
    }
    if (Math.abs(i) > intHalf) {
      const d2 = new THREE.Mesh(new THREE.BoxGeometry(6, 0.13, 0.4), dashMat)
      d2.position.set(i, 0.065, 0); scene.add(d2)
    }
  }

  // ── crosswalks ──
  const cwLen = 12, sw2 = 2.2, ss = 1.6, ns = 7
  const startOff = -(ns * sw2 + (ns - 1) * ss) / 2 + sw2 / 2
  for (let i = 0; i < ns; i++) {
    const off = startOff + i * (sw2 + ss)
    ;[[-re - cwLen/2, 0], [re + cwLen/2, 0]].forEach(([tz, tx]) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(sw2, 0.13, cwLen), stripeMat)
      s.position.set(off, 0.065, tz); s.receiveShadow = true; scene.add(s)
    })
    ;[[-re - cwLen/2, 0], [re + cwLen/2, 0]].forEach(([tx]) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(cwLen, 0.13, sw2), stripeMat)
      s.position.set(tx, 0.065, off); s.receiveShadow = true; scene.add(s)
    })
  }

  // ── buildings ──
  const bo = roadWidth / 2 + 22
  const buildingDefs = [
    { x: bo,  z: bo,  w: 28, d: 26, h: 85, mi: 0 },
    { x: -bo, z: -bo, w: 32, d: 28, h: 105, mi: 1 },
    { x: bo,  z: -bo, w: 26, d: 22, h: 70, mi: 2 },
    { x: -bo, z: bo,  w: 24, d: 24, h: 92, mi: 3 },
  ]
  buildingDefs.forEach(({ x, z, w, d, h, mi }) => {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMats[mi])
    body.castShadow = true; body.receiveShadow = true; g.add(body)
    // roof ledge
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 1.2, d + 1.5), concreteMat)
    roof.position.y = h / 2 + 0.6; g.add(roof)
    // door
    const door = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.3), metalMat)
    door.position.set(0, -h/2+2.5, d/2+0.15); g.add(door)
    // windows — randomly lit
    const nf = Math.floor((h - 8) / 4.5)
    const nw = Math.floor((w - 6) / 4.2)
    for (let fi = 0; fi < nf; fi++) {
      for (let wi = 0; wi < nw; wi++) {
        const lit = Math.random() > 0.35
        const wp = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 0.3), lit ? windowLitMat : windowDarkMat)
        wp.position.set((wi - (nw-1)/2)*4.2, -h/2+9+fi*4.5, d/2+0.15)
        g.add(wp)
      }
    }
    g.position.set(x, h/2, z); scene.add(g)
  })

  // ── cars ──
  const carColors = [0xe8e8e8, 0xcc2200, 0x1144aa, 0x226622, 0x888888, 0xddaa00]
  const createCar = (x, z, rotY, colorIdx) => {
    const cg = new THREE.Group()
    const bodyMat = new THREE.MeshStandardMaterial({ color: carColors[colorIdx % carColors.length], roughness: 0.4, metalness: 0.6 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.5, 8.5), bodyMat)
    body.position.y = 1.4; body.castShadow = true; cg.add(body)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 5.2), bodyMat)
    cabin.position.set(0, 2.8, -0.4); cabin.castShadow = true; cg.add(cabin)
    // windshields
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.7 })
    const wf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 0.15), glassMat)
    wf.position.set(0, 2.8, 2.2); cg.add(wf)
    const wr = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 0.15), glassMat)
    wr.position.set(0, 2.8, -2.9); cg.add(wr)
    // headlights
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffee })
    ;[-1.6, 1.6].forEach(hx => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.1), hlMat)
      hl.position.set(hx, 1.4, 4.3); cg.add(hl)
    })
    // tail lights
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xee1100 })
    ;[-1.6, 1.6].forEach(tx => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.1), tlMat)
      tl.position.set(tx, 1.4, -4.3); cg.add(tl)
    })
    // wheels
    const wGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.55, 20)
    ;[{x:-2.3,z:2.8},{x:2.3,z:2.8},{x:-2.3,z:-2.8},{x:2.3,z:-2.8}].forEach(p => {
      const w = new THREE.Mesh(wGeo, tireMat)
      w.position.set(p.x, 0.8, p.z); w.rotation.z = Math.PI/2; w.castShadow = true; cg.add(w)
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.58, 8), metalMat)
      rim.position.set(p.x, 0.8, p.z); rim.rotation.z = Math.PI/2; cg.add(rim)
    })
    cg.position.set(x, 0, z); cg.rotation.y = rotY; scene.add(cg)
    return cg
  }
  createCar(7, 30, 0, 0)
  createCar(-7, -28, Math.PI, 1)
  createCar(40, 7, -Math.PI/2, 2)
  createCar(-38, -7, Math.PI/2, 3)
  createCar(7, -55, 0, 4)
  createCar(-7, 52, Math.PI, 5)

  // ── traffic lights ──
  const lp = roadWidth / 2 + 4
  const tlBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
  const createTrafficLight = (x, z, ry) => {
    const pg = new THREE.Group()
    const ph = 11  // pole height, base at y=0

    // pole + base plate
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, ph, 12), metalMat)
    pole.position.y = ph / 2; pole.castShadow = true; pg.add(pole)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 12), metalMat)
    base.position.y = 0.15; pg.add(base)

    // signal housing on top of pole
    const housingH = 4.2
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.6, housingH, 1.6), tlBlack)
    housing.position.y = ph + housingH / 2; housing.castShadow = true; pg.add(housing)
    // top cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.9), tlBlack)
    cap.position.y = ph + housingH + 0.11; pg.add(cap)

    // 3 bulbs: red top, yellow mid, green bottom — MeshBasicMaterial so they always glow
    const bulbSet = { red: [], yellow: [], green: [] }
    ;['red', 'yellow', 'green'].forEach((col, ci) => {
      const by = ph + housingH - 0.62 - ci * 1.38
      // visor hood above each bulb
      const visor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.6), tlBlack)
      visor.position.set(0, by + 0.46, 0.82); pg.add(visor)
      // bulb (BasicMaterial = full color regardless of lighting)
      const mat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), mat)
      bulb.position.set(0, by, 0.82); pg.add(bulb)
      bulbSet[col].push(bulb)
    })

    pg.position.set(x, 0, z); pg.rotation.y = ry; scene.add(pg)
    trafficLightBulbs.push(bulbSet)
  }
  // Each corner: arm faces toward intersection centre
  createTrafficLight( lp,  lp,  3 * Math.PI / 4)
  createTrafficLight(-lp,  lp,      Math.PI / 4)
  createTrafficLight( lp, -lp, -3 * Math.PI / 4)
  createTrafficLight(-lp, -lp,     -Math.PI / 4)

  // ── pedestrian walk signals ──
  const createWalkSignal = (x, z) => {
    const sg = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 8), metalMat)
    sg.add(pole)
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.4), metalMat)
    box.position.y = 3.5; sg.add(box)
    const walk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.1), greenLightMat)
    walk.position.set(0, 3.7, 0.25); sg.add(walk)
    sg.position.set(x, 4, z); scene.add(sg)
  }
  createWalkSignal(re + 2, re + 2)
  createWalkSignal(-(re + 2), re + 2)
  createWalkSignal(re + 2, -(re + 2))
  createWalkSignal(-(re + 2), -(re + 2))

  // ── streetlamps ──
  const createStreetlamp = (x, z) => {
    const lg = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 12, 8), metalMat)
    pole.castShadow = true; lg.add(pole)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 8), metalMat)
    neck.position.set(1.2, 5.8, 0); neck.rotation.z = -Math.PI/5; lg.add(neck)
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.8), metalMat)
    head.position.set(2.0, 5.3, 0); lg.add(head)
    // warm glow
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.6), new THREE.MeshBasicMaterial({ color: 0xffdd88 }))
    glow.position.set(2.0, 5.05, 0); lg.add(glow)
    const ptLight = new THREE.PointLight(0xffcc66, 1.5, 30, 2)
    ptLight.position.set(2.0, 4.8, 0); lg.add(ptLight)
    lg.position.set(x, 6, z); scene.add(lg)
  }
  const sl = re + 7  // 23 — on the inner sidewalk, clear of roads
  // corner lamps at each intersection corner
  createStreetlamp( sl,  sl); createStreetlamp(-sl,  sl)
  createStreetlamp( sl, -sl); createStreetlamp(-sl, -sl)
  // along N-S road sides (x=±sl, z away from intersection)
  createStreetlamp( sl,  60); createStreetlamp(-sl,  60)
  createStreetlamp( sl, -60); createStreetlamp(-sl, -60)
  // along E-W road sides (z=±sl, x away from intersection)
  createStreetlamp( 60,  sl); createStreetlamp( 60, -sl)
  createStreetlamp(-60,  sl); createStreetlamp(-60, -sl)

  // ── person with cane ──
  elderlyMan = new THREE.Group()

  // legs (dark trousers)
  const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 2.6, 14), pantsMat)
  leg1.position.set(-0.38, 1.3, 0); leg1.castShadow = true; elderlyMan.add(leg1)
  const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 2.6, 14), pantsMat)
  leg2.position.set(0.38, 1.3, 0); leg2.castShadow = true; elderlyMan.add(leg2)
  // shoes
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })
  ;[-0.38, 0.38].forEach(sx => {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 1.0), shoeMat)
    shoe.position.set(sx, 0.18, 0.15); shoe.castShadow = true; elderlyMan.add(shoe)
  })
  // torso — dark coat
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.58, 2.8, 20), coatMat)
  torso.position.y = 3.2; torso.castShadow = true; elderlyMan.add(torso)
  // collar/lapel
  const collar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a4a7a }))
  collar.position.set(0, 4.4, 0.35); elderlyMan.add(collar)
  // arms
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 2.6, 12), coatMat)
  armR.position.set(1.1, 3.1, 0.15); armR.rotation.z = Math.PI/5; armR.castShadow = true; elderlyMan.add(armR)
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 2.6, 12), coatMat)
  armL.position.set(-0.9, 3.0, 0.1); armL.rotation.z = -Math.PI/14; armL.castShadow = true; elderlyMan.add(armL)
  // neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.55, 12), skinMat)
  neck.position.y = 4.75; neck.castShadow = true; elderlyMan.add(neck)
  // head (skin)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.66, 22, 22), skinMat)
  head.position.y = 5.55; head.castShadow = true; elderlyMan.add(head)
  // hair cap (grey)
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.68, 22, 22, 0, Math.PI*2, 0, Math.PI*0.55), hairMat)
  hair.position.y = 5.55; elderlyMan.add(hair)
  // glasses frames
  const glassesMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 })
  ;[-0.22, 0.22].forEach(gx => {
    const fr = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 18), glassesMat)
    fr.position.set(gx, 5.55, 0.6); fr.rotation.y = Math.PI/2; elderlyMan.add(fr)
  })

  // ── smart cane ──
  const cane = new THREE.Group()
  const sh = 4.6, tr2 = 0.11
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(tr2, tr2, sh, 12), caneMat)
  shaft.position.y = sh / 2; shaft.castShadow = true; cane.add(shaft)
  // crook handle
  const crookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, sh, 0), new THREE.Vector3(0, sh + 0.5, 0),
    new THREE.Vector3(0.4, sh + 0.85, 0), new THREE.Vector3(0.65, sh + 0.6, 0),
    new THREE.Vector3(0.65, sh, 0),
  ])
  const handle = new THREE.Mesh(new THREE.TubeGeometry(crookCurve, 18, tr2, 8, false), caneMat)
  handle.castShadow = true; cane.add(handle)
  // sensor tip — glowing blue LED
  const sensorMat = new THREE.MeshBasicMaterial({ color: 0x44aaff })
  caneSensorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), sensorMat)
  caneSensorMesh.position.y = 0.05; cane.add(caneSensorMesh)
  // point light on tip
  const caneLight = new THREE.PointLight(0x44aaff, 2, 4, 2)
  caneLight.position.y = 0.1; cane.add(caneLight)

  cane.position.set(1.8, -2.0, 0.4)
  cane.rotation.z = -Math.PI / 11
  cane.rotation.y = -Math.PI / 8
  elderlyMan.add(cane)

  // position at crosswalk corner
  elderlyMan.position.set(re + 3, 0, re + 3)
  elderlyMan.rotation.y = (-3 * Math.PI) / 4
  scene.add(elderlyMan)

  // ── camera + controls ──
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.minDistance = 15
  controls.maxDistance = 90
  controls.maxPolarAngle = Math.PI / 2.1
  controls.enablePan = false
  controls.target.set(elderlyMan.position.x, 2.5, elderlyMan.position.z)

  // ── animate ──
  // traffic light phase: 0=red, 1=yellow, 2=green
  const phaseTime = [5, 1.5, 5]  // seconds per phase
  let tlPhase = 0, tlTimer = 0

  const updateTrafficLights = (dt) => {
    tlTimer += dt
    if (tlTimer > phaseTime[tlPhase]) { tlTimer = 0; tlPhase = (tlPhase + 1) % 3 }
    trafficLightBulbs.forEach(set => {
      ;['red','yellow','green'].forEach((col, ci) => {
        const on = ci === tlPhase
        set[col].forEach(b => {
          b.material.color.set(on
            ? (col === 'red' ? 0xff2200 : col === 'yellow' ? 0xffaa00 : 0x00ee44)
            : 0x1a1a1a)
        })
      })
    })
  }

  const animate = () => {
    requestAnimationFrame(animate)
    const dt = clock.getDelta()
    const elapsed = clock.elapsedTime

    // pulsing cane sensor
    if (caneSensorMesh) {
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.5)
      caneSensorMesh.material.color.setRGB(0.1 + pulse * 0.2, 0.5 + pulse * 0.4, 1.0)
      const s = 0.7 + pulse * 0.6
      caneSensorMesh.scale.setScalar(s)
    }

    updateTrafficLights(dt)
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
    <div class="absolute inset-0 bg-black opacity-20 z-10 pointer-events-none"></div>

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
