import { ref } from 'vue'
import { getAllowlist, addToAllowlist, removeFromAllowlist } from '../services/api'

const emails = ref([])
const loading = ref(false)
const error = ref(null)

export function useAllowlist() {
  async function fetchAllowlist() {
    loading.value = true
    error.value = null
    try {
      const data = await getAllowlist()
      emails.value = data.emails || []
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function addUser(email) {
    error.value = null
    try {
      const data = await addToAllowlist(email)
      emails.value = data.emails || []
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  async function removeUser(email) {
    error.value = null
    try {
      const data = await removeFromAllowlist(email)
      emails.value = data.emails || []
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  return {
    emails,
    loading,
    error,
    fetchAllowlist,
    addUser,
    removeUser
  }
}
