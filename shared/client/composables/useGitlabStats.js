import { ref, computed } from 'vue'
import { getGitlabContributions } from '../services/api'

const gitlabData = ref(null)
const loading = ref(false)

export function useGitlabStats() {
  const contributionsMap = computed(() => {
    if (!gitlabData.value?.users) return {}
    return gitlabData.value.users
  })

  function getContributions(gitlabUsername) {
    if (!gitlabUsername) return null
    return contributionsMap.value[gitlabUsername] || null
  }

  async function loadGitlabStats() {
    if (gitlabData.value) return
    loading.value = true
    try {
      await getGitlabContributions((data) => {
        gitlabData.value = data
        loading.value = false
      })
    } catch (err) {
      console.error('Failed to load GitLab stats:', err)
    } finally {
      loading.value = false
    }
  }

  function setUserContributions(username, data) {
    if (!gitlabData.value) gitlabData.value = { users: {} }
    if (!gitlabData.value.users) gitlabData.value.users = {}
    gitlabData.value.users[username] = data
  }

  return {
    contributionsMap,
    getContributions,
    loadGitlabStats,
    setUserContributions,
    loading
  }
}
