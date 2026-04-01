<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  sysEvents:    { type: Array, default: () => [] },
  timedFences:  { type: Array, default: () => [] },
  appointments: { type: Array, default: () => [] },
})
const emit = defineEmits(['add-appointment', 'delete-appointment', 'delete-timed-fence'])

const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

// today with no time component
const todayBase = new Date(); todayBase.setHours(0,0,0,0)

const viewOffset  = ref(0)   // week offset (multiples of 7)
const selectedDate = ref(new Date(todayBase))

// generate 14 days starting from (today - 7 + viewOffset)
const visibleDates = computed(() => {
  const out = []
  for (let i = -7; i <= 6; i++) {
    const d = new Date(todayBase)
    d.setDate(todayBase.getDate() + i + viewOffset.value)
    out.push(d)
  }
  return out
})

// month/year header from middle of visible range
const headerLabel = computed(() => {
  const mid = visibleDates.value[7]
  return `${MONTH_FULL[mid.getMonth()]} ${mid.getFullYear()}`
})

function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function isToday(d) { return isSameDay(d, todayBase) }
function isPast(d)  { return d < todayBase }

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',hour12:true})
}

function isAlertType(t) {
  const s = (t||'').toLowerCase()
  return s.includes('sos')||s.includes('fall')
}

// events for a specific date (used for dot indicators and selected-day list)
function eventsForDate(d) {
  const out = []
  for (const e of props.sysEvents) {
    const ed = new Date(e.created_at)
    if (isSameDay(ed, d)) out.push({ id:'sys_'+e.id, type:'system', title:e.name||e.type, desc:e.description||'', time:ed, color: isAlertType(e.type)?'#ef4444':'#4f8ff7', isAlert:isAlertType(e.type) })
  }
  for (const tf of props.timedFences) {
    const s = new Date(tf.startAt), en = new Date(tf.endAt)
    if (isSameDay(s,d)||isSameDay(en,d)) out.push({ id:'tf_'+tf.id, type:'geofence', title:tf.title, desc:`Active ${fmtTime(s)} – ${fmtTime(en)}`, time:s, endsAt:en, color:'#4f8ff7', tfId:tf.id })
  }
  for (const a of props.appointments) {
    const s = new Date(a.startAt)
    if (isSameDay(s,d)) out.push({ id:'appt_'+a.id, type:'appointment', title:a.title, desc:(a.location?`@ ${a.location} · `:'')+fmtTime(s)+(a.endAt?` – ${fmtTime(a.endAt)}`:''), time:s, endsAt:a.endAt?new Date(a.endAt):null, color:'#a855f7', apptId:a.id })
  }
  return out.sort((a,b)=>new Date(a.time)-new Date(b.time))
}

const selectedDayEvents = computed(() => eventsForDate(selectedDate.value))

function dayHeaderLabel(d) {
  const diff = Math.round((new Date(d).setHours(0,0,0,0) - todayBase) / 86400000)
  if (diff===0)  return 'Today'
  if (diff===1)  return 'Tomorrow'
  if (diff===-1) return 'Yesterday'
  return new Date(d).toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})
}
</script>

<template>
  <div class="sc-root">

    <!-- navigation header -->
    <div class="sc-header">
      <button class="sc-nav-btn" @click="viewOffset -= 7" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <span class="sc-header-label">{{ headerLabel }}</span>
      <button class="sc-nav-btn" @click="viewOffset += 7" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>

    <!-- date strip -->
    <div class="sc-strip">
      <button
        v-for="d in visibleDates"
        :key="d.toISOString()"
        :class="['sc-date-card', { 'sc-date-card--today': isToday(d), 'sc-date-card--sel': isSameDay(d, selectedDate), 'sc-date-card--past': isPast(d) }]"
        @click="selectedDate = new Date(d)"
        type="button"
      >
        <span class="sc-d-month">{{ MONTHS[d.getMonth()] }}</span>
        <span class="sc-d-num">{{ d.getDate() }}</span>
        <span class="sc-d-day">{{ DAYS[d.getDay()] }}</span>
        <span v-if="eventsForDate(d).length" class="sc-dot" :class="eventsForDate(d).some(e=>e.isAlert)?'sc-dot--alert':''"></span>
      </button>
    </div>

    <!-- selected day panel -->
    <div class="sc-panel">
      <div class="sc-panel-head">
        <div>
          <p class="sc-panel-day">{{ dayHeaderLabel(selectedDate) }}</p>
          <p class="sc-panel-date">{{ selectedDate.toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) }}</p>
        </div>
        <button class="sc-add-btn" @click="$emit('add-appointment', new Date(selectedDate))" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Add Event
        </button>
      </div>

      <div v-if="selectedDayEvents.length" class="sc-events">
        <div
          v-for="ev in selectedDayEvents"
          :key="ev.id"
          class="sc-ev-row"
          :style="{ '--evc': ev.color }"
        >
          <div class="sc-ev-line"></div>
          <div class="sc-ev-card">
            <div class="sc-ev-top">
              <!-- badge -->
              <span :class="['sc-ev-badge', `sc-ev-badge--${ev.type}`, ev.isAlert ? 'sc-ev-badge--alert':'']">
                <!-- geofence icon -->
                <svg v-if="ev.type==='geofence'" xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
                <!-- calendar icon -->
                <svg v-else-if="ev.type==='appointment'" xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <!-- alert icon -->
                <svg v-else-if="ev.isAlert" xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>
                <!-- default event icon -->
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
                {{ ev.type==='geofence'?'Zone':ev.type==='appointment'?'Appointment':ev.isAlert?'Alert':'Event' }}
              </span>
              <span class="sc-ev-title">{{ ev.title }}</span>
              <!-- delete button for user-created items -->
              <button
                v-if="ev.type==='appointment'"
                class="sc-ev-del"
                @click="$emit('delete-appointment', ev.apptId)"
                type="button"
                title="Remove"
              >&#x2715;</button>
              <button
                v-if="ev.type==='geofence'"
                class="sc-ev-del"
                @click="$emit('delete-timed-fence', ev.tfId)"
                type="button"
                title="Remove"
              >&#x2715;</button>
            </div>
            <p class="sc-ev-desc">{{ ev.desc }}</p>
          </div>
        </div>
      </div>

      <div v-else class="sc-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".2"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p>Nothing scheduled</p>
      </div>
    </div>

  </div>
