<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref(null)

// ── palette ──────────────────────────────────────────────────────────────────
const CORE   = ['#4f8ff7', '#818cf8', '#38bdf8', '#22d3ee']
const ACCENT = ['#a855f7', '#c084fc', '#e879f9']
const WARM   = ['#f472b6', '#fb923c', '#fbbf24']

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rand(a, b) { return a + Math.random() * (b - a) }

function hexA(hex, a) {
  const n = Math.round(Math.max(0, Math.min(1, a)) * 255)
  return hex + n.toString(16).padStart(2, '0')
}

// ── streak factory ────────────────────────────────────────────────────────────
function makeStreak(W, H, type) {
  const cx = W * 0.5, cy = H * 0.42
  const angle = rand(0, Math.PI * 2)
  // "headlight" streaks start further out, are wider & brighter
  const isHead = type === 'head'
  return {
    type: type || 'normal',
    angle,
    r:     isHead ? rand(30, 80)  : rand(2, 50),
    len:   isHead ? rand(140, 260) : rand(40, 120),
    w:     isHead ? rand(2.5, 5)  : rand(0.4, 1.8),
    color: isHead ? pick(CORE) : (Math.random() < 0.12 ? pick(ACCENT) : Math.random() < 0.05 ? pick(WARM) : pick(CORE)),
    speed: isHead ? rand(0.6, 1.4) : rand(0.4, 1.6),
    alpha: isHead ? rand(0.55, 0.9)  : rand(0.2, 0.55),
    cx, cy,
  }
}

// ── pulse ring factory ────────────────────────────────────────────────────────
function makePulse(W, H) {
  return {
    r: 0,
    maxR: Math.hypot(W, H) * 0.65,
    color: Math.random() < 0.5 ? '#4f8ff7' : '#a855f7',
    alpha: rand(0.08, 0.18),
    speed: rand(2.5, 4.5),
    alive: true,
  }
}

// ── city window data (randomised once) ───────────────────────────────────────
function makeCityWindows(W, H) {
  const wins = []
  const BUILDINGS = [
    [0.04, 0.18], [0.09, 0.22], [0.15, 0.25], [0.22, 0.28], [0.30, 0.32],
    [0.38, 0.26], [0.46, 0.30], [0.54, 0.28], [0.62, 0.24], [0.70, 0.31],
    [0.78, 0.23], [0.86, 0.27], [0.94, 0.20],
  ]
  BUILDINGS.forEach(([bx, bh]) => {
    const bH = bh * H * 0.28
    const bTop = H - bH
    const cols = Math.floor(rand(2, 5))
    const rows = Math.floor(rand(3, 8))
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        wins.push({
          x: bx * W - 10 + c * 14,
          y: bTop + 8 + r * 12,
          lit: Math.random() < 0.55,
          phase: rand(0, Math.PI * 2),
          speed: rand(0.4, 1.2),
          color: Math.random() < 0.7 ? '#ffe066' : '#88ccff',
        })
      }
    }
  })
  return wins
}

