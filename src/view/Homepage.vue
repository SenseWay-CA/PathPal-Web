<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import FlipWords from '@/components/FlipWords.vue'
import SpeedCanvas from '@/components/SpeedCanvas.vue'

const router = useRouter()
const goToAuth     = () => router.push({ name: 'login' })
const goToRegister = () => router.push({ name: 'register' })

// ── hero typing-loop animation ──────────────────────────────────────────────
// Each segment is either static text or a flipword group.
// We type the static parts + first word of flip groups progressively,
// then switch to FlipWords mode for a while, then reset.

const SEGS = [
  { t: 'Surrender your ' },
  { flip: true, first: 'steps.',     words: ['steps.', 'moves.', 'data.', 'trail.', 'location.'],   color: '#4f8ff7', dur: 2800 },
  { t: '\nObey the ' },
  { flip: true, first: 'algorithm.', words: ['algorithm.', 'system.', 'machine.', 'network.', 'AI.'], color: '#a855f7', dur: 3100 },
  { t: '\nWe know where\n' },
  { flip: true, first: "you're going.", words: ["you're going.", 'you live.', 'you sleep.', 'you wander.', 'you hide.'], color: '#4f8ff7', dur: 3400 },
]

// flatten segments into a char sequence for typing
const CHARS = SEGS.map(s => s.t ?? s.first).join('')

// phase: 'typing' | 'flipping'
const phase     = ref('typing')
const typedN    = ref(0)
const showFlip  = ref(false)   // true once typing is done and FlipWords should render

let typingTimer = null
let flipTimer   = null

function startTyping() {
  phase.value    = 'typing'
  typedN.value   = 0
  showFlip.value = false

  const SPEED = 38   // ms per character
  const typeNext = () => {
    if (typedN.value < CHARS.length) {
      typedN.value++
      typingTimer = setTimeout(typeNext, SPEED)
    } else {
      // typing done → hold a beat then switch to flip phase
      typingTimer = setTimeout(() => {
        phase.value    = 'flipping'
        showFlip.value = true
        // stay in flip mode for 18s then restart typing
        flipTimer = setTimeout(startTyping, 18000)
      }, 600)
    }
  }
  typingTimer = setTimeout(typeNext, 400)
}

// compute what to show per segment during typing
const typed = computed(() => {
  let remaining = typedN.value
  return SEGS.map(s => {
    const full = s.t ?? s.first
    const shown = full.slice(0, Math.min(remaining, full.length))
    remaining = Math.max(0, remaining - full.length)
    return shown
  })
})

// cursor blink visibility
const showCursor = ref(true)
let cursorTimer = null

onMounted(() => {
  startTyping()
  cursorTimer = setInterval(() => { showCursor.value = !showCursor.value }, 530)
})
onUnmounted(() => {
  clearTimeout(typingTimer)
  clearTimeout(flipTimer)
  clearInterval(cursorTimer)
})
</script>

<template>
  <div class="hp-root">
    <!-- lightspeed canvas background -->
    <div class="hp-canvas-wrap">
      <SpeedCanvas />
    </div>

    <!-- subtle dark overlay for text legibility -->
    <div class="hp-overlay" />

    <!-- UI layer -->
    <div class="hp-ui">

      <!-- nav -->
      <nav class="hp-nav">
        <div class="hp-nav-brand">
          <span class="hp-brand-name">SenseWay</span>
        </div>
        <div class="hp-nav-actions">
          <button @click="goToAuth"     class="hp-btn hp-btn--ghost">Login</button>
          <button @click="goToRegister" class="hp-btn hp-btn--primary">Sign up</button>
        </div>
      </nav>

      <!-- hero -->
      <div class="hp-hero">
        <div class="hero-block">

          <!-- typing phase -->
          <template v-if="phase === 'typing' || !showFlip">
            <div class="hero-line">
              {{ typed[0] }}<span v-if="typedN > 0" class="hero-fw" :style="{ color: '#4f8ff7' }">{{ typed[1] }}</span>
            </div>
            <div class="hero-line" v-if="typed[2].includes('\n') || typedN > (SEGS[0].t + SEGS[1].first).length">
              {{ typed[2].replace(/\n/g, '') }}<span class="hero-fw" :style="{ color: '#a855f7' }">{{ typed[3] }}</span>
            </div>
            <div class="hero-line" v-if="typedN > (SEGS[0].t + SEGS[1].first + SEGS[2].t).length">
              {{ typed[4].replace(/\n/g, ' ').trim() }}
            </div>
            <div class="hero-line" v-if="typedN >= CHARS.length - SEGS[5].first.length">
              <span class="hero-fw" :style="{ color: '#4f8ff7' }">{{ typed[5] }}</span>
            </div>
            <span v-if="phase === 'typing'" class="hero-cursor" :class="{ 'hero-cursor--on': showCursor }">|</span>
          </template>

          <!-- flipping phase -->
          <template v-else>
            <div class="hero-line">
              Surrender your <FlipWords :words="SEGS[1].words" :duration="SEGS[1].dur" :color="SEGS[1].color" />
            </div>
            <div class="hero-line">
              Obey the <FlipWords :words="SEGS[3].words" :duration="SEGS[3].dur" :color="SEGS[3].color" />
            </div>
            <div class="hero-line">We know where</div>
            <div class="hero-line">
              <FlipWords :words="SEGS[5].words" :duration="SEGS[5].dur" :color="SEGS[5].color" />
            </div>
          </template>

        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.hp-root {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #03030c;
}

.hp-canvas-wrap {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hp-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    to bottom,
    rgba(3,3,12,0.35) 0%,
    rgba(3,3,12,0.0) 40%,
    rgba(3,3,12,0.55) 100%
  );
  pointer-events: none;
}

.hp-ui {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

/* nav */
.hp-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 32px;
  pointer-events: auto;
}

.hp-nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hp-brand-name {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.02em;
  background: linear-gradient(90deg, #fff, rgba(200,200,255,0.85));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hp-nav-actions {
  display: flex;
  gap: 10px;
}

.hp-btn {
  padding: 9px 22px;
  border-radius: 100px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: background 0.2s, transform 0.15s;
}
.hp-btn:hover { transform: translateY(-1px); }

.hp-btn--ghost {
  background: rgba(255,255,255,0.1);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
  backdrop-filter: blur(8px);
}
.hp-btn--ghost:hover { background: rgba(255,255,255,0.17); }

.hp-btn--primary {
  background: linear-gradient(135deg, #4f8ff7, #a855f7);
  color: #fff;
  box-shadow: 0 4px 20px rgba(79,143,247,0.35);
}
.hp-btn--primary:hover { box-shadow: 0 6px 28px rgba(79,143,247,0.5); }

/* hero */
.hp-hero {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 0 48px 56px;
  pointer-events: none;
}

.hero-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hero-line {
  font-size: clamp(32px, 4vw, 54px);
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: #ffffff;
  text-shadow: 0 2px 24px rgba(0,0,0,0.6);
  min-height: 1.15em;
}

.hero-fw {
  font-style: italic;
}

.hero-cursor {
  display: inline-block;
  font-size: clamp(32px, 4vw, 54px);
  font-weight: 900;
  color: #4f8ff7;
  opacity: 0;
  margin-left: 2px;
  transition: opacity 0.08s;
}
.hero-cursor--on { opacity: 1; }
</style>
