import { ref, watch, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

/**
 * Composable for PR analytics data fetching with per-repo support.
 * Aggregate view returns metrics only (no pullRequests array).
 * Per-repo view returns full data including pullRequests.
 */
export function usePullRequests(timeWindow, selectedRepo) {
  const prData = ref(null)
  const loading = ref(true)
  const error = ref(null)

  const isAggregate = computed(() => !selectedRepo.value || selectedRepo.value === 'all')

  async function load() {
    loading.value = true
    error.value = null
    try {
      const tw = timeWindow.value || 'month'
      let url = `/modules/ai-impact/pr-data?timeWindow=${tw}`
      if (selectedRepo.value && selectedRepo.value !== 'all') {
        url += `&repo=${encodeURIComponent(selectedRepo.value)}`
      }
      prData.value = await apiRequest(url)
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  watch(timeWindow, () => load())
  watch(selectedRepo, () => load())
  load()

  return { prData, loading, error, load, isAggregate }
}
