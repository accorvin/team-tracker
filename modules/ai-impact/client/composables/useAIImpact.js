import { ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

export function useAIImpact(timeWindow) {
  const rfeData = ref(null)
  const loading = ref(true)
  const error = ref(null)
  const refreshStatus = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const tw = timeWindow.value || 'month'
      rfeData.value = await apiRequest(`/modules/ai-impact/rfe-data?timeWindow=${tw}`)
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    return apiRequest('/modules/ai-impact/refresh', { method: 'POST' })
  }

  async function checkRefreshStatus() {
    refreshStatus.value = await apiRequest('/modules/ai-impact/refresh/status')
  }

  // Re-fetch when time window changes
  watch(timeWindow, () => load())
  load()

  return { rfeData, loading, error, refresh, refreshStatus, checkRefreshStatus, load }
}
