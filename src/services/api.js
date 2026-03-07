/**
 * API Service
 * Handles communication with the backend
 * Automatically includes Firebase ID token in requests
 */

import { useAuth } from '../composables/useAuth'

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || '/api'

/**
 * Get Firebase ID token for authentication
 */
async function getAuthToken() {
  const { getIdToken, loading } = useAuth()

  if (loading.value) {
    await new Promise((resolve) => {
      const checkLoading = setInterval(() => {
        if (!loading.value) {
          clearInterval(checkLoading)
          resolve()
        }
      }, 50)
      setTimeout(() => {
        clearInterval(checkLoading)
        resolve()
      }, 10000)
    })
  }

  try {
    return await getIdToken()
  } catch (error) {
    console.error('Failed to get auth token:', error)
    throw new Error('Authentication required. Please sign in again.')
  }
}

async function apiRequest(path, options = {}) {
  const token = await getAuthToken()
  const response = await fetch(`${API_ENDPOINT}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 401) {
      throw new Error('Authentication failed. Please sign in again.')
    }
    if (response.status === 403) {
      const err = new Error(errorData.error || 'Access denied')
      err.status = 403
      throw err
    }
    const err = new Error(errorData.error || `HTTP ${response.status}`)
    err.status = response.status
    throw err
  }

  return response.json()
}

// ─── Roster & Person Metrics ───

export async function getRoster() {
  return apiRequest('/roster')
}

export async function getPersonMetrics(jiraDisplayName, { refresh = false } = {}) {
  const params = refresh ? '?refresh=true' : ''
  return apiRequest(`/person/${encodeURIComponent(jiraDisplayName)}/metrics${params}`)
}

export async function getTeamMetrics(teamKey) {
  return apiRequest(`/team/${encodeURIComponent(teamKey)}/metrics`)
}

export async function refreshAllMetrics() {
  return apiRequest('/roster/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function refreshTeamMetrics(teamKey) {
  return apiRequest(`/team/${encodeURIComponent(teamKey)}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

// ─── GitHub Contributions ───

export async function getGithubContributions() {
  return apiRequest('/github/contributions')
}

export async function refreshGithubContributions() {
  return apiRequest('/github/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

// ─── Annotations ───

export async function getSprintAnnotations(sprintId) {
  return apiRequest(`/sprints/${encodeURIComponent(sprintId)}/annotations`)
}

export async function saveAnnotation(sprintId, assignee, text) {
  return apiRequest(`/sprints/${encodeURIComponent(sprintId)}/annotations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignee, text })
  })
}

export async function deleteAnnotation(sprintId, assignee, annotationId) {
  return apiRequest(`/sprints/${encodeURIComponent(sprintId)}/annotations/${encodeURIComponent(assignee)}/${encodeURIComponent(annotationId)}`, {
    method: 'DELETE'
  })
}

// ─── Allowlist ───

export async function getAllowlist() {
  return apiRequest('/allowlist')
}

export async function addToAllowlist(email) {
  return apiRequest('/allowlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
}

export async function removeFromAllowlist(email) {
  return apiRequest(`/allowlist/${encodeURIComponent(email)}`, {
    method: 'DELETE'
  })
}
