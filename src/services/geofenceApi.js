const API_BASE_URL = 'https://api.senseway.ca'

async function throwWithBody(response) {
  let msg = `HTTP error! status: ${response.status}`
  try {
    const body = await response.json()
    if (body?.error) msg += ` — ${body.error}`
  } catch (_) {}
  throw new Error(msg)
}

export async function listGeofences(userId) {
  console.log('[geofenceApi] listGeofences userId:', userId)
  const response = await fetch(`${API_BASE_URL}/fences?user_id=${encodeURIComponent(userId)}`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!response.ok) await throwWithBody(response)
  return await response.json()
}

export async function createGeofence(geofenceData) {
  const response = await fetch(`${API_BASE_URL}/fences`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geofenceData),
  })
  if (!response.ok) await throwWithBody(response)
  return await response.json()
}

export async function updateGeofence(geofenceId, geofenceData) {
  const response = await fetch(`${API_BASE_URL}/fences`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: geofenceId, ...geofenceData }),
  })
  if (!response.ok) await throwWithBody(response)
  return await response.json()
}

export async function deleteGeofence(geofenceId, userId) {
  const response = await fetch(`${API_BASE_URL}/fences`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, id: geofenceId }),
  })
  if (!response.ok) await throwWithBody(response)
  return await response.json()
}
