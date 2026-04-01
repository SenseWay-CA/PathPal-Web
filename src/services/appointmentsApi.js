const API_BASE_URL = 'https://api.senseway.ca'

async function throwWithBody(response) {
  let msg = `HTTP error! status: ${response.status}`
  try {
    const body = await response.json()
    if (body?.error) msg += ` — ${body.error}`
  } catch (_) {}
  throw new Error(msg)
}

export async function listAppointments(userId) {
  const res = await fetch(`${API_BASE_URL}/appointments?user_id=${encodeURIComponent(userId)}`, {
    credentials: 'include',
  })
  if (!res.ok) await throwWithBody(res)
  return res.json()
}

export async function createAppointment(data) {
  const res = await fetch(`${API_BASE_URL}/appointments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwWithBody(res)
  return res.json()
}

export async function updateAppointment(data) {
  const res = await fetch(`${API_BASE_URL}/appointments`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwWithBody(res)
  return res.json()
}

export async function deleteAppointment(id, userId) {
  const res = await fetch(`${API_BASE_URL}/appointments`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, user_id: userId }),
  })
  if (!res.ok) await throwWithBody(res)
  return res.json()
}