</template>

<style scoped>
.sc-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.sc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}
.sc-header-label {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.02em;
}
.sc-nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: #c8c8d8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.sc-nav-btn:hover { background: rgba(79,143,247,0.15); color: #fff; }

/* date strip */
.sc-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.sc-strip::-webkit-scrollbar { display: none; }

.sc-date-card {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 12px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.04);
  cursor: pointer;
  min-width: 56px;
  position: relative;
  transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.18s, border-color 0.18s;
  color: #a0a0b8;
}
.sc-date-card:hover {
  background: rgba(79,143,247,0.1);
  border-color: rgba(79,143,247,0.25);
  color: #fff;
  transform: translateY(-2px) scale(1.04);
}
.sc-date-card--past { opacity: 0.55; }
.sc-date-card--today {
  background: rgba(79,143,247,0.12);
  border-color: rgba(79,143,247,0.35);
  color: #fff;
}
.sc-date-card--sel {
  background: linear-gradient(135deg, rgba(79,143,247,0.28) 0%, rgba(168,85,247,0.22) 100%);
  border-color: rgba(79,143,247,0.6);
  color: #fff;
  transform: translateY(-3px) scale(1.06);
  box-shadow: 0 6px 24px rgba(79,143,247,0.25);
}

.sc-d-month { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.65; margin-bottom: 1px; }
.sc-d-num   { font-size: 20px; font-weight: 800; line-height: 1.1; }
.sc-d-day   { font-size: 9px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.65; margin-top: 1px; }

.sc-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #4f8ff7;
  margin-top: 2px;
}
.sc-dot--alert { background: #ef4444; }

/* panel */
.sc-panel {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px;
  padding: 18px;
  backdrop-filter: blur(12px);
}
.sc-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}
.sc-panel-day  { font-size: 16px; font-weight: 700; color: #fff; }
.sc-panel-date { font-size: 11px; color: rgba(200,200,216,0.55); margin-top: 2px; }

.sc-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 100px;
  border: none;
  background: linear-gradient(135deg,#4f8ff7,#a855f7);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
  white-space: nowrap;
}
.sc-add-btn:hover { opacity: 0.88; transform: scale(1.04); }

/* event rows */
.sc-events { display: flex; flex-direction: column; gap: 8px; }

.sc-ev-row {
  display: flex;
  gap: 10px;
  align-items: stretch;
}
.sc-ev-line {
  width: 3px;
  border-radius: 2px;
  background: var(--evc, #4f8ff7);
  flex-shrink: 0;
  min-height: 40px;
  opacity: 0.8;
}
.sc-ev-card {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  padding: 10px 12px;
  transition: background 0.15s;
}
.sc-ev-card:hover { background: rgba(255,255,255,0.07); }

.sc-ev-top {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.sc-ev-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: rgba(79,143,247,0.18);
  color: #4f8ff7;
  border: 1px solid rgba(79,143,247,0.25);
  white-space: nowrap;
}
.sc-ev-badge--appointment { background: rgba(168,85,247,0.18); color: #c084fc; border-color: rgba(168,85,247,0.25); }
.sc-ev-badge--geofence    { background: rgba(34,197,94,0.15);  color: #4ade80; border-color: rgba(34,197,94,0.25); }
.sc-ev-badge--alert       { background: rgba(239,68,68,0.18);  color: #f87171; border-color: rgba(239,68,68,0.25); }

.sc-ev-title { font-size: 13px; font-weight: 600; color: #e8e8f8; flex: 1; }
.sc-ev-del {
  margin-left: auto;
  background: none;
  border: none;
  color: rgba(200,200,216,0.3);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 5px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
}
.sc-ev-del:hover { color: #f87171; background: rgba(239,68,68,0.12); }

.sc-ev-desc { font-size: 11px; color: rgba(200,200,216,0.5); margin-top: 3px; }

/* empty state */
.sc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  color: rgba(200,200,216,0.35);
  font-size: 13px;
}
</style>
