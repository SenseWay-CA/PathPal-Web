const API_BASE_URL = 'https://api.senseway.ca'

export async function listGeofences(userId) {
  const response = await fetch(`${API_BASE_URL}/fences${userId}`)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}

export async function createGeofence(geofenceData) {
  const response = await fetch(`${API_BASE_URL}/api/geofences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(geofenceData)
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}

export async function updateGeofence(geofenceId, geofenceData) {
  const response = await fetch(`${API_BASE_URL}/fences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: geofenceId,
      ...geofenceData,
    })
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}

export async function deleteGeofence(geofenceId, userId) {
  const response = await fetch(`${API_BASE_URL}/api/geofences/${geofenceId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
    })
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}
