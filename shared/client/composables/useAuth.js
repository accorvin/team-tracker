import { ref, computed } from 'vue'

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || '/api'

const user = ref(null)
const loading = ref(true)

let initialized = false

export function useAuth() {
  if (!initialized) {
    initialized = true
    fetchCurrentUser()
  }

  async function fetchCurrentUser() {
    try {
      const res = await fetch(`${API_ENDPOINT}/whoami`)
      if (res.ok) {
        user.value = await res.json()
      }
    } catch {
      // Server not available (local dev without backend)
    } finally {
      loading.value = false
    }
  }

  const isAdmin = computed(() => user.value?.isAdmin === true)

  return {
    user,
    loading,
    isAdmin
  }
}
