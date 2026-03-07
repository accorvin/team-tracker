import { ref, computed } from 'vue'
import { getGithubContributions, refreshGithubContributions } from '../services/api'

const githubData = ref(null)
const loading = ref(false)

export function useGithubStats() {
  const contributionsMap = computed(() => {
    if (!githubData.value?.users) return {}
    return githubData.value.users
  })

  function getContributions(githubUsername) {
    if (!githubUsername) return null
    return contributionsMap.value[githubUsername] || null
  }

  async function loadGithubStats() {
    if (githubData.value) return
    loading.value = true
    try {
      githubData.value = await getGithubContributions()
    } catch (err) {
      console.error('Failed to load GitHub stats:', err)
    } finally {
      loading.value = false
    }
  }

  async function refreshStats() {
    loading.value = true
    try {
      await refreshGithubContributions()
      // Wait a moment for the background job to process, then reload
      setTimeout(async () => {
        try {
          githubData.value = await getGithubContributions()
        } finally {
          loading.value = false
        }
      }, 5000)
    } catch (err) {
      console.error('Failed to refresh GitHub stats:', err)
      loading.value = false
    }
  }

  return {
    contributionsMap,
    getContributions,
    loadGithubStats,
    refreshStats,
    loading
  }
}
