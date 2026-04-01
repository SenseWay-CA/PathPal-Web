// localStorage-backed store for appointments and timed-fence metadata
// all data is scoped to userId so multiple accounts don't clash

const KEY_APPTS = (uid) => `sw_cal_appts_${uid}`
const KEY_TIMED = (uid) => `sw_cal_timed_${uid}`

function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function persist(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

export function getAppointments(uid) {
  return load(KEY_APPTS(uid))
}
export function upsertAppointment(uid, appt) {
  const list = getAppointments(uid)
  const idx = list.findIndex((a) => a.id === appt.id)
  if (idx >= 0) list[idx] = appt; else list.push(appt)
  persist(KEY_APPTS(uid), list)
}
export function removeAppointment(uid, id) {
  persist(KEY_APPTS(uid), getAppointments(uid).filter((a) => a.id !== id))
}

export function getTimedFences(uid) {
  return load(KEY_TIMED(uid))
}
export function upsertTimedFence(uid, tf) {
  const list = getTimedFences(uid)
  const idx = list.findIndex((f) => f.id === tf.id)
  if (idx >= 0) list[idx] = tf; else list.push(tf)
  persist(KEY_TIMED(uid), list)
}
export function removeTimedFence(uid, id) {
  persist(KEY_TIMED(uid), getTimedFences(uid).filter((f) => f.id !== id))
}