onMounted(() => {
  const canvas = canvasRef.value
  const ctx    = canvas.getContext('2d')
  let W, H, streaks = [], pulses = [], wins = [], raf = null
  let baseSpeed = 2, targetSpeed = 2, boostTimer = null
  let t = 0, nextPulse = 180  // frames until next ring pulse

  function resize() {
    W = canvas.width  = canvas.offsetWidth
    H = canvas.height = canvas.offsetHeight
    // normal streaks
    streaks = [
      ...Array.from({ length: 180 }, () => makeStreak(W, H, 'normal')),
      ...Array.from({ length: 28 },  () => makeStreak(W, H, 'head')),
    ]
    wins = makeCityWindows(W, H)
    pulses = []
  }

  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  function drawBackground() {
    // deep-space gradient
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.75)
    bg.addColorStop(0, 'rgba(22,12,60,0.96)')
    bg.addColorStop(0.4, 'rgba(8,6,30,0.97)')
    bg.addColorStop(1, 'rgba(2,2,10,0.99)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
  }

  function drawNebulaGlow() {
    // ambient colour clouds
    const spots = [
      { x: W * 0.38, y: H * 0.35, r: W * 0.28, c: 'rgba(79,143,247,0.055)' },
      { x: W * 0.62, y: H * 0.5,  r: W * 0.22, c: 'rgba(168,85,247,0.045)' },
      { x: W * 0.5,  y: H * 0.42, r: W * 0.14, c: 'rgba(34,211,238,0.06)' },
    ]
    spots.forEach(({ x, y, r, c }) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, c); g.addColorStop(1, 'transparent')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    })
  }

  function drawStreaks() {
    const spd = baseSpeed
    streaks.forEach(s => {
      s.r += s.speed * spd
      const maxR = Math.hypot(Math.max(s.cx, W - s.cx), Math.max(s.cy, H - s.cy)) + 80
      if (s.r > maxR) {
        const fresh = makeStreak(W, H, s.type)
        Object.assign(s, { ...fresh, r: s.type === 'head' ? rand(10, 40) : rand(0, 20) })
      }

      const trailLen = s.len * Math.min(spd / 2, 3.5)
      const x1 = s.cx + Math.cos(s.angle) * s.r
      const y1 = s.cy + Math.sin(s.angle) * s.r
      const x2 = s.cx + Math.cos(s.angle) * (s.r + trailLen)
      const y2 = s.cy + Math.sin(s.angle) * (s.r + trailLen)

      const g = ctx.createLinearGradient(x1, y1, x2, y2)
      g.addColorStop(0, hexA(s.color, 0))
      g.addColorStop(0.3, hexA(s.color, s.alpha * 0.4))
      g.addColorStop(1, hexA(s.color, s.alpha))
      ctx.beginPath()
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
      ctx.strokeStyle = g
      ctx.lineWidth = s.w * Math.min(spd / 2, 2.2)
      ctx.lineCap = 'round'
      ctx.stroke()
    })
  }

  function drawPulses() {
    pulses = pulses.filter(p => p.alive)
    pulses.forEach(p => {
      p.r += p.speed * baseSpeed * 0.6
      p.alpha *= 0.975
      if (p.r >= p.maxR || p.alpha < 0.005) { p.alive = false; return }

      ctx.beginPath()
      ctx.arc(W * 0.5, H * 0.42, p.r, 0, Math.PI * 2)
      ctx.strokeStyle = hexA(p.color, p.alpha)
      ctx.lineWidth = 1.5
      ctx.stroke()
    })

    // schedule next pulse
    if (t >= nextPulse) {
      pulses.push(makePulse(W, H))
      nextPulse = t + Math.floor(rand(90, 220))
    }
  }

  function drawCentreGlow() {
    // layered chromatic-aberration-style core
    const rings = [
      { r: 60, c: '#22d3ee', a: 0.22 },
      { r: 38, c: '#4f8ff7', a: 0.32 },
      { r: 18, c: '#ffffff', a: 0.55 },
    ]
    rings.forEach(({ r, c, a }) => {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, r)
      g.addColorStop(0, hexA(c, a))
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    })
  }

  function drawSkyline() {
    ctx.save()
    ctx.globalAlpha = 1
    ctx.fillStyle = '#05020f'
    ctx.beginPath()
    ctx.moveTo(0, H)
    const pts = [
      [0, 0.08], [0.04, 0.18], [0.06, 0.14], [0.09, 0.22], [0.12, 0.16],
      [0.15, 0.25], [0.19, 0.13], [0.22, 0.28], [0.26, 0.18], [0.30, 0.32],
      [0.34, 0.20], [0.38, 0.26], [0.42, 0.15], [0.46, 0.30], [0.50, 0.22],
      [0.54, 0.28], [0.58, 0.16], [0.62, 0.24], [0.66, 0.19], [0.70, 0.31],
      [0.74, 0.14], [0.78, 0.23], [0.82, 0.17], [0.86, 0.27], [0.90, 0.13],
      [0.94, 0.20], [0.97, 0.15], [1, 0.08],
    ]
    pts.forEach(([x, h]) => ctx.lineTo(x * W, H - h * H * 0.30))
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill()
    ctx.restore()
  }

  function drawWindows() {
    wins.forEach(w => {
      if (!w.lit) return
      const flicker = 0.65 + 0.35 * Math.sin(t * w.speed + w.phase)
      ctx.globalAlpha = flicker * 0.75
      ctx.fillStyle = w.color
      ctx.fillRect(w.x, w.y, 5, 4)
      ctx.globalAlpha = 1
    })
    // occasionally toggle a window
    if (t % 40 === 0 && wins.length) {
      const i = Math.floor(Math.random() * wins.length)
      if (Math.random() < 0.25) wins[i].lit = !wins[i].lit
    }
  }

  // traffic-light accent at base of skyline
  function drawTrafficAccents() {
    const lights = [
      { x: W * 0.22, color: '#ef4444' },
      { x: W * 0.5,  color: '#22c55e' },
      { x: W * 0.78, color: '#fbbf24' },
    ]
    lights.forEach(l => {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.018 + l.x))
      const g = ctx.createRadialGradient(l.x, H - H * 0.06, 0, l.x, H - H * 0.06, 28)
      g.addColorStop(0, hexA(l.color, 0.28 * pulse))
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    })
  }

  // vignette to frame the composition
  function drawVignette() {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.25, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.6)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.6)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }

  function draw() {
    drawBackground()
    drawNebulaGlow()
    drawPulses()
    drawStreaks()
    drawCentreGlow()
    drawSkyline()
    drawWindows()
    drawTrafficAccents()
    drawVignette()

    // smoothly lerp toward target speed
    baseSpeed += (targetSpeed - baseSpeed) * 0.04
    t++
    raf = requestAnimationFrame(draw)
  }

  draw()

  canvas.addEventListener('click', () => {
    targetSpeed = 12
    for (let i = 0; i < 3; i++) pulses.push(makePulse(W, H))
    clearTimeout(boostTimer)
    boostTimer = setTimeout(() => { targetSpeed = 2 }, 2400)
  })

  // pause animation when tab is hidden to save cpu/gpu
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf)
      raf = null
    } else if (!raf) {
      draw()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  onUnmounted(() => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    clearTimeout(boostTimer)
    document.removeEventListener('visibilitychange', onVisibility)
  })
})
</script>

<template>
  <canvas ref="canvasRef" class="speed-canvas" title="Click to warp" />
</template>

<style scoped>
.speed-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
</style>
